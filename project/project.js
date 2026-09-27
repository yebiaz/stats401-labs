// ============================================================================
// Individual Project - Stull Chart Redesign
//
// Data:
//   ../data/stull_recipes.csv   real recipes from the Glazy bulk export
//   ../data/stull_regions.json  region polygons digitized from the plate
//   ../data/stull_limits.csv    limit-formula rectangles
//
// Structure follows Lab 8: ONE state object and ONE render() function, so
// that search, filters, hover, zoom and selection compose instead of
// fighting each other. Anything that changes what you see changes `state`
// and then calls render(). Nothing draws directly from an event handler.
//
// The chart is "overview first, zoom and filter, details on demand":
// the default view bins 12,000 recipes into countable clusters, clicking a
// cluster zooms into it and separates the recipes inside, and the table
// follows whatever you have drilled into.
// ============================================================================


// ---------- ANCHOR: dimensions ----------
// The inner plot is a FIXED size. Aspect ratio is not cosmetic here: ratio is
// read as slope, so if the box changes shape the slopes stop being
// comparable. Locking it and stating the exaggeration out loud is the honest
// version of "fix the aspect ratio".

const width = 720;
const height = 460;

const margin = {
    top: 24,
    right: 24,
    bottom: 52,
    left: 62
};

const innerWidth = width - margin.left - margin.right;
const innerHeight = height - margin.top - margin.bottom;

const X_DOMAIN = [0, 8];
const Y_DOMAIN = [0, 1.2];

// Bin edge length in screen pixels at zoom level 1. As you zoom in, the bins
// divide by the zoom scale, so they stay about this big on screen while
// covering less and less chemistry - which is what makes drilling down
// actually reveal structure instead of just magnifying a blob.
const BASE_BIN_PX = 26;

const MAX_ZOOM = 40;


// ---------- ANCHOR: surface colours ----------
// Distinct hues on a light background. Deliberately not a sequential ramp:
// surface is categorical, and a ramp would imply an order that is not there.

const SURFACE_COLORS = {
    "gloss":      "#1f6feb",
    "semi-gloss": "#4cabe0",
    "satin":      "#3fa45b",
    "semi-matte": "#d98b25",
    "matte":      "#c0392b"
};

const SURFACE_ORDER = [
    "gloss",
    "semi-gloss",
    "satin",
    "semi-matte",
    "matte"
];

const REGION_COLORS = {
    "unfused":     "#b8a4c9",
    "matte":       "#e8b4a0",
    "semi-matte":  "#f0d9a8",
    "gloss":       "#a8d5ba",
    "underfired":  "#c9c0a8",
    "crazed":      "#7f8c8d"
};


// ---------- ANCHOR: load all three files ----------
// Promise.all, same as Lab 5. Everything that reads the data has to live
// inside this .then().

Promise.all([
    d3.csv("../data/stull_recipes.csv", d => ({
        id: d.id,
        name: d.name,
        sio2: +d.sio2,
        al2o3: +d.al2o3,
        si_al_ratio: +d.si_al_ratio,
        cone: d.cone,
        cone_ordinal: d.cone_ordinal === "" ? null : +d.cone_ordinal,
        surface: d.surface,
        type: d.type,
        r2o_fraction: d.r2o_fraction === "" ? null : +d.r2o_fraction,
        source_url: d.source_url
    })),
    d3.json("../data/stull_regions.json"),
    d3.csv("../data/stull_limits.csv", d => ({
        author: d.author,
        cone: d.cone,
        sio2_min: +d.sio2_min,
        sio2_max: +d.sio2_max,
        al2o3_min: +d.al2o3_min,
        al2o3_max: +d.al2o3_max,
        use: d.use,
        verified: d.verified
    }))
]).then(([recipes, regionData, limits]) => {

    // ---------- ANCHOR: state ----------
    // The single source of truth. Read it top to bottom and you know exactly
    // what is on screen.

    const state = {
        cone: "6",
        surface: "all",
        type: "all",
        search: "",
        limitAuthor: "none",
        showRatios: false,
        showGloss: false,
        sortKey: "name",
        sortDir: 1,
        hoveredId: null,
        selectedId: null,

        // The recipes you have drilled into, or null. Deliberately stores the
        // ROWS rather than a bin id: bin ids are "column:row" in a grid whose
        // cell size divides by the zoom scale, so the moment the zoom lands
        // the grid is finer and the id you clicked no longer exists. Holding
        // the rows makes the selection survive re-binning.
        drillRows: null
    };

    let transform = d3.zoomIdentity;


    // ---------- ANCHOR: scales ----------

    const xScale = d3.scaleLinear()
        .domain(X_DOMAIN)
        .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
        .domain(Y_DOMAIN)
        .range([innerHeight, 0]);

    // How much the chart stretches vertically. Still computed, because
    // bandAngle() needs it to write the region labels along their bands at
    // the correct on-screen angle. It is no longer printed under the chart -
    // the exaggeration and the cone-11 caveat are discussed in the report,
    // and summarised in the "New to this chart?" panel.
    const exaggeration =
        (innerHeight / (Y_DOMAIN[1] - Y_DOMAIN[0])) /
        (innerWidth / (X_DOMAIN[1] - X_DOMAIN[0]));


    // ---------- ANCHOR: svg skeleton ----------
    // Layers are appended ONCE here, in paint order. There is no z-index in
    // SVG, so this order is the whole story.
    //
    // Everything that lives in data space goes inside `zoomGroup`, which is
    // what the zoom transform is applied to. Axes stay OUTSIDE it and are
    // rescaled instead, because a transformed axis would scale its own tick
    // labels into unreadable giants.

    const svg = d3.select("#chart")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    const defs = svg.append("defs");

    // Soft region edges. A blur on the whole regions layer is the cheapest
    // honest way to say "these boundaries are fuzzy in reality".
    defs.append("filter")
        .attr("id", "soften")
        .attr("x", "-20%")
        .attr("y", "-20%")
        .attr("width", "140%")
        .attr("height", "140%")
        .append("feGaussianBlur")
        .attr("stdDeviation", 4);

    // Diagonal hatch for the crazing overlay, so it reads as "on top of"
    // rather than "instead of".
    const hatch = defs.append("pattern")
        .attr("id", "hatch")
        .attr("width", 7)
        .attr("height", 7)
        .attr("patternUnits", "userSpaceOnUse")
        .attr("patternTransform", "rotate(45)");

    hatch.append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", 0)
        .attr("y2", 7)
        .attr("stroke", REGION_COLORS.crazed)
        .attr("stroke-width", 2.5)
        .attr("stroke-opacity", 0.5);

    defs.append("clipPath")
        .attr("id", "plot-clip")
        .append("rect")
        .attr("width", innerWidth)
        .attr("height", innerHeight);

    const plot = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // One clipped wrapper, then the zoomed contents inside it.
    const clipWrap = plot.append("g")
        .attr("clip-path", "url(#plot-clip)");

    const zoomGroup = clipWrap.append("g")
        .attr("class", "zoom-group");

    // Soft edges are applied once, here, rather than toggled in render():
    // the fuzziness is a claim the chart makes about the boundaries being
    // uncertain, not a display preference.
    const regionLayer = zoomGroup.append("g")
        .attr("class", "region-layer")
        .attr("filter", "url(#soften)");

    // The crazing hatch lives OUTSIDE the blurred layer. Blurring a 7px
    // hatch pattern erases it completely - it disappeared entirely the first
    // time I ran this.
    const crazeLayer = zoomGroup.append("g").attr("class", "craze-layer");

    const pointLayer = zoomGroup.append("g").attr("class", "point-layer");
    const binLayer = zoomGroup.append("g").attr("class", "bin-layer");
    const limitLayer = zoomGroup.append("g").attr("class", "limit-layer");
    const ratioLayer = zoomGroup.append("g").attr("class", "ratio-layer");
    const regionLabelLayer = zoomGroup.append("g").attr("class", "region-label-layer");
    const starLayer = zoomGroup.append("g").attr("class", "star-layer");


    // ---------- ANCHOR: axes ----------
    // Appended once, classed, never re-appended. This is the Lab 7 lesson:
    // two unclassed axis blocks meant the stale one never updated.

    plot.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale).ticks(9));

    plot.append("g")
        .attr("class", "y-axis")
        .call(d3.axisLeft(yScale).ticks(7));

    plot.append("text")
        .attr("class", "axis-title")
        .attr("x", innerWidth / 2)
        .attr("y", innerHeight + 40)
        .attr("text-anchor", "middle")
        .text("Molecules SiO₂  (silica, UMF)");

    plot.append("text")
        .attr("class", "axis-title")
        .attr("transform", "rotate(-90)")
        .attr("x", -innerHeight / 2)
        .attr("y", -44)
        .attr("text-anchor", "middle")
        .text("Molecules Al₂O₃  (alumina, UMF)");


    // ---------- ANCHOR: region polygons ----------

    const toPath = polygon =>
        "M" + polygon
            .map(p => `${xScale(p[0])},${yScale(p[1])}`)
            .join("L") + "Z";

    const exclusiveRegions = regionData.regions.filter(r => !r.overlay);
    const overlayRegions = regionData.regions.filter(r => r.overlay);

    regionLayer.selectAll(".region")
        .data(exclusiveRegions)
        .join("path")
        .attr("class", "region")
        .attr("d", d => toPath(d.polygon))
        .attr("fill", d => REGION_COLORS[d.id])
        .attr("fill-opacity", 0.75);

    crazeLayer.selectAll(".region-overlay")
        .data(overlayRegions)
        .join("path")
        .attr("class", "region-overlay")
        .attr("d", d => toPath(d.polygon))
        .attr("fill", "url(#hatch)");


    // ---------- ANCHOR: region labels ----------
    // Written ALONG each band, the way the printed plate does it, rather than
    // flat. Two reasons, and the second is the real one:
    //
    //   1. a flat label sitting across a diagonal wedge looks like it belongs
    //      to whatever is underneath it, not to the band;
    //   2. the angle itself encodes the ratio. A steep label IS a low-ratio
    //      band. The label becomes a second, redundant channel for the thing
    //      the chart is actually about.
    //
    // Positions are the label positions read off the plate, scaled outward
    // along their own radial so they clear the data. Scaling x and y by the
    // same factor leaves the ratio - and therefore the angle - untouched.

    const PLATE_LABELS = {
        unfused:      [1.40, 0.88],
        matte:        [2.35, 0.89],
        "semi-matte": [3.15, 0.87],
        gloss:        [5.50, 0.78],
        underfired:   [6.50, 0.46],
        crazed:       [1.55, 0.175]
    };

    const LABEL_PUSH = 1.15;

    // Screen angle of a radial at ratio r. In data space its slope is 1/r,
    // but the chart is stretched vertically, so the angle you SEE is
    // steepened by the same exaggeration factor the axis note reports.
    function bandAngle(ratio) {
        return -Math.atan(exaggeration / ratio) * 180 / Math.PI;
    }

    regionLabelLayer.selectAll(".region-label")
        .data(regionData.regions)
        .join("text")
        .attr("class", "region-label")
        .attr("text-anchor", "middle")
        .attr("data-x", d => xScale(PLATE_LABELS[d.id][0] * LABEL_PUSH))
        .attr("data-y", d => yScale(PLATE_LABELS[d.id][1] * LABEL_PUSH))
        .attr("data-angle", d =>
            d.overlay ? 0 : bandAngle(PLATE_LABELS[d.id][0] / PLATE_LABELS[d.id][1])
        )
        .text(d => d.label.toUpperCase());


    // ---------- ANCHOR: ratio radials ----------
    // A fixed silica:alumina ratio r is the line al2o3 = sio2 / r, which is a
    // straight radial from the origin. This is the whole reason the regions
    // are wedges.

    const ratioLines = ratioLayer.selectAll(".ratio-line")
        .data(regionData.ratio_lines)
        .join("g")
        .attr("class", "ratio-line");

    ratioLines.append("line")
        .attr("x1", xScale(0))
        .attr("y1", yScale(0))
        .attr("x2", d => xScale(Math.min(X_DOMAIN[1], d.ratio * Y_DOMAIN[1])))
        .attr("y2", d =>
            yScale(Math.min(X_DOMAIN[1], d.ratio * Y_DOMAIN[1]) / d.ratio)
        );

    // Labels at the END of each radial, nudged INSIDE the plot box. The first
    // version put them 6px above the line, which for the steep radials landed
    // them outside the frame entirely.
    ratioLines.append("text")
        .attr("x", d => xScale(Math.min(X_DOMAIN[1], d.ratio * Y_DOMAIN[1])) - 6)
        .attr("y", d =>
            yScale(Math.min(X_DOMAIN[1], d.ratio * Y_DOMAIN[1]) / d.ratio) + 13
        )
        .attr("text-anchor", "end")
        .text(d => d.label);


    // ---------- ANCHOR: the printed gloss line ----------
    // Kept SEPARATE from the radials on purpose. The line actually drawn on
    // Stull's plate has an intercept, so it is not a pure ratio line - it
    // drifts from about 8.9:1 at the left to 7.8:1 at the right. Drawing both
    // lets you see the discrepancy instead of taking "1:7.5" on faith.

    const glossLine = ratioLayer.append("line")
        .attr("class", "gloss-line")
        .attr("x1", xScale(0.8))
        .attr("y1", yScale(0.1352 * 0.8 - 0.0533))
        .attr("x2", xScale(8))
        .attr("y2", yScale(0.1352 * 8 - 0.0533));

    const glossLabel = ratioLayer.append("text")
        .attr("class", "gloss-label")
        .attr("x", xScale(7.9))
        .attr("y", yScale(0.1352 * 7.9 - 0.0533) - 8)
        .attr("text-anchor", "end")
        .text("HIGHEST GLOSS (as drawn on the plate)");


    // ---------- ANCHOR: binning ----------
    // Square bins in SCREEN space, so they stay square despite the 4x
    // vertical exaggeration. Binning in data space would produce tall thin
    // rectangles that look like a grid artifact.
    //
    // Why bins and not k-means: a k-means centroid can land outside its own
    // cluster when the cluster is curved - and these clusters ARE curved,
    // because they stretch along ratio radials. A centroid sitting in a
    // region none of its members belong to would be a lie. A bin's position
    // is always a real place on the chart.
    //
    // The honest caveat: a square grid cuts across the radial region
    // boundaries at an angle, so a bin near an edge can straddle two regions.
    // Bins are kept small enough that this is rare, and clicking through to
    // the points resolves it.

    function makeBins(rows, sizePx) {
        const byCell = new Map();

        for (const d of rows) {
            const px = xScale(d.sio2);
            const py = yScale(d.al2o3);

            const ix = Math.floor(px / sizePx);
            const iy = Math.floor(py / sizePx);
            const key = `${ix}:${iy}`;

            let cell = byCell.get(key);

            if (!cell) {
                cell = {
                    key: key,
                    ix: ix,
                    iy: iy,
                    x: (ix + 0.5) * sizePx,
                    y: (iy + 0.5) * sizePx,
                    rows: []
                };
                byCell.set(key, cell);
            }

            cell.rows.push(d);
        }

        return Array.from(byCell.values());
    }

    // The modal surface in a bin, AND how dominant it is. The share is what
    // drives opacity: a bin that is 90% gloss reads solid, a bin that is
    // 40/30/30 reads washed out. Painting a mixed bin at full strength would
    // be exactly the over-promising this whole project is a critique of.
    function modalSurface(rows) {
        const labelled = rows.filter(d => d.surface);

        if (!labelled.length) {
            return { surface: null, share: 0 };
        }

        const counts = d3.rollup(labelled, v => v.length, d => d.surface);
        const best = d3.greatest(counts, entry => entry[1]);

        return {
            surface: best[0],
            share: best[1] / labelled.length
        };
    }


    // ---------- ANCHOR: populate the dropdowns ----------

    function fillSelect(selector, values, allLabel) {
        d3.select(selector)
            .selectAll("option")
            .data([allLabel].concat(values))
            .join("option")
            .attr("value", (d, i) => i === 0 ? "all" : d)
            .text(d => d);
    }

    // Cones, ordered coldest to hottest using cone_ordinal, not alphabetically.
    // 06 is colder than 6, which a string sort gets backwards.
    const conesByHeat = Array.from(
        d3.rollup(
            recipes.filter(d => d.cone),
            v => v[0].cone_ordinal,
            d => d.cone
        )
    )
        .sort((a, b) => d3.ascending(a[1], b[1]))
        .map(d => d[0]);

    fillSelect("#cone-filter", conesByHeat, "All cones");
    d3.select("#cone-filter").property("value", state.cone);

    fillSelect("#surface-filter", SURFACE_ORDER, "All surfaces");

    const commonTypes = Array.from(
        d3.rollup(recipes, v => v.length, d => d.type)
    )
        .filter(d => d[0] && d[1] >= 40)
        .sort((a, b) => d3.descending(a[1], b[1]))
        .map(d => d[0]);

    fillSelect("#type-filter", commonTypes, "All types");

    // Limit rectangles: one entry per author+cone, never all at once. Showing
    // them all together would recreate exactly the confusion they are meant
    // to resolve.
    d3.select("#limit-filter")
        .selectAll("option")
        .data(["No limits"].concat(
            limits.map(d => `${d.author} — cone ${d.cone} (${d.use})`)
        ))
        .join("option")
        .attr("value", (d, i) => i === 0 ? "none" : i - 1)
        .text(d => d);


    // ---------- ANCHOR: filtering ----------
    // Returns a boolean per recipe rather than a shortened array, because
    // ghost mode needs to know about the excluded ones too.

    function passesFilter(d) {
        if (state.cone !== "all" && d.cone !== state.cone) return false;
        if (state.surface !== "all" && d.surface !== state.surface) return false;
        if (state.type !== "all" && d.type !== state.type) return false;

        if (state.search) {
            const haystack = (d.name || "").toLowerCase();
            if (!haystack.includes(state.search.toLowerCase())) return false;
        }
        return true;
    }


    // ---------- ANCHOR: table sorting ----------
    // Blanks always sort last regardless of direction, which is the rule from
    // Lab 3. Sorting should not bury the rows you can actually read.

    function compare(a, b) {
        const key = state.sortKey;
        const x = a[key];
        const y = b[key];

        const xEmpty = x === "" || x == null || Number.isNaN(x);
        const yEmpty = y === "" || y == null || Number.isNaN(y);

        if (xEmpty && yEmpty) return 0;
        if (xEmpty) return 1;
        if (yEmpty) return -1;

        if (typeof x === "number" && typeof y === "number") {
            return state.sortDir * (x - y);
        }
        return state.sortDir * String(x).localeCompare(String(y));
    }


    // ---------- ANCHOR: zoom ----------
    // Scroll to zoom, drag to pan, click a cluster to fly into it.
    //
    // The zoom handler deliberately does NOT call render(). It fires dozens
    // of times a second, and re-binning 4,000 recipes on every frame would
    // stutter. It moves the group and fixes up the marks that must not
    // scale; render() is called once on zoom END to re-bin at the new scale.

    const zoom = d3.zoom()
        .scaleExtent([1, MAX_ZOOM])
        .extent([[0, 0], [innerWidth, innerHeight]])
        .translateExtent([[0, 0], [innerWidth, innerHeight]])
        .on("zoom", zoomed)
        .on("end", () => render());

    svg.call(zoom);

    function zoomed(event) {
        transform = event.transform;

        zoomGroup.attr("transform", transform);

        plot.select(".x-axis")
            .call(d3.axisBottom(transform.rescaleX(xScale)).ticks(9));

        plot.select(".y-axis")
            .call(d3.axisLeft(transform.rescaleY(yScale)).ticks(7));

        counterScale();
    }

    // Marks that live inside zoomGroup get scaled by the transform along with
    // their positions. Positions SHOULD scale; radii, stroke widths and text
    // should not. Dividing by transform.k undoes it.
    function counterScale() {
        const k = transform.k;

        pointLayer.selectAll("circle")
            .attr("r", 4 / k)
            .attr("stroke-width", 0.6 / k);

        binLayer.selectAll("circle")
            .attr("r", d => d.radius / k)
            .attr("stroke-width", 1 / k);

        // The soft-edge blur is a screen-space filter, so zooming magnifies
        // it too. Left alone, a 4px blur at 12x reads as a rendering fault
        // rather than as uncertainty. Counter-scaling keeps the softness a
        // constant number of pixels at every zoom level.
        defs.select("#soften feGaussianBlur")
            .attr("stdDeviation", 4 / k);

        ratioLayer.selectAll("line").attr("stroke-width", 1.2 / k);
        limitLayer.selectAll("rect").attr("stroke-width", 1.5 / k);

        starLayer.selectAll("path")
            .attr("transform", d =>
                `translate(${xScale(d.sio2)},${yScale(d.al2o3)}) scale(${1 / k})`
            );

        // Region labels and text annotations are overview furniture. Rather
        // than counter-scaling every one of them, hide them once you are
        // zoomed in - at that point you are reading individual recipes, not
        // orienting yourself.
        const zoomedIn = k > 2.5;

        regionLabelLayer.selectAll("text")
            .attr("display", zoomedIn ? "none" : null)
            .attr("transform", function () {
                const sel = d3.select(this);
                return `translate(${sel.attr("data-x")},${sel.attr("data-y")}) ` +
                       `rotate(${sel.attr("data-angle")}) scale(${1 / k})`;
            });

        ratioLayer.selectAll("text")
            .attr("display", zoomedIn ? "none" : null);
    }

    // Fly to a bin's cell. Uses the CELL bounds, not the extent of the points
    // inside it: a bin holding a single recipe has zero extent, which would
    // divide by zero and throw the zoom to infinity.
    function zoomToCell(cell, sizePx) {
        const k = Math.min(
            MAX_ZOOM,
            0.85 * Math.min(innerWidth / sizePx, innerHeight / sizePx)
        );

        svg.transition()
            .duration(600)
            .call(
                zoom.transform,
                d3.zoomIdentity
                    .translate(innerWidth / 2, innerHeight / 2)
                    .scale(k)
                    .translate(-cell.x, -cell.y)
            );
    }

    function resetZoom() {
        state.drillRows = null;

        svg.transition()
            .duration(500)
            .call(zoom.transform, d3.zoomIdentity);
    }


    // ---------- ANCHOR: render ----------
    // The only function that touches the DOM after setup. Every control ends
    // by calling this.

    const TABLE_LIMIT = 250;

    // Remembers which filter state was last rendered, so a hover-only render
    // does not needlessly discard a drilled-into cluster.
    let lastFilterKey = null;

    function render() {

        const k = transform.k;
        const binSize = BASE_BIN_PX / k;

        // ----- overlays -----
        // Regions and their soft edges are always on: they are the chart, not
        // an option. Only the two reference-line overlays toggle.
        ratioLayer.selectAll(".ratio-line")
            .attr("display", state.showRatios ? null : "none");

        glossLine.attr("display", state.showGloss ? null : "none");
        glossLabel.attr("display", state.showGloss ? null : "none");

        const activeLimit = state.limitAuthor === "none"
            ? []
            : [limits[+state.limitAuthor]];

        limitLayer.selectAll(".limit-rect")
            .data(activeLimit)
            .join("rect")
            .attr("class", "limit-rect")
            .attr("x", d => xScale(d.sio2_min))
            .attr("y", d => yScale(d.al2o3_max))
            .attr("width", d => xScale(d.sio2_max) - xScale(d.sio2_min))
            .attr("height", d => yScale(d.al2o3_min) - yScale(d.al2o3_max))
            .attr("fill", "#1f6feb")
            .attr("fill-opacity", 0.18)
            .attr("stroke", "#1f6feb")
            .attr("stroke-dasharray", d => d.verified === "yes" ? null : "5 4");

        limitLayer.selectAll(".limit-caption")
            .data(activeLimit)
            .join("text")
            .attr("class", "limit-caption")
            .attr("x", d => xScale(d.sio2_min) + 4)
            .attr("y", d => yScale(d.al2o3_min) + 14)
            .attr("display", k > 2.5 ? "none" : null)
            .text(d =>
                `${d.author}, cone ${d.cone}` +
                (d.verified === "yes" ? "" : "  (figures unverified)")
            );

        const matched = recipes.filter(passesFilter);

        // Changing a filter invalidates whatever cluster was drilled into,
        // because the cluster was built from the old matched set.
        const filterKey = [
            state.cone, state.surface, state.type, state.search
        ].join("|");

        if (filterKey !== lastFilterKey) {
            lastFilterKey = filterKey;
            state.drillRows = null;

            // A selection that no longer passes the filter has no row in the
            // table any more, so its sticky star would float on the chart
            // with nothing to trace it back to.
            if (state.selectedId &&
                !matched.some(d => d.id === state.selectedId)) {
                state.selectedId = null;
            }
        }

        // ----- decide what the marks are -----
        // Two states only: the clustered overview, or one cluster drilled
        // into and shown as individual recipes.
        const drill = state.drillRows;
        const bins = drill ? [] : makeBins(matched, binSize);
        const pointRows = drill || [];

        // ----- clusters -----
        const maxCount = d3.max(bins, b => b.rows.length) || 1;

        // scaleSqrt, because the eye reads a circle by AREA. A linear radius
        // scale would make a 100-recipe bin look ten times heavier than it is.
        const binRadius = d3.scaleSqrt()
            .domain([1, maxCount])
            .range([2.5, BASE_BIN_PX * 0.55]);

        bins.forEach(b => {
            const mode = modalSurface(b.rows);
            b.radius = binRadius(b.rows.length);
            b.modeSurface = mode.surface;
            b.modeShare = mode.share;
        });

        binLayer.selectAll("circle")
            .data(bins, d => d.key)
            .join("circle")
            .attr("cx", d => d.x)
            .attr("cy", d => d.y)
            .attr("r", d => d.radius / k)
            .attr("fill", d =>
                d.modeSurface ? SURFACE_COLORS[d.modeSurface] : "#9aa0a6"
            )
            // Opacity carries how trustworthy the colour is. A bin split
            // evenly between gloss and matte should not look confidently
            // blue.
            .attr("fill-opacity", d =>
                d.modeSurface ? 0.25 + 0.6 * d.modeShare : 0.3
            )
            .attr("stroke", "#fff")
            .attr("stroke-width", 1 / k)
            .attr("cursor", "pointer")
            .on("mouseenter", (event, d) => showBinTooltip(event, d))
            .on("mouseleave", hideTooltip)
            .on("click", (event, d) => {
                state.drillRows = d.rows;
                hideTooltip();
                zoomToCell(d, binSize);
                render();
            });

        // ----- points -----
        pointLayer.selectAll("circle")
            .data(pointRows, d => d.id)
            .join("circle")
            .attr("cx", d => xScale(d.sio2))
            .attr("cy", d => yScale(d.al2o3))
            // No special radius for the selected recipe: the star now marks
            // it, and an enlarged circle underneath would poke out between
            // the star's points.
            .attr("r", 4 / k)
            .attr("fill", d =>
                d.surface ? SURFACE_COLORS[d.surface] : "#9aa0a6"
            )
            .attr("fill-opacity", 0.75)
            .attr("stroke", "#fff")
            .attr("stroke-width", 0.6 / k)
            .on("mouseenter", (event, d) => {
                state.hoveredId = d.id;
                showTooltip(event, d);
                render();
            })
            .on("mouseleave", () => {
                state.hoveredId = null;
                hideTooltip();
                render();
            })
            .on("click", (event, d) => {
                event.stopPropagation();
                state.selectedId = state.selectedId === d.id ? null : d.id;
                render();
            });

        // ----- stars -----
        // The Glazy interaction worth keeping: hovering a table row marks the
        // matching recipe on the chart. A star, not a bigger circle, because
        // shape survives being on top of a coloured region where size and
        // colour do not.
        //
        // TWO stars can be live at once, and they mean different things:
        //   hovered  - transient, follows the mouse down the table
        //   selected - sticky, stays until you click the row again
        //
        // The selected star matters more than it looks. In the clustered
        // overview no individual recipes are drawn at all, so without it a
        // click would change the table and leave the chart unmarked - you
        // could not see WHERE the recipe you just picked actually sits.
        const starIds = new Set();

        if (state.selectedId) starIds.add(state.selectedId);
        if (state.hoveredId) starIds.add(state.hoveredId);

        const starDatum = starIds.size
            ? recipes.filter(d => starIds.has(d.id))
            : [];

        const star = d3.symbol().type(d3.symbolStar);

        starLayer.selectAll("path")
            .data(starDatum, d => d.id)
            .join("path")
            // The sticky star is drawn bigger and outlined more heavily than
            // the hover star, so that when you are hovering one row while
            // another stays selected you can tell which is which.
            .attr("d", d => star.size(d.id === state.selectedId ? 440 : 300)())
            .attr("transform", d =>
                `translate(${xScale(d.sio2)},${yScale(d.al2o3)}) scale(${1 / k})`
            )
            .attr("fill", d =>
                d.surface ? SURFACE_COLORS[d.surface] : "#5f6368"
            )
            .attr("stroke", "#111")
            .attr("stroke-width", d => d.id === state.selectedId ? 2 : 1.4)
            .attr("pointer-events", "none");

        // ----- the table -----
        // Follows whatever you have drilled into. This is the inverse of
        // Glazy's choice: Glazy subsets the CHART to match the table page, so
        // the chart can never show the population. Here the chart always has
        // the population and the TABLE is what narrows.
        const sorted = (drill || matched).slice().sort(compare);

        d3.select("#drill-note")
            .attr("hidden", drill ? null : true)
            .text(drill
                ? `Zoomed into one cluster: ${drill.length} recipes. ` +
                  `"Back to overview" to zoom out.`
                : "");

        d3.select("#count").text(
            sorted.length > TABLE_LIMIT
                ? `${sorted.length.toLocaleString()} recipes match. ` +
                  `Showing the first ${TABLE_LIMIT} in the table; ` +
                  `all of them are on the chart.`
                : `${sorted.length.toLocaleString()} recipes match.`
        );

        const rows = d3.select("#recipe-table tbody")
            .selectAll("tr")
            .data(sorted.slice(0, TABLE_LIMIT), d => d.id)
            .join("tr")
            .classed("selected", d => d.id === state.selectedId)
            .classed("hovered", d => d.id === state.hoveredId)
            .on("mouseenter", (event, d) => {
                state.hoveredId = d.id;
                render();
            })
            .on("mouseleave", () => {
                state.hoveredId = null;
                render();
            })
            .on("click", (event, d) => {
                state.selectedId = state.selectedId === d.id ? null : d.id;
                render();
            });

        rows.selectAll("td")
            .data(d => [
                d.name,
                d.sio2.toFixed(2),
                d.al2o3.toFixed(2),
                Number.isFinite(d.si_al_ratio) ? d.si_al_ratio.toFixed(1) : "",
                d.cone || "",
                d.surface || ""
            ])
            .join("td")
            .text(v => v);
    }


    // ---------- ANCHOR: tooltips ----------

    const tooltip = d3.select("#tooltip");

    function showTooltip(event, d) {
        tooltip
            .style("opacity", 1)
            .html(`
                <strong>${d.name}</strong><br>
                SiO<sub>2</sub> ${d.sio2.toFixed(2)} &nbsp;
                Al<sub>2</sub>O<sub>3</sub> ${d.al2o3.toFixed(2)}<br>
                Ratio ${d.si_al_ratio.toFixed(1)}:1<br>
                Cone ${d.cone || "—"} &nbsp; ${d.surface || ""}<br>
                <span class="tt-dim">${d.type || ""}</span>
            `)
            .style("left", `${event.pageX + 14}px`)
            .style("top", `${event.pageY + 14}px`);
    }

    // The cluster tooltip lists the FULL surface breakdown, not just the
    // modal one. Aggregation hides disagreement, so the tooltip has to make
    // the disagreement inspectable - otherwise the bin colour is an
    // unfalsifiable claim.
    function showBinTooltip(event, bin) {
        const counts = Array.from(
            d3.rollup(
                bin.rows.filter(d => d.surface),
                v => v.length,
                d => d.surface
            )
        ).sort((a, b) => d3.descending(a[1], b[1]));

        const breakdown = counts.length
            ? counts.map(([surface, n]) =>
                `<span class="swatch-sm" style="background:${
                    SURFACE_COLORS[surface]
                }"></span>${surface} ${n}`
              ).join("<br>")
            : "<span class='tt-dim'>no surface labels</span>";

        const ratios = bin.rows.map(d => d.si_al_ratio).filter(Number.isFinite);

        tooltip
            .style("opacity", 1)
            .html(`
                <strong>${bin.rows.length} recipes</strong><br>
                <span class="tt-dim">median ratio ${
                    ratios.length ? d3.median(ratios).toFixed(1) : "—"
                }:1</span><br>
                ${breakdown}<br>
                <span class="tt-dim">click to zoom in</span>
            `)
            .style("left", `${event.pageX + 14}px`)
            .style("top", `${event.pageY + 14}px`);
    }

    function hideTooltip() {
        tooltip.style("opacity", 0);
    }


    // ---------- ANCHOR: legend ----------

    d3.select("#legend")
        .selectAll(".legend-item")
        .data(SURFACE_ORDER.concat(["unlabelled"]))
        .join("div")
        .attr("class", "legend-item")
        .html(d => `
            <span class="swatch" style="background:${
                SURFACE_COLORS[d] || "#9aa0a6"
            }"></span>${d}
        `);


    // ---------- ANCHOR: wiring ----------
    // Every handler does the same two things: change state, call render.

    d3.select("#cone-filter").on("change", function () {
        state.cone = this.value;
        render();
    });

    d3.select("#surface-filter").on("change", function () {
        state.surface = this.value;
        render();
    });

    d3.select("#type-filter").on("change", function () {
        state.type = this.value;
        render();
    });

    d3.select("#limit-filter").on("change", function () {
        state.limitAuthor = this.value;
        render();
    });

    d3.select("#search").on("input", function () {
        state.search = this.value.trim();
        render();
    });

    d3.select("#show-ratios").on("change", function () {
        state.showRatios = this.checked;
        render();
    });

    d3.select("#show-gloss").on("change", function () {
        state.showGloss = this.checked;
        render();
    });

    d3.select("#reset-zoom").on("click", () => {
        resetZoom();
        render();
    });

    d3.selectAll("#recipe-table th").on("click", function () {
        const key = d3.select(this).attr("data-sort");

        if (state.sortKey === key) {
            state.sortDir = -state.sortDir;
        } else {
            state.sortKey = key;
            state.sortDir = 1;
        }
        render();
    });

    d3.select("#reset").on("click", () => {
        state.cone = "6";
        state.surface = "all";
        state.type = "all";
        state.search = "";
        state.limitAuthor = "none";
        state.selectedId = null;
        state.drillRows = null;

        d3.select("#cone-filter").property("value", "6");
        d3.select("#surface-filter").property("value", "all");
        d3.select("#type-filter").property("value", "all");
        d3.select("#limit-filter").property("value", "none");
        d3.select("#search").property("value", "");

        resetZoom();
        render();
    });


    // ---------- ANCHOR: first paint ----------
    // counterScale() has to run once before the first render, not only from
    // the zoom handler. The region labels get their position AND their angle
    // from the transform it writes, so until it has run once they sit at
    // 0,0 with no rotation - which put every one of them in the top-left
    // corner, clipped out of sight. They only reappeared after the first
    // scroll, which is a horrible way to find a bug.
    counterScale();
    render();

    console.log("recipes:", recipes.length,
                "regions:", regionData.regions.length,
                "limits:", limits.length);
});
