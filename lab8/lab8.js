// ============================================================
// Lab 8 — Interactive Visual Exploration of the DKU Bulletin
//
// Parts B, D, E, F.
//
// Everything is driven by ONE state object and ONE render()
// function. Search, the two filters, a clicked matrix cell and a
// selected passage all combine in render(), so they cannot fight
// over the same opacity the way separate handlers would.
// ============================================================

Promise.all([
    d3.csv(
        "../data/lab8_embedding_map.csv",
        d => ({
            ...d,
            x: +d.x,
            y: +d.y,
            page: +d.page,
            word_count: +d.word_count,
            cluster: +d.cluster,
            section_fit: +d.section_fit,
            unusual: d.unusual === "1",
            neighbors: d.neighbors ? d.neighbors.split("|") : [],
            neighbor_scores: d.neighbor_scores
                ? d.neighbor_scores.split("|").map(Number)
                : []
        })
    ),
    d3.csv(
        "../data/lab8_topic_section_matrix.csv",
        d => ({
            formal_group: d.formal_group,
            cluster_name: d.cluster_name,
            count: +d.count,
            proportion: +d.proportion
        })
    ),
    d3.json("../data/lab8_corpus_summary.json")
])
.then(([passages, matrixRows, summary]) => {


    // ========================================================
    // SHARED STATE
    // ========================================================

    const state = {
        search: "",
        section: "All",
        topic: "All",
        cell: null,          // { group, topic } from the matrix
        selectedId: null,    // passage clicked on the map
        matrixMode: "proportion"
    };

    const byId = new Map(passages.map(d => [d.passage_id, d]));

    const tooltip = d3.select("#lab8-tooltip");

    function showTip(event, html) {
        tooltip
            .style("opacity", 1)
            .html(html)
            .style("left", `${event.pageX + 14}px`)
            .style("top", `${event.pageY + 14}px`);
    }

    function hideTip() {
        tooltip.style("opacity", 0);
    }

    const shortGroup = g =>
        g.length > 34 ? g.slice(0, 32) + "…" : g;


    // ========================================================
    // COLOUR — one hue per semantic topic
    // ========================================================

    const topics = Array.from(
        d3.group(passages, d => d.cluster),
        ([cluster, rows]) => ({
            cluster,
            name: rows[0].cluster_name,
            n: rows.length
        })
    ).sort((a, b) => d3.ascending(a.cluster, b.cluster));

    const topicNames = topics.map(t => t.name);

    const palette = [
        "#4e79a7", "#f28e2b", "#e15759", "#76b7b2",
        "#59a14f", "#edc948", "#b07aa1", "#ff9da7",
        "#9c755f", "#1f3a5f", "#8c8c2c", "#6b6b6b"
    ];

    const topicColor = d3.scaleOrdinal()
        .domain(topicNames)
        .range(palette);

    const groups = Array.from(
        new Set(passages.map(d => d.formal_group))
    ).sort(d3.ascending);


    // ========================================================
    // PART A — corpus description numbers
    // ========================================================

    const stats = summary.stats;
    const parse = summary.parse || {};

    d3.select("#corpus-stats").html(`
        <div class="stat"><span>${parse.raw_passages ?? "—"}</span>raw passages</div>
        <div class="stat"><span>${stats.passages}</span>after cleaning</div>
        <div class="stat"><span>${stats.avg_words}</span>average words</div>
        <div class="stat"><span>${stats.sections}</span>formal sections</div>
        <div class="stat"><span>${stats.formal_groups}</span>matrix groups</div>
        <div class="stat"><span>${topics.length}</span>semantic topics</div>
    `);


    // ========================================================
    // PART B — two corpus summaries
    // ========================================================

    function horizontalBars(containerId, rows, valueKey, labelKey, color, fmt) {

        const w = 560;
        const barH = 20;
        const m = { top: 8, right: 60, bottom: 24, left: 250 };
        const h = m.top + m.bottom + rows.length * barH;

        const svg = d3.select(containerId)
            .append("svg")
            .attr("width", w)
            .attr("height", h);

        const x = d3.scaleLinear()
            .domain([0, d3.max(rows, d => d[valueKey])])
            .nice()
            .range([m.left, w - m.right]);

        const y = d3.scaleBand()
            .domain(rows.map(d => d[labelKey]))
            .range([m.top, h - m.bottom])
            .padding(0.18);

        svg.selectAll("rect")
            .data(rows)
            .join("rect")
            .attr("x", x(0))
            .attr("y", d => y(d[labelKey]))
            .attr("width", d => x(d[valueKey]) - x(0))
            .attr("height", y.bandwidth())
            .attr("fill", color);

        svg.selectAll(".bar-value")
            .data(rows)
            .join("text")
            .attr("class", "bar-value")
            .attr("x", d => x(d[valueKey]) + 5)
            .attr("y", d => y(d[labelKey]) + y.bandwidth() / 2)
            .attr("dominant-baseline", "central")
            .attr("font-size", 11)
            .text(d => fmt(d));

        svg.append("g")
            .attr("transform", `translate(${m.left},0)`)
            .call(d3.axisLeft(y).tickSize(0))
            .call(g => g.select(".domain").remove())
            .selectAll("text")
            .attr("font-size", 11)
            .text(d => shortGroup(d));

        svg.append("g")
            .attr("transform", `translate(0,${h - m.bottom})`)
            .call(d3.axisBottom(x).ticks(5));
    }

    horizontalBars(
        "#chart-by-section",
        summary.by_group,
        "passages",
        "formal_group",
        "#5b8fb9",
        d => `${d.passages}  (avg ${d.avg_words}w)`
    );

    horizontalBars(
        "#chart-top-terms",
        summary.top_terms.slice(0, 18),
        "count",
        "term",
        "#b07aa1",
        d => d.count
    );


    // ========================================================
    // PART D — semantic embedding map
    // ========================================================

    const mapW = 760;
    const mapH = 600;
    const mapM = { top: 16, right: 16, bottom: 16, left: 16 };

    const mapSvg = d3.select("#semantic-map")
        .append("svg")
        .attr("width", mapW)
        .attr("height", mapH);

    // clip so zoomed points do not spill outside the frame
    mapSvg.append("clipPath")
        .attr("id", "map-clip")
        .append("rect")
        .attr("x", mapM.left)
        .attr("y", mapM.top)
        .attr("width", mapW - mapM.left - mapM.right)
        .attr("height", mapH - mapM.top - mapM.bottom);

    mapSvg.append("rect")
        .attr("class", "map-frame")
        .attr("x", mapM.left)
        .attr("y", mapM.top)
        .attr("width", mapW - mapM.left - mapM.right)
        .attr("height", mapH - mapM.top - mapM.bottom);

    const plot = mapSvg.append("g")
        .attr("clip-path", "url(#map-clip)");

    const x0 = d3.scaleLinear()
        .domain(d3.extent(passages, d => d.x))
        .nice()
        .range([mapM.left + 10, mapW - mapM.right - 10]);

    const y0 = d3.scaleLinear()
        .domain(d3.extent(passages, d => d.y))
        .nice()
        .range([mapH - mapM.bottom - 10, mapM.top + 10]);

    // zoom rescales these copies, so circles keep a constant size
    let xScale = x0;
    let yScale = y0;

    // additional attribute: passage length -> point area
    const sizeScale = d3.scaleSqrt()
        .domain(d3.extent(passages, d => d.word_count))
        .range([2.2, 7.5]);

    const neighborLayer = plot.append("g").attr("class", "neighbor-lines");

    const points = plot.append("g")
        .selectAll(".passage")
        .data(passages, d => d.passage_id)
        .join("circle")
        .attr("class", "passage")
        .attr("r", d => sizeScale(d.word_count))
        .attr("fill", d => topicColor(d.cluster_name))
        .attr("cursor", "pointer")
        .on("mouseover", (event, d) => showTip(event, `
            <strong>${d.cluster_name}</strong><br>
            ${d.formal_group}<br>
            ${d.section ? d.section + "<br>" : ""}
            p. ${d.page} &middot; ${d.word_count} words
        `))
        .on("mousemove", event => tooltip
            .style("left", `${event.pageX + 14}px`)
            .style("top", `${event.pageY + 14}px`))
        .on("mouseout", hideTip)
        .on("click", (event, d) => {
            event.stopPropagation();
            state.selectedId =
                state.selectedId === d.passage_id ? null : d.passage_id;
            render();
        });

    function positionPoints() {

        points
            .attr("cx", d => xScale(d.x))
            .attr("cy", d => yScale(d.y));

        neighborLayer.selectAll("line")
            .attr("x1", d => xScale(d.from.x))
            .attr("y1", d => yScale(d.from.y))
            .attr("x2", d => xScale(d.to.x))
            .attr("y2", d => yScale(d.to.y));
    }

    positionPoints();

    // ---- zoom and pan

    const zoom = d3.zoom()
        .scaleExtent([1, 14])
        .extent([[0, 0], [mapW, mapH]])
        .translateExtent([[0, 0], [mapW, mapH]])
        .on("zoom", event => {
            xScale = event.transform.rescaleX(x0);
            yScale = event.transform.rescaleY(y0);
            positionPoints();
        });

    mapSvg.call(zoom);

    // clicking empty space clears the selection
    mapSvg.on("click", () => {
        state.selectedId = null;
        render();
    });

    d3.select("#reset-zoom").on("click", () => {
        mapSvg.transition().duration(600).call(zoom.transform, d3.zoomIdentity);
    });


    // ---- controls

    d3.select("#search").on("input", function () {
        state.search = this.value.toLowerCase().trim();
        render();
    });

    const sectionSelect = d3.select("#section-filter");

    sectionSelect.selectAll("option")
        .data(["All", ...groups])
        .join("option")
        .attr("value", d => d)
        .text(d => d === "All" ? "All sections" : d);

    sectionSelect.on("change", function () {
        state.section = this.value;
        state.cell = null;
        render();
    });

    const topicSelect = d3.select("#topic-filter");

    topicSelect.selectAll("option")
        .data(["All", ...topicNames])
        .join("option")
        .attr("value", d => d)
        .text(d => d === "All" ? "All topics" : d);

    topicSelect.on("change", function () {
        state.topic = this.value;
        state.cell = null;
        render();
    });

    d3.select("#clear-all").on("click", () => {
        state.search = "";
        state.section = "All";
        state.topic = "All";
        state.cell = null;
        state.selectedId = null;
        d3.select("#search").property("value", "");
        sectionSelect.property("value", "All");
        topicSelect.property("value", "All");
        render();
    });


    // ---- topic legend (click to filter)

    const legendItems = d3.select("#topic-legend")
        .selectAll(".legend-item")
        .data(topics)
        .join("div")
        .attr("class", "legend-item")
        .on("click", (event, t) => {
            state.topic = state.topic === t.name ? "All" : t.name;
            state.cell = null;
            topicSelect.property("value", state.topic);
            render();
        });

    legendItems.append("span")
        .attr("class", "swatch")
        .style("background", t => topicColor(t.name));

    legendItems.append("span")
        .text(t => `${t.name} (${t.n})`);


    // ========================================================
    // PART E — Topic x Section matrix
    // ========================================================

    const cellW = 46;
    const cellH = 28;
    const mxM = { top: 190, right: 20, bottom: 20, left: 260 };

    const mxW = mxM.left + topicNames.length * cellW + mxM.right;
    const mxH = mxM.top + groups.length * cellH + mxM.bottom;

    const matrixSvg = d3.select("#topic-matrix")
        .append("svg")
        .attr("width", mxW)
        .attr("height", mxH);

    const mx = d3.scaleBand()
        .domain(topicNames)
        .range([mxM.left, mxM.left + topicNames.length * cellW])
        .padding(0.06);

    const my = d3.scaleBand()
        .domain(groups)
        .range([mxM.top, mxM.top + groups.length * cellH])
        .padding(0.06);

    // every section x topic pair, including empty cells
    const lookup = new Map(
        matrixRows.map(r => [`${r.formal_group}|${r.cluster_name}`, r])
    );

    const groupTotals = d3.rollup(passages, v => v.length, d => d.formal_group);

    const cells = [];
    groups.forEach(g => {
        topicNames.forEach(t => {
            const r = lookup.get(`${g}|${t}`);
            cells.push({
                group: g,
                topic: t,
                count: r ? r.count : 0,
                proportion: r ? r.proportion : 0,
                total: groupTotals.get(g)
            });
        });
    });

    const countMax = d3.max(cells, d => d.count);

    const countColor = d3.scaleSequential(d3.interpolateBlues)
        .domain([0, Math.sqrt(countMax)]);

    const propColor = d3.scaleSequential(d3.interpolateBlues)
        .domain([0, 1]);

    const cellValue = d =>
        state.matrixMode === "count" ? d.count : d.proportion;

    const cellFill = d => {
        if (d.count === 0) {
            return "#f5f5f5";
        }
        return state.matrixMode === "count"
            ? countColor(Math.sqrt(d.count))
            : propColor(d.proportion);
    };

    const cellG = matrixSvg.append("g")
        .selectAll(".mx-cell")
        .data(cells)
        .join("g")
        .attr("class", "mx-cell")
        .attr("transform", d => `translate(${mx(d.topic)},${my(d.group)})`)
        .attr("cursor", d => d.count ? "pointer" : "default")
        .on("mouseover", (event, d) => showTip(event, `
            <strong>${d.group}</strong><br>
            Topic: ${d.topic}<br>
            Passages: ${d.count} of ${d.total}<br>
            Share of section: ${(d.proportion * 100).toFixed(1)}%
        `))
        .on("mousemove", event => tooltip
            .style("left", `${event.pageX + 14}px`)
            .style("top", `${event.pageY + 14}px`))
        .on("mouseout", hideTip)
        .on("click", (event, d) => {
            if (!d.count) {
                return;
            }
            const same =
                state.cell &&
                state.cell.group === d.group &&
                state.cell.topic === d.topic;
            state.cell = same ? null : { group: d.group, topic: d.topic };
            state.section = "All";
            state.topic = "All";
            sectionSelect.property("value", "All");
            topicSelect.property("value", "All");
            render();
            if (!same) {
                document.getElementById("semantic-map")
                    .scrollIntoView({ behavior: "smooth", block: "center" });
            }
        });

    cellG.append("rect")
        .attr("width", mx.bandwidth())
        .attr("height", my.bandwidth())
        .attr("rx", 2);

    cellG.append("text")
        .attr("x", mx.bandwidth() / 2)
        .attr("y", my.bandwidth() / 2)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "central")
        .attr("font-size", 10)
        .attr("pointer-events", "none");

    // column labels (topics), rotated, coloured to match the map
    matrixSvg.append("g")
        .selectAll("text")
        .data(topicNames)
        .join("text")
        .attr(
            "transform",
            t => `translate(${mx(t) + mx.bandwidth() / 2},${mxM.top - 8}) rotate(-50)`
        )
        .attr("font-size", 11)
        .attr("fill", t => topicColor(t))
        .attr("font-weight", "bold")
        .text(t => t.length > 26 ? t.slice(0, 24) + "…" : t);

    // row labels (formal sections)
    matrixSvg.append("g")
        .selectAll("text")
        .data(groups)
        .join("text")
        .attr("x", mxM.left - 8)
        .attr("y", g => my(g) + my.bandwidth() / 2)
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "central")
        .attr("font-size", 11)
        .text(g => shortGroup(g));

    // matrix legend + mode toggle
    d3.selectAll("input[name='matrix-mode']").on("change", function () {
        state.matrixMode = this.value;
        render();
    });

    function drawMatrixLegend() {

        const holder = d3.select("#matrix-legend");
        holder.selectAll("*").remove();

        const w = 240;
        const svg = holder.append("svg").attr("width", w + 40).attr("height", 44);

        const gradId = "mx-grad";
        const grad = svg.append("defs")
            .append("linearGradient")
            .attr("id", gradId);

        d3.range(0, 1.001, 0.1).forEach(t => {
            grad.append("stop")
                .attr("offset", `${t * 100}%`)
                .attr("stop-color", d3.interpolateBlues(t));
        });

        svg.append("rect")
            .attr("x", 10).attr("y", 6)
            .attr("width", w).attr("height", 12)
            .attr("fill", `url(#${gradId})`);

        const hi = state.matrixMode === "count"
            ? `${countMax} passages`
            : "100% of section";

        svg.append("text").attr("x", 10).attr("y", 34)
            .attr("font-size", 11).text("0");
        svg.append("text").attr("x", w + 10).attr("y", 34)
            .attr("font-size", 11).attr("text-anchor", "end").text(hi);
    }


    // ========================================================
    // PART F + details — one render for everything
    // ========================================================

    function matches(d) {

        if (state.cell) {
            return d.formal_group === state.cell.group &&
                   d.cluster_name === state.cell.topic;
        }

        if (state.section !== "All" && d.formal_group !== state.section) {
            return false;
        }
        if (state.topic !== "All" && d.cluster_name !== state.topic) {
            return false;
        }
        if (state.search && !d.text.toLowerCase().includes(state.search)) {
            return false;
        }
        return true;
    }


    function render() {

        const selected = state.selectedId ? byId.get(state.selectedId) : null;
        const neighborSet = new Set(selected ? selected.neighbors : []);

        let matchCount = 0;

        // ---- map points

        points
            .attr("opacity", d => {
                if (selected) {
                    if (d.passage_id === selected.passage_id) return 1;
                    if (neighborSet.has(d.passage_id)) return 1;
                    return matches(d) ? 0.28 : 0.05;
                }
                const m = matches(d);
                if (m) matchCount += 1;
                return m ? 0.85 : 0.05;
            })
            .attr("stroke", d => {
                if (selected && d.passage_id === selected.passage_id) return "#000";
                if (neighborSet.has(d.passage_id)) return "#d62728";
                return "none";
            })
            .attr("stroke-width", d =>
                selected && (d.passage_id === selected.passage_id ||
                             neighborSet.has(d.passage_id)) ? 2.2 : 0
            )
            .attr("r", d =>
                selected && d.passage_id === selected.passage_id
                    ? sizeScale(d.word_count) + 4
                    : sizeScale(d.word_count)
            );

        // selected passage and its neighbours sit on top
        points.filter(d =>
            selected &&
            (d.passage_id === selected.passage_id || neighborSet.has(d.passage_id))
        ).raise();

        // ---- neighbour lines

        const lineData = selected
            ? selected.neighbors
                .map(id => byId.get(id))
                .filter(Boolean)
                .map(to => ({ from: selected, to }))
            : [];

        neighborLayer.selectAll("line")
            .data(lineData)
            .join("line")
            .attr("stroke", "#d62728")
            .attr("stroke-width", 1.2)
            .attr("stroke-dasharray", "3 3")
            .attr("opacity", 0.8);

        positionPoints();

        // ---- status line

        const parts = [];
        if (state.cell) parts.push(`cell: ${state.cell.group} × ${state.cell.topic}`);
        if (state.section !== "All") parts.push(`section: ${state.section}`);
        if (state.topic !== "All") parts.push(`topic: ${state.topic}`);
        if (state.search) parts.push(`search: “${state.search}”`);

        d3.select("#map-status").text(
            selected
                ? `Showing ${selected.passage_id} and its ${selected.neighbors.length} nearest semantic neighbours`
                : parts.length
                    ? `${matchCount} of ${passages.length} passages match — ${parts.join(" · ")}`
                    : `${passages.length} passages`
        );

        // ---- legend: dim topics that are filtered out

        legendItems.classed(
            "inactive",
            t => state.topic !== "All" && state.topic !== t.name
        );

        // ---- matrix: fill, labels, and the coordinated highlight

        cellG.select("rect")
            .attr("fill", cellFill)
            .attr("stroke", d => {
                const cellHit =
                    state.cell &&
                    state.cell.group === d.group &&
                    state.cell.topic === d.topic;
                const pointHit =
                    selected &&
                    selected.formal_group === d.group &&
                    selected.cluster_name === d.topic;
                return cellHit || pointHit ? "#d62728" : "#fff";
            })
            .attr("stroke-width", d => {
                const hit =
                    (state.cell && state.cell.group === d.group && state.cell.topic === d.topic) ||
                    (selected && selected.formal_group === d.group && selected.cluster_name === d.topic);
                return hit ? 3 : 1;
            });

        cellG.select("text")
            .text(d => {
                if (!d.count) return "";
                return state.matrixMode === "count"
                    ? d.count
                    : `${Math.round(d.proportion * 100)}`;
            })
            .attr("fill", d => cellValue(d) > (state.matrixMode === "count" ? countMax * 0.45 : 0.45)
                ? "#fff" : "#222");

        // rows/columns related to the current section/topic filter
        cellG.attr("opacity", d => {
            if (state.section !== "All" && d.group !== state.section) return 0.35;
            if (state.topic !== "All" && d.topic !== state.topic) return 0.35;
            return 1;
        });

        drawMatrixLegend();

        // ---- detail panel

        renderDetails(selected);
    }


    function renderDetails(d) {

        const panel = d3.select("#detail-panel");

        if (!d) {
            panel.html(`
                <p class="hint">Click any point on the map to read the passage,
                see where it sits in the bulletin, and find its five most
                semantically similar passages.</p>
            `);
            return;
        }

        const neighborHtml = d.neighbors
            .map((id, i) => {
                const n = byId.get(id);
                if (!n) return "";
                const cross = n.formal_group !== d.formal_group
                    ? `<span class="cross">different section</span>`
                    : "";
                return `
                    <li data-id="${id}">
                        <span class="dot" style="background:${topicColor(n.cluster_name)}"></span>
                        <strong>${n.formal_group}</strong> ${cross}<br>
                        <span class="meta">p. ${n.page} · ${n.cluster_name} ·
                            similarity ${d.neighbor_scores[i].toFixed(2)}</span><br>
                        ${n.text.slice(0, 170)}${n.text.length > 170 ? "…" : ""}
                    </li>`;
            })
            .join("");

        const fitNote = d.unusual
            ? `<span class="cross">least typical 10% of its section</span>`
            : "";

        const heading =
            (d.subsection && d.subsection.split(" / ").pop()) ||
            d.section ||
            d.formal_group;

        panel.html(`
            <h3>${heading}</h3>
            <table class="meta-table">
                <tr><td>Chapter</td><td>${d.chapter}</td></tr>
                <tr><td>Section</td><td>${d.section || "—"}</td></tr>
                <tr><td>Subsection</td><td>${d.subsection || "—"}</td></tr>
                <tr><td>Page</td><td>${d.page}</td></tr>
                <tr><td>Semantic topic</td><td>
                    <span class="dot" style="background:${topicColor(d.cluster_name)}"></span>
                    ${d.cluster_name}</td></tr>
                <tr><td>Fit to section</td><td>${d.section_fit.toFixed(2)} ${fitNote}</td></tr>
            </table>
            <p class="passage-text">${d.text}</p>
            <h4>Nearest semantic neighbours</h4>
            <ol class="neighbors">${neighborHtml}</ol>
        `);

        // click a neighbour to jump to it
        panel.selectAll(".neighbors li").on("click", function () {
            state.selectedId = this.getAttribute("data-id");
            render();
        });
    }


    render();

});
