// ============================================================================
// Lab 9 — Geospatial Visualization
// 2025 GDP: choropleth (colour = GDP) + Dorling cartogram (area = GDP),
// with linked highlighting between them.
//
// Structure follows Lab 8: one `state` object, one render() for the things
// that change. Anything that only gets built once stays outside it.
// ============================================================================

const width = 960;
const height = 520;

// Cartogram gets its own box - it is a different geometry, not the same map.
const cartoWidth = 960;
const cartoHeight = 520;

// ---------- ANCHOR: background and missing-data colours ----------
// d3.interpolatePurples starts at #fcfbfd - effectively white - so on a white
// page the lowest-GDP countries are invisible. A warm tan background is the
// fix: it is the opposite hue to purple AND darker than the pale end of the
// ramp, so the faintest countries separate by lightness as well as hue.
// (Hue alone would fail for colour-blind readers.)
const BG = "#f1ebe1";               // warm cream - change this one line to retheme
// Neutral grey, and deliberately LOW contrast against the background. Missing
// countries need to be identifiable, not attention-grabbing - the reader is
// meant to be looking at the purples. Being neutral where everything else is
// either warm (background) or cool (the ramp) is what keeps it legible at
// this lightness: it separates by hue, not by weight.
const NO_DATA = "#dedede";

// d3.interpolatePurples starts at #fcfbfd, which against this cream gives a
// contrast of 1.04 - the lowest-GDP countries would be invisible. Rather than
// darken the background, START the ramp partway in, so its palest step is
// already recognisably purple. The full range from #c0c0dd to #3f007d is
// still far more than the eye can resolve on a map.
const RAMP_FLOOR = 0.36;

const purples = t =>
    d3.interpolatePurples(RAMP_FLOOR + (1 - RAMP_FLOOR) * t);
// Dark gold. Purple's near-complement, so it separates from every step of
// the sequential scale - and from the greys used for missing data.
const HILITE = "#b8860b";


// ---------- Task 5: load both files before doing anything ----------

Promise.all([
    d3.json("../data/world.geojson"),

    d3.csv(
        "../data/lab9_gdp_2025_top50.csv",
        d => ({
            iso3: d.iso3,
            country: d.country,
            gdp: +d.gdp_2025_billion_usd,
            rank: +d.rank
        })
    )
])
.then(([geoData, stats]) => {

    // ---------- ANCHOR: which property holds the identifier ----------
    // Natural Earth sets ISO_A3 to "-99" for a few features, including
    // FRANCE and NORWAY - both top-20 economies. Joining on ISO_A3 alone
    // renders them as "no data", which looks like a problem with the GDP
    // file rather than a bug in the join. ADM0_A3 has the right code.

    function iso3Of(feature) {
        const p = feature.properties;
        return (p.ISO_A3 && p.ISO_A3 !== "-99") ? p.ISO_A3 : p.ADM0_A3;
    }


    // ---------- the join ----------

    const gdpById = new Map(stats.map(d => [d.iso3, d]));

    geoData.features.forEach(feature => {
        const row = gdpById.get(iso3Of(feature));

        // null, NOT 0. Zero would mean "this country produced nothing" and
        // a colour scale would paint it as the palest purple.
        feature.properties.gdp = row ? row.gdp : null;
        feature.properties.countryName =
            (row && row.country) || feature.properties.NAME;
        feature.properties.iso3 = iso3Of(feature);
    });


    // ---------- verify the join before drawing ----------
    // A map that silently drops a country still looks like a fine map.

    const matched = geoData.features.filter(f => f.properties.gdp != null);

    const unmatched = stats
        .map(d => d.iso3)
        .filter(code => !geoData.features.some(f => f.properties.iso3 === code));

    console.log("GDP rows:", stats.length, "| features matched:", matched.length);
    console.log("codes with no matching country:", unmatched);


    // ---------- ANCHOR: colour scales ----------
    // GDP is heavily skewed, so the choice of scale IS a design decision and
    // Part B asks you to defend it. All four are built here so the page can
    // switch between them and the difference is visible rather than argued.

    const values = matched.map(d => d.properties.gdp);
    const minGdp = d3.min(values);
    const maxGdp = d3.max(values);

    const SCALES = {
        linear: {
            label: "Linear",
            scale: d3.scaleSequential(purples)
                .domain([0, maxGdp]),
            note: "Faithful to ratios, but the top two economies take the dark end and everything else collapses into near-identical pale purple."
        },
        log: {
            label: "Logarithmic",
            // A log scale cannot include 0 in its domain - log(0) is
            // undefined - so the domain starts at the smallest real value.
            scale: d3.scaleSequentialLog(purples)
                .domain([minGdp, maxGdp])
        },
        sqrt: {
            label: "Square root",
            scale: d3.scaleSequentialSqrt(purples)
                .domain([0, maxGdp]),
            note: "A milder compression than log. Middle ground, but harder to explain to a reader than either extreme."
        },
    };


    // ---------- state ----------

    const state = {
        scaleType: "log",
        hoveredIso: null,
        selectedIso: null
    };

    // ---------- ANCHOR: paint order ----------
    // SVG has no z-index, so stacking is purely document order. Two rules:
    //   1. biggest first, so big shapes sit UNDERNEATH and never swallow a
    //      small neighbour (the scaled USA otherwise covers Mexico);
    //   2. the country under the cursor goes last, so it reads on top.
    //
    // This runs through selection.sort() rather than .raise(), because
    // raise() is CUMULATIVE - it moves an element to the end and leaves it
    // there, so the order degrades as you hover around and never recovers.
    // sort() rebuilds the whole order every render, so letting go of a
    // country puts it straight back where it belongs.
    function stackOrder(gdpA, isoA, gdpB, isoB, active) {
        const aActive = isoA === active;
        const bActive = isoB === active;

        if (aActive !== bActive) return aActive ? 1 : -1;
        return (gdpB || 0) - (gdpA || 0);
    }

    const colorOf = value =>
        value == null ? NO_DATA : SCALES[state.scaleType].scale(value);


    // ================= CHOROPLETH =================

    const projection = d3.geoNaturalEarth1()
        .fitSize([width, height], geoData);

    const path = d3.geoPath().projection(projection);

    const mapSvg = d3.select("#choropleth")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .style("background", BG);

    // Everything zoomable lives in this group. Transforming the svg itself
    // would scale the legend too.
    const mapGroup = mapSvg.append("g");

    const countries = mapGroup.selectAll("path.country")
        .data(geoData.features)
        .join("path")
        .attr("class", "country")
        .attr("d", path)
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.4);


    // ---------- zoom ----------

    const zoom = d3.zoom()
        .scaleExtent([1, 8])
        .on("zoom", event => {
            mapGroup.attr("transform", event.transform);

            // Strokes scale with the transform. At 8x a 0.4px border becomes
            // 3.2px and the map turns into a mesh of white lines.
            countries.attr("stroke-width", 0.4 / event.transform.k);
        });

    mapSvg.call(zoom);


    // ================= CARTOGRAM 1: NON-CONTIGUOUS =================
    // Olson (1976). Every country keeps its real outline and its real
    // position; it is scaled about its own centroid until its AREA is
    // proportional to GDP. Shapes stay recognizable, and the gaps that open
    // up where a country shrank are themselves informative.
    //
    // scale factor = sqrt(target area / actual area), because area grows
    // with the SQUARE of a linear scale - the same reason the Dorling below
    // uses scaleSqrt for its radii.

    const areaOf = f => Math.max(path.area(f), 0.25);   // guard tiny polygons

    // Choose the constant so the fifty countries keep roughly the same total
    // ink they started with - otherwise the map either explodes or vanishes.
    const totalArea = d3.sum(matched, areaOf);
    const totalGdp = d3.sum(matched, f => f.properties.gdp);
    const AREA_PER_GDP = totalArea / totalGdp;

    matched.forEach(f => {
        f.properties.scaleFactor =
            Math.sqrt((f.properties.gdp * AREA_PER_GDP) / areaOf(f));
    });

    const ncSvg = d3.select("#cartogram-nc")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .style("background", BG);

    // Scaling about a centroid throws distant territories a long way: the US
    // centroid is in the continental states, so Alaska shoots off the top of
    // the canvas. Clip to the frame rather than trying to prevent it - the
    // overflow is a real consequence of the encoding, not an error.
    ncSvg.append("clipPath")
        .attr("id", "nc-clip")
        .append("rect")
        .attr("width", width)
        .attr("height", height)
        .style("background", BG);

    const ncGroup = ncSvg.append("g")
        .attr("clip-path", "url(#nc-clip)");

    // Ghost outlines of every country, so you can still see where the
    // shrunken ones used to reach - and, just as importantly, which
    // countries are not in the dataset at all.
    ncGroup.selectAll("path.nc-ghost")
        .data(geoData.features)
        .join("path")
        .attr("class", "nc-ghost")
        .attr("d", path)
        .attr("fill", "none")
        .attr("stroke", "rgba(90,78,58,0.30)")
        .attr("stroke-width", 0.5);

    const ncCountries = ncGroup.selectAll("path.nc")
        .data(matched)
        .join("path")
        .attr("class", "nc")
        .attr("d", path)
        .attr("transform", d => {
            const [cx, cy] = path.centroid(d);
            const s = d.properties.scaleFactor;
            // Scale about the country's own centroid: move it to the origin,
            // scale, move it back.
            return `translate(${cx},${cy}) scale(${s}) translate(${-cx},${-cy})`;
        })
        .attr("stroke", "#fff")
        .attr("stroke-width", d => 0.5 / d.properties.scaleFactor);


    // ================= CARTOGRAM 2: DORLING =================
    // One circle per country, area proportional to GDP, nudged apart until
    // none overlap. Position stays near the country's true location, so the
    // map is still roughly readable as a map.

    const radius = d3.scaleSqrt()          // AREA encodes GDP, so sqrt
        .domain([0, maxGdp])
        .range([0, 62]);

    const cartoSvg = d3.select("#cartogram")
        .append("svg")
        .attr("width", cartoWidth)
        .attr("height", cartoHeight)
        .style("background", BG);

    // Start each circle at its country's projected centroid.
    const nodes = matched.map(f => {
        const [cx, cy] = path.centroid(f);
        return {
            iso3: f.properties.iso3,
            name: f.properties.countryName,
            gdp: f.properties.gdp,
            scaleFactor: f.properties.scaleFactor,
            x0: cx, y0: cy,
            x: cx, y: cy
        };
    });

    // Run the simulation to completion up front rather than animating it -
    // the layout is the point, not the motion.
    const sim = d3.forceSimulation(nodes)
        .force("x", d3.forceX(d => d.x0).strength(0.25))
        .force("y", d3.forceY(d => d.y0).strength(0.25))
        .force("collide", d3.forceCollide(d => radius(d.gdp) + 1).iterations(4))
        .stop();

    for (let i = 0; i < 300; i++) sim.tick();

    // The top-50 economies sit overwhelmingly in the northern hemisphere, so
    // a world-shaped canvas leaves the bottom half empty. Fit the finished
    // layout to its own bounding box: a single uniform scale + translate
    // keeps every circle's position relative to every other, so the
    // approximate geography survives and the space gets used.
    const pad = 14;
    const xs = d3.extent(nodes, d => d.x);
    const ys = d3.extent(nodes, d => d.y);
    const maxR = d3.max(nodes, d => radius(d.gdp));

    const spanX = (xs[1] - xs[0]) + 2 * maxR;
    const spanY = (ys[1] - ys[0]) + 2 * maxR;

    const k = Math.min(
        (cartoWidth - 2 * pad) / spanX,
        (cartoHeight - 2 * pad) / spanY
    );

    const tx = pad - (xs[0] - maxR) * k + (cartoWidth - 2 * pad - spanX * k) / 2;
    const ty = pad - (ys[0] - maxR) * k + (cartoHeight - 2 * pad - spanY * k) / 2;

    const cartoGroup = cartoSvg.append("g")
        .attr("transform", `translate(${tx},${ty}) scale(${k})`);

    // ---------- ANCHOR: the "how much did it grow" ghost ----------
    // A Dorling circle has no natural true size, so the baseline is the
    // country's PROJECTED LAND AREA - the same comparison the non-contiguous
    // cartogram makes with its outlines.
    //
    // scaleFactor = sqrt(gdpArea / landArea), so the land-area radius is
    // simply the GDP radius divided by it. Bigger ghost than circle means
    // the country shrank; smaller ghost means it grew.
    // ---------- ANCHOR: three sub-layers, in paint order ----------
    // SVG has no z-index: document order IS paint order, and .raise() moves
    // an element to the end of its PARENT. With bubbles and labels as
    // siblings, raising a hovered bubble lifted it over the labels and hid
    // the text. Giving each its own group means raise() can only reorder
    // within a layer, so labels always stay on top.
    const bubbleLayer = cartoGroup.append("g");
    const ghostLayer = cartoGroup.append("g");
    const labelLayer = cartoGroup.append("g");

    const ghosts = ghostLayer.selectAll("circle.ghost")
        .data(nodes)
        .join("circle")
        .attr("class", "ghost")
        .attr("cx", d => d.x)
        .attr("cy", d => d.y)
        .attr("r", d => radius(d.gdp) / d.scaleFactor)
        .attr("fill", "none")
        .attr("stroke", HILITE)
        .attr("stroke-dasharray", "3 3")
        .attr("pointer-events", "none")
        .attr("opacity", 0);

    const bubbles = bubbleLayer.selectAll("circle.bubble")
        .data(nodes)
        .join("circle")
        .attr("class", "bubble")
        .attr("cx", d => d.x)
        .attr("cy", d => d.y)
        .attr("r", d => radius(d.gdp))
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.8 / k);

    // Label only the circles big enough to hold text.
    // A three-letter code is roughly 1.8x the font size wide, so it fits
    // inside a circle when the font is a bit under the radius. Anything that
    // would need type smaller than ~6.5px is left to the tooltip instead of
    // being rendered illegibly.
    const labelFont = d => Math.min(13, radius(d.gdp) * 0.72);

    labelLayer.selectAll("text.carto-label")
        .data(nodes.filter(d => labelFont(d) >= 6.5))
        .join("text")
        .attr("class", "carto-label")
        .attr("x", d => d.x)
        .attr("y", d => d.y + labelFont(d) * 0.35)
        .attr("text-anchor", "middle")
        .attr("font-size", d => labelFont(d) / k)
        .attr("pointer-events", "none")
        .text(d => d.iso3);


    // ================= LEGEND =================
    // Rebuilt whenever the scale changes, because a log legend and a linear
    // legend need different tick positions to be honest.

    const legendWidth = 300;
    const legendHeight = 12;

    const legendSvg = d3.select("#legend")
        .append("svg")
        .attr("width", legendWidth + 60)
        .attr("height", 56)
        .style("background", BG)
        .style("border-radius", "3px");

    const legendG = legendSvg.append("g")
        .attr("transform", "translate(20,8)");

    function drawLegend() {
        const cfg = SCALES[state.scaleType];
        legendG.selectAll("*").remove();

        // Continuous scale -> a gradient, sampled from the live scale so
        // it can never drift out of sync with the map.
        const gradientId = "legend-gradient";
        legendSvg.select("defs").remove();

        const stops = d3.range(0, 1.001, 0.05);
        const defs = legendSvg.append("defs");

        const grad = defs.append("linearGradient")
            .attr("id", gradientId);

        const d0 = cfg.scale.domain()[0];
        const d1 = cfg.scale.domain()[1];

        grad.selectAll("stop")
            .data(stops)
            .join("stop")
            .attr("offset", d => `${d * 100}%`)
            .attr("stop-color", d => {
                // Walk the domain the way the scale does, so a log
                // gradient is sampled logarithmically.
                const v = state.scaleType === "log"
                    ? d0 * Math.pow(d1 / d0, d)
                    : d0 + d * (d1 - d0);
                return cfg.scale(v);
            });

        legendG.append("rect")
            .attr("width", legendWidth)
            .attr("height", legendHeight)
            .attr("fill", `url(#${gradientId})`);

        // Ticks printed as real values. On a log scale this is what
        // stops the legend over-promising: the reader can see that the
        // steps are not equal amounts.
        const ticks = state.scaleType === "log"
            ? [1000, 3000, 10000, 30000].filter(v => v >= d0 && v <= d1)
            : cfg.scale.ticks
                ? cfg.scale.ticks(5)
                : d3.range(5).map(i => d0 + (i / 4) * (d1 - d0));

        const posOf = v => state.scaleType === "log"
            ? legendWidth * Math.log(v / d0) / Math.log(d1 / d0)
            : legendWidth * (v - d0) / (d1 - d0);

        legendG.selectAll("text.tick")
            .data(ticks)
            .join("text")
            .attr("class", "tick")
            .attr("x", d => posOf(d))
            .attr("y", legendHeight + 13)
            .attr("text-anchor", "middle")
            .text(d => d >= 1000 ? `$${(d / 1000).toFixed(0)}T` : `$${d}B`);

        // The no-data swatch. Required: missing must look different from low.
        legendG.append("rect")
            .attr("y", legendHeight + 20)
            .attr("width", 12)
            .attr("height", 12)
            .attr("fill", NO_DATA)
            .attr("stroke", "#ccc");

        legendG.append("text")
            .attr("class", "tick")
            .attr("x", 18)
            .attr("y", legendHeight + 30)
            .text("not in the top-50 dataset");

        d3.select("#scale-note").text(cfg.note);
    }


    // ================= TOOLTIP =================

    const tooltip = d3.select("#tooltip");

    const fmtGdp = v => v >= 1000
        ? `$${(v / 1000).toFixed(2)} trillion`
        : `$${v.toFixed(0)} billion`;

    function showTip(event, name, gdp, rank, growth) {
        tooltip
            .style("opacity", 1)
            .html(`
                <strong>${name}</strong><br>
                ${gdp == null
                    ? "<em>not in the top-50 dataset</em>"
                    : `2025 GDP: ${fmtGdp(gdp)}<br>rank ${rank}` +
                      (growth
                        ? `<br><span class="tt-dim">${
                            growth >= 1
                              ? `${growth.toFixed(1)}\u00d7 larger`
                              : `${(1 / growth).toFixed(1)}\u00d7 smaller`
                          } than its land area</span>`
                        : "")}
            `);
    }

    function moveTip(event) {
        tooltip
            .style("left", `${event.pageX + 14}px`)
            .style("top", `${event.pageY + 14}px`);
    }

    const hideTip = () => tooltip.style("opacity", 0);


    // ================= EVENTS =================
    // Every handler does the same two things: change state, call render.
    // Because both views read the same state, highlighting is linked for
    // free - neither view knows the other exists.

    countries
        .on("mouseover", function (event, d) {
            state.hoveredIso = d.properties.iso3;
            showTip(event, d.properties.countryName, d.properties.gdp,
                    (gdpById.get(d.properties.iso3) || {}).rank,
                    d.properties.scaleFactor);
            render();
        })
        .on("mousemove", moveTip)
        .on("mouseout", function () {
            state.hoveredIso = null;
            hideTip();
            render();
        })
        .on("click", function (event, d) {
            if (d.properties.gdp == null) return;
            state.selectedIso =
                state.selectedIso === d.properties.iso3 ? null : d.properties.iso3;
            render();
        });

    ncCountries
        .on("mouseover", function (event, d) {
            state.hoveredIso = d.properties.iso3;
            showTip(event, d.properties.countryName, d.properties.gdp,
                    (gdpById.get(d.properties.iso3) || {}).rank,
                    d.properties.scaleFactor);
            render();
        })
        .on("mousemove", moveTip)
        .on("mouseout", function () {
            state.hoveredIso = null;
            hideTip();
            render();
        })
        .on("click", function (event, d) {
            state.selectedIso =
                state.selectedIso === d.properties.iso3 ? null : d.properties.iso3;
            render();
        });

    bubbles
        .on("mouseover", function (event, d) {
            state.hoveredIso = d.iso3;
            showTip(event, d.name, d.gdp, (gdpById.get(d.iso3) || {}).rank, d.scaleFactor);
            render();
        })
        .on("mousemove", moveTip)
        .on("mouseout", function () {
            state.hoveredIso = null;
            hideTip();
            render();
        })
        .on("click", function (event, d) {
            state.selectedIso = state.selectedIso === d.iso3 ? null : d.iso3;
            render();
        });

    d3.select("#scale-select").on("change", function () {
        state.scaleType = this.value;
        render();
    });

    d3.select("#reset-zoom").on("click", () => {
        mapSvg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
        state.selectedIso = null;
        render();
    });


    // ================= RENDER =================

    function render() {
        const active = state.hoveredIso || state.selectedIso;

        countries
            .attr("fill", d => colorOf(d.properties.gdp))
            .attr("stroke", d => d.properties.iso3 === active ? HILITE : "#fff")
            .attr("stroke-width", d => d.properties.iso3 === active ? 2 : 0.4)
            .attr("opacity", d =>
                active && d.properties.gdp != null && d.properties.iso3 !== active
                    ? 0.55 : 1);

        countries.sort((a, b) => stackOrder(
            a.properties.gdp, a.properties.iso3,
            b.properties.gdp, b.properties.iso3, active));

        ncCountries
            .attr("fill", d => colorOf(d.properties.gdp))
            .attr("stroke", d => d.properties.iso3 === active ? HILITE : "#fff")
            .attr("stroke-width", d =>
                (d.properties.iso3 === active ? 2.2 : 0.5) / d.properties.scaleFactor)
            .attr("opacity", d =>
                active && d.properties.iso3 !== active ? 0.5 : 1);

        ncCountries.sort((a, b) => stackOrder(
            a.properties.gdp, a.properties.iso3,
            b.properties.gdp, b.properties.iso3, active));

        bubbles
            .attr("fill", d => colorOf(d.gdp))
            .attr("stroke", d => d.iso3 === active ? HILITE : "#fff")
            .attr("stroke-width", d => (d.iso3 === active ? 2.5 : 0.8) / k)
            .attr("opacity", d => active && d.iso3 !== active ? 0.55 : 1);

        bubbles.sort((a, b) => stackOrder(a.gdp, a.iso3, b.gdp, b.iso3, active));

        // Only the active country's ghost: showing all fifty at once would
        // be unreadable, and the comparison is a per-country question.
        ghosts
            .attr("opacity", d => d.iso3 === active ? 0.85 : 0)
            .attr("stroke-width", 1.3 / k);

        ghosts.sort((a, b) => stackOrder(a.gdp, a.iso3, b.gdp, b.iso3, active));

        drawLegend();
    }


    // ---------- first paint ----------
    d3.select("#scale-select").property("value", state.scaleType);
    render();
});
