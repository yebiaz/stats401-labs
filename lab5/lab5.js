//do the nodes need labels 
// // make district a categorical color 
// passengers be size of node 
// station type be shape 
// travel time link be thickness of link 
// metro express or shuttle solid, dashed, or dotted (is this separable from travel time link)




//promise because wait for nodes then links to finish 
Promise.all([
    d3.csv(
        "../data/lab5_assignment_stations.csv",
        d => ({
            id: d.id,
            station_name: d.station_name,
            district: d.district,
            daily_passengers: +d.daily_passengers,
            station_type: d.station_type
        })
    ),
    d3.csv(
        "../data/lab5_assignment_routes.csv",
        d => ({
            source: d.source,
            target: d.target,
            travel_time_min: +d.travel_time_min,
            route_type: d.route_type
        })
    )
])
    .then(([nodes, links]) => {

        const width = 950;
        const height = 700;

        const svg = d3.select("#network")
            .append("svg")
            .attr("width", width)
            .attr("height", height);

        const tooltip = d3.select("#tooltip");

        // ---------- scales ----------

        const districts = Array.from(
            new Set(nodes.map(d => d.district))
        ).sort(d3.ascending);

        const colorScale = d3.scaleOrdinal()
            .domain(districts)
            .range(d3.schemeTableau10);

        // area proportional to passengers, so sqrt
        const sizeScale = d3.scaleSqrt()
            .domain([0, d3.max(nodes, d => d.daily_passengers)])
            .range([0, 400]);

        const shapeByType = {
            Local: d3.symbolCircle,
            Transfer: d3.symbolSquare,
            Terminal: d3.symbolTriangle
        };

        const symbolGenerator = d3.symbol();

        // shorter travel time reads as a stronger connection
        const widthScale = d3.scaleLinear()
            .domain(d3.extent(links, d => d.travel_time_min))
            .range([5, 1]);

        const dashByRoute = {
            Metro: null,
            Express: "8 4",
            Shuttle: "2 3"
        };

        // ---------- simulation ----------

        const simulation = d3.forceSimulation(nodes)
            .force(
                "link",
                d3.forceLink(links)
                    .id(d => d.id)
                    .distance(15) //(d => 40 + d.travel_time_min * 3)
            )
            .force(
                "charge",
                d3.forceManyBody().strength(-120)
            )
            .force(
                "center",
                d3.forceCenter(width / 2 + 90, height / 2)
            )
            .force(
                "collide",
                d3.forceCollide(
                    d => Math.sqrt(sizeScale(d.daily_passengers)) + 6
                )
            );

        // ---------- links ----------

        const link = svg.append("g")
            .attr("class", "links")
            .selectAll("line")
            .data(links)
            .join("line")
            .attr("stroke", "#999")
            .attr("stroke-opacity", 0.6)
            .attr(
                "stroke-width",
                d => widthScale(d.travel_time_min)
            )
            .attr(
                "stroke-dasharray",
                d => dashByRoute[d.route_type]
            );
        


        // ---------- nodes ----------

        const node = svg.append("g")
            .attr("class", "nodes")
            .selectAll("path")
            .data(nodes)
            .join("path")
            .attr(
                "d",
                d => symbolGenerator
                    .type(shapeByType[d.station_type])
                    .size(sizeScale(d.daily_passengers))()
            )
            .attr("fill", d => colorScale(d.district))
            .attr("stroke", "#fff")
            .attr("stroke-width", 1.5)
            
            .on("mouseover", function (event, d) {
                //d3.select(this).attr("stroke", "#000");
                
                node.attr(
                    "opacity",
                    other =>
                        other === d || isConnected(d, other) ? 1 : 0.15
                );

                link.attr(
                    "stroke-opacity",
                    l =>
                        l.source.id === d.id || l.target.id === d.id ? 0.9 : 0.05
                );

                tooltip.style("opacity", 1).html(`
            <strong>${d.station_name}</strong><br>
            District: ${d.district}<br>
            Type: ${d.station_type}<br>
            Daily passengers: ${d.daily_passengers.toLocaleString()}
            `           );
            })
            .on("mousemove", function (event) {
                tooltip
                    .style("left", `${event.pageX + 12}px`)
                    .style("top", `${event.pageY + 12}px`);
            })
            .on("mouseout", function () {
                //d3.select(this).attr("stroke", "#fff");
                node.attr("opacity", 1);
                link.attr("stroke-opacity", 0.6);
                tooltip.style("opacity", 0);
            })
            .call(
                d3.drag()
                    .on("start", function (event, d) {
                        if (!event.active) {
                            simulation.alphaTarget(0.3).restart();
                        }
                        d.fx = d.x;
                        d.fy = d.y;
                    })
                    .on("drag", function (event, d) {
                        d.fx = event.x;
                        d.fy = event.y;
                    })
                    .on("end", function (event, d) {
                        if (!event.active) {
                            simulation.alphaTarget(0);
                        }
                        d.fx = null;
                        d.fy = null;
                    })
            
            );

        function isConnected(a, b) {
            return links.some(
                link =>
                    (link.source.id === a.id && link.target.id === b.id) ||
                    (link.source.id === b.id && link.target.id === a.id)
            );
        }
        


        // ---------- tick ----------

        simulation.on(
            "tick",
            () => {

                link
                    .attr("x1", d => d.source.x)
                    .attr("y1", d => d.source.y)
                    .attr("x2", d => d.target.x)
                    .attr("y2", d => d.target.y);

                node
                    .attr(
                        "transform",
                        d => `translate(${d.x}, ${d.y})`
                    );
            }
        );

        // ---------- legends ----------

        const legend = svg.append("g")
            .attr("transform", "translate(20, 20)");

        legend.append("text")
            .attr("font-weight", "bold")
            .attr("font-size", "13px")
            .text("District");

        legend.selectAll(".district-key")
            .data(districts)
            .join("circle")
            .attr("class", "district-key")
            .attr("cx", 8)
            .attr("cy", (d, i) => 20 + i * 22)
            .attr("r", 7)
            .attr("fill", d => colorScale(d));

        legend.selectAll(".district-label")
            .data(districts)
            .join("text")
            .attr("class", "district-label")
            .attr("x", 24)
            .attr("y", (d, i) => 24 + i * 22)
            .attr("font-size", "12px")
            .text(d => d);

        const typeLegend = legend.append("g")
            .attr(
                "transform",
                `translate(0, ${40 + districts.length * 22})`
            );

        typeLegend.append("text")
            .attr("font-weight", "bold")
            .attr("font-size", "13px")
            .text("Station type");

        const types = ["Local", "Transfer", "Terminal"];

        typeLegend.selectAll(".type-key")
            .data(types)
            .join("path")
            .attr("class", "type-key")
            .attr(
                "d",
                d => d3.symbol()
                    .type(shapeByType[d])
                    .size(150)()
            )
            .attr(
                "transform",
                (d, i) => `translate(8, ${22 + i * 22})`
            )
            .attr("fill", "#777");

        typeLegend.selectAll(".type-label")
            .data(types)
            .join("text")
            .attr("class", "type-label")
            .attr("x", 24)
            .attr("y", (d, i) => 26 + i * 22)
            .attr("font-size", "12px")
            .text(d => d);

        const routeLegend = typeLegend.append("g")
            .attr("transform", "translate(0, 100)");

        routeLegend.append("text")
            .attr("font-weight", "bold")
            .attr("font-size", "13px")
            .text("Route type");

        const routes = ["Metro", "Express", "Shuttle"];

        routeLegend.selectAll(".route-key")
            .data(routes)
            .join("line")
            .attr("class", "route-key")
            .attr("x1", 0)
            .attr("x2", 30)
            .attr("y1", (d, i) => 20 + i * 22)
            .attr("y2", (d, i) => 20 + i * 22)
            .attr("stroke", "#777")
            .attr("stroke-width", 2.5)
            .attr("stroke-dasharray", d => dashByRoute[d]);

        routeLegend.selectAll(".route-label")
            .data(routes)
            .join("text")
            .attr("class", "route-label")
            .attr("x", 38)
            .attr("y", (d, i) => 24 + i * 22)
            .attr("font-size", "12px")
            .text(d => d);
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
        // ================= ADJACENCY MATRIX =================

        const cellSize = 16;
        const matrixMargin = { top: 140, left: 140 };

        // sorting by district groups same-district stations together,
        // so within-district clustering appears as blocks
        const ordered = nodes.slice().sort(
            (a, b) =>
                d3.ascending(a.district, b.district) ||
                d3.ascending(a.station_name, b.station_name)
        );

        const ids = ordered.map(d => d.id);

        const nodeById = new Map(
            nodes.map(d => [d.id, d])
        );

        const gridSize = ids.length * cellSize;

        const matrixWidth = matrixMargin.left + gridSize + 300;
        const matrixHeight = matrixMargin.top + gridSize + 40;

        const matrixSvg = d3.select("#matrix")
            .append("svg")
            .attr("width", matrixWidth)
            .attr("height", matrixHeight);

        const matrixGroup = matrixSvg.append("g")
            .attr(
                "transform",
                `translate(${matrixMargin.left}, ${matrixMargin.top})`
            );

        const matrixX = d3.scaleBand()
            .domain(ids)
            .range([0, gridSize]);

        const matrixY = d3.scaleBand()
            .domain(ids)
            .range([0, gridSize]);

        // ---------- cell data ----------

        const routeLetter = {
            Metro: "M",
            Express: "E",
            Shuttle: "S"
        };

        const linkLookup = new Map();

        links.forEach(l => {
            const s = l.source.id || l.source;
            const t = l.target.id || l.target;
            linkLookup.set(`${s}|${t}`, l);
            linkLookup.set(`${t}|${s}`, l);
        });

        const matrixData = [];

        ids.forEach(row => {
            ids.forEach(col => {
                matrixData.push({
                    row: row,
                    col: col,
                    link: linkLookup.get(`${row}|${col}`) || null
                });
            });
        });

        // shorter travel time reads as a closer connection
        const cellOpacity = d3.scaleLinear()
            .domain(d3.extent(links, d => d.travel_time_min))
            .range([1, 0.22]);

        // ---------- cells ----------

        const cells = matrixGroup
            .selectAll(".cell")
            .data(matrixData)
            .join("g")
            .attr("class", "cell")
            .attr(
                "transform",
                d => `translate(${matrixX(d.col)}, ${matrixY(d.row)})`
            );

        cells.append("rect")
            .attr("width", matrixX.bandwidth())
            .attr("height", matrixY.bandwidth())
            .attr("stroke", "#fff")
            .attr("stroke-width", 0.5)
            .attr(
                "fill",
                d => d.link ? "steelblue" : "#f4f4f4"
            )
            .attr(
                "fill-opacity",
                d => d.link
                    ? cellOpacity(d.link.travel_time_min)
                    : 1
            );

            cells.filter(d => d.link)
            .append("text")
            .attr("x", matrixX.bandwidth() / 2)
            .attr("y", matrixY.bandwidth() / 2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            .attr("font-size", Math.max(8, cellSize - 7))
            .attr("font-weight", "bold")
            .attr("fill", "#000")
            .text(d => routeLetter[d.link.route_type]);

        cells.on("mouseover", function (event, d) {
            if (!d.link) {
                return;
            }
            tooltip.style("opacity", 1).html(`
        <strong>${nodeById.get(d.row).station_name}</strong>
        &harr;
        <strong>${nodeById.get(d.col).station_name}</strong><br>
        Route: ${d.link.route_type}<br>
        Travel time: ${d.link.travel_time_min} min
    `);
        })
            .on("mousemove", function (event) {
                tooltip
                    .style("left", `${event.pageX + 12}px`)
                    .style("top", `${event.pageY + 12}px`);
            })
            .on("mouseout", function () {
                tooltip.style("opacity", 0);
            });

        // ---------- label encodings ----------

        const styleByType = {
            Local: { weight: "normal", style: "normal" , decoration: "none"},
            Transfer: { weight: "bold", style: "normal" , decoration: "none"},
            Terminal: { weight: "normal", style: "italic", decoration: "underline"}
        };

        const passengerRadius = d3.scaleQuantile()
            .domain(nodes.map(d => d.daily_passengers))
            .range([2.5, 4.5, 6.5]);

        const labelFont = Math.max(8, cellSize - 6);

        // ---------- row labels ----------

        const rowLabels = matrixGroup
            .selectAll(".row-label")
            .data(ids)
            .join("g")
            .attr("class", "row-label")
            .attr(
                "transform",
                d => `translate(-8, ${matrixY(d) + cellSize / 2})`
            );

        rowLabels.append("circle")
            .attr("cx", -6)
            .attr("cy", 0)
            .attr(
                "r",
                d => passengerRadius(nodeById.get(d).daily_passengers)
            )
            .attr("fill", d => colorScale(nodeById.get(d).district));

        rowLabels.append("text")
            .attr("x", -16)
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "central")
            .attr("font-size", labelFont)
            .attr("fill", d => colorScale(nodeById.get(d).district))
            .attr(
                "font-weight",
                d => styleByType[nodeById.get(d).station_type].weight
            )
            .attr(
                "font-style",
                d => styleByType[nodeById.get(d).station_type].style
        )
            .attr(
            "text-decoration",
            d => styleByType[nodeById.get(d).station_type].decoration
        )
            .text(d => nodeById.get(d).station_name);

        // ---------- column labels ----------

        const colLabels = matrixGroup
            .selectAll(".col-label")
            .data(ids)
            .join("g")
            .attr("class", "col-label")
            .attr(
                "transform",
                d =>
                    `translate(${matrixX(d) + cellSize / 2}, -8) rotate(-90)`
            );

        colLabels.append("circle")
            .attr("cx", 6)
            .attr("cy", 0)
            .attr(
                "r",
                d => passengerRadius(nodeById.get(d).daily_passengers)
            )
            .attr("fill", d => colorScale(nodeById.get(d).district));

        colLabels.append("text")
            .attr("x", 16)
            .attr("text-anchor", "start")
            .attr("dominant-baseline", "central")
            .attr("font-size", labelFont)
            .attr("fill", d => colorScale(nodeById.get(d).district))
            .attr(
                "font-weight",
                d => styleByType[nodeById.get(d).station_type].weight
            )
            .attr(
                "font-style",
                d => styleByType[nodeById.get(d).station_type].style
        )
        .attr(
            "text-decoration",
            d => styleByType[nodeById.get(d).station_type].decoration
        )
            .text(d => nodeById.get(d).station_name);

        // ================= MATRIX LEGEND =================

        const mLegend = matrixSvg.append("g")
            .attr(
                "transform",
                `translate(${matrixMargin.left + gridSize + 50}, ${matrixMargin.top})`
            );

        let legendY = 0;

        // --- district (label colour) ---

        mLegend.append("text")
            .attr("y", legendY)
            .attr("font-weight", "bold")
            .attr("font-size", "13px")
            .text("District — label colour");

        districts.forEach((district, i) => {
            mLegend.append("text")
                .attr("x", 4)
                .attr("y", legendY + 20 + i * 18)
                .attr("font-size", "12px")
                .attr("fill", colorScale(district))
                .text(district);
        });

        legendY += 30 + districts.length * 18;

        // --- station type (font style) ---

        mLegend.append("text")
            .attr("y", legendY)
            .attr("font-weight", "bold")
            .attr("font-size", "13px")
            .text("Station type — label style");

        ["Local", "Transfer", "Terminal"].forEach((type, i) => {
            mLegend.append("text")
                .attr("x", 4)
                .attr("y", legendY + 20 + i * 18)
                .attr("font-size", "12px")
                .attr("fill", "#333")
                .attr("font-weight", styleByType[type].weight)
                .attr("font-style", styleByType[type].style)
                .attr("text-decoration", styleByType[type].decoration)
                .text(type);
        });

        legendY += 30 + 3 * 18;

        // --- passengers (dot size) ---

        mLegend.append("text")
            .attr("y", legendY)
            .attr("font-weight", "bold")
            .attr("font-size", "13px")
            .text("Daily passengers — dot size");

        const cuts = passengerRadius.quantiles();

        const passengerKeys = [
            { r: 2.5, label: `under ${Math.round(cuts[0]).toLocaleString()}` },
            { r: 4.5, label: `${Math.round(cuts[0]).toLocaleString()} – ${Math.round(cuts[1]).toLocaleString()}` },
            { r: 6.5, label: `over ${Math.round(cuts[1]).toLocaleString()}` }
        ];

        passengerKeys.forEach((key, i) => {
            mLegend.append("circle")
                .attr("cx", 8)
                .attr("cy", legendY + 18 + i * 20)
                .attr("r", key.r)
                .attr("fill", "#777");

            mLegend.append("text")
                .attr("x", 22)
                .attr("y", legendY + 22 + i * 20)
                .attr("font-size", "12px")
                .attr("fill", "#333")
                .text(key.label);
        });

        legendY += 30 + 3 * 20;

        // --- route type (letter) ---

        mLegend.append("text")
            .attr("y", legendY)
            .attr("font-weight", "bold")
            .attr("font-size", "13px")
            .text("Route type — cell letter");

        ["Metro", "Express", "Shuttle"].forEach((route, i) => {
            const y = legendY + 12 + i * 22;

            mLegend.append("rect")
                .attr("x", 0)
                .attr("y", y)
                .attr("width", 16)
                .attr("height", 16)
                .attr("fill", "steelblue")
                .attr("fill-opacity", 0.7)
                .attr("stroke", "#fff");

            mLegend.append("text")
                .attr("x", 8)
                .attr("y", y + 8)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "central")
                .attr("font-size", "10px")
                .attr("font-weight", "bold")
                .attr("fill", "#fff")
                .text(routeLetter[route]);

            mLegend.append("text")
                .attr("x", 24)
                .attr("y", y + 12)
                .attr("font-size", "12px")
                .attr("fill", "#333")
                .text(route);
        });

        legendY += 30 + 3 * 22;

        // --- travel time (opacity) ---

        mLegend.append("text")
            .attr("y", legendY)
            .attr("font-weight", "bold")
            .attr("font-size", "13px")
            .text("Travel time — cell opacity");

        const timeExtent = d3.extent(links, d => d.travel_time_min);

        const timeSteps = d3.range(0, 6).map(
            i => timeExtent[0] + (i / 5) * (timeExtent[1] - timeExtent[0])
        );

        timeSteps.forEach((t, i) => {
            mLegend.append("rect")
                .attr("x", i * 20)
                .attr("y", legendY + 12)
                .attr("width", 20)
                .attr("height", 18)
                .attr("fill", "steelblue")
                .attr("fill-opacity", cellOpacity(t))
                .attr("stroke", "#fff")
                .attr("stroke-width", 0.5);
        });

        mLegend.append("text")
            .attr("x", 0)
            .attr("y", legendY + 44)
            .attr("font-size", "11px")
            .attr("fill", "#333")
            .text(`${timeExtent[0]} min`);

        mLegend.append("text")
            .attr("x", 120)
            .attr("y", legendY + 44)
            .attr("text-anchor", "end")
            .attr("font-size", "11px")
            .attr("fill", "#333")
            .text(`${timeExtent[1]} min`);

    });



