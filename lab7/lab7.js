const width = 900;
const height = 500;

const margin = {
    top: 40,
    right: 40,
    bottom: 70,
    left: 70
};

d3.csv(
    "../data/lab7_historical_weather.csv",
    d => ({
        date: d3.timeParse("%Y-%m-%d")(d.date),
        city: d.city,
        country: d.country,
        temperature_c: +d.temperature_c,
        humidity_pct: +d.humidity_pct,
        wind_speed_mps: +d.wind_speed_mps,
        pressure_hpa: +d.pressure_hpa,
        precipitation_mm: +d.precipitation_mm
    })
)
.then(data => {

    // ---------- Task 4: pick cities and group ----------

    const selectedCities = [
        "Tokyo",
        "London",
        "New York"
    ];

    const filteredData = data.filter(
        d => selectedCities.includes(d.city)
    );

    const grouped = d3.group(
        filteredData,
        d => d.city
    );

    const cityData = grouped.get("Tokyo");
    let currentMetric = "temperature_c";
    const tooltip = d3.select("#tooltip");

    const colorScale = d3.scaleOrdinal()
        .domain(selectedCities)
        .range(d3.schemeTableau10);

    // ---------- SVG ----------

    const svg = d3.select("#chart")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    // ---------- scales (built from all three cities) ----------

    const xScale = d3.scaleTime()
        .domain(
            d3.extent(filteredData, d => d.date)
        )
        .range([
            margin.left,
            width - margin.right
        ]);

    const yScale = d3.scaleLinear()
        .domain(
            d3.extent(
                filteredData,
                d => d.temperature_c
            )
        )
        .nice()
        .range([
            height - margin.bottom,
            margin.top
        ]);

    // ---------- axes ----------

    svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(xScale));

    svg.append("g")
        .attr("class", "y-axis")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(yScale));
    

    // ---------- line generator ----------

    const line = d3.line()
        .x(d => xScale(d.date))
        .y(d => yScale(d.temperature_c));

    // ---------- one line per city ----------

    svg.selectAll(".city-line")
        .data(grouped)
        .join("path")
        .attr("class", "city-line")
        .attr("fill", "none")
        .attr(
            "stroke",
            d => colorScale(d[0])
        )
        .attr("stroke-width", 2)
        .attr(
            "d",
            d => line(d[1])

         
        );

    const legend = svg.append("g")
        .attr(
            "transform",
            `translate(${margin.left + 20}, ${margin.top})`
        );

    const legendItem = legend.selectAll(".legend-item")
        .data(selectedCities)
        .join("g")
        .attr("class", "legend-item")
        .attr(
            "transform",
            (d, i) => `translate(0, ${i * 20})`
        );

    legendItem.append("line")
        .attr("x1", 0)
        .attr("x2", 24)
        .attr("y1", 0)
        .attr("y2", 0)
        .attr("stroke", d => colorScale(d))
        .attr("stroke-width", 2);

    legendItem.append("text")
        .attr("x", 32)
        .attr("y", 4)
        .attr("font-size", "13px")
        .text(d => d);

    d3.select("#metric")
    .on("change", function() {
        updateChart(this.value);
    });

    function updateChart(metric) {

        currentMetric = metric;

        yScale
            .domain(
                d3.extent(
                    filteredData,
                    d => d[metric]
                )
            )
            .nice();
    
        line.y(
            d => yScale(d[metric])
        );

        svg.select(".y-axis")
        .transition()
        .duration(600)
        .call(d3.axisLeft(yScale));
    
        svg.selectAll(".city-line")
            .transition()
            .duration(600)
            .attr(
                "d",
                d => line(d[1])
            );

        showFrame(currentIndex);
    }

    const bisectDate =
    d3.bisector(d => d.date).center;

function moved(event) {

    const [mouseX] = d3.pointer(event);

    const date =
        xScale.invert(mouseX);

        const rows = [];

    grouped.forEach((values, city) => {
        const i = bisectDate(values, date);
        rows.push(values[i]);
    });

    const lines = rows
        .map(
            r =>
                `<span style="color:${colorScale(r.city)}">&#9632;</span> ` +
                `<strong>${r.city}</strong><br>` +
                `Temperature: ${r.temperature_c} °C<br>` +
                `Humidity: ${r.humidity_pct}%<br>` +
                `Wind: ${r.wind_speed_mps} m/s<br>` +
                `Pressure: ${r.pressure_hpa} hPa`
        )
        .join("<br><br>");

    tooltip
        .style("opacity", 1)
        .html(`
            <strong>${d3.timeFormat("%Y-%m-%d")(rows[0].date)}</strong><br>
            ${lines}
        `)
        .style("left", `${event.pageX + 14}px`)
        .style("top", `${event.pageY + 14}px`);
}
    
    // const index =
    //     bisectDate(cityData, date);

    // const d = cityData[index];

    // tooltip
    //     .style("opacity", 1)
    //     .html(`
    //         <strong>${d.city}</strong><br>
    //         ${d3.timeFormat("%Y-%m-%d")(d.date)}<br>
    //         Temperature: ${d.temperature_c} °C<br>
    //         Humidity: ${d.humidity_pct}%<br>
    //         Wind: ${d.wind_speed_mps} m/s<br>
    //         Pressure: ${d.pressure_hpa} hPa
    //     `)
    //     .style("left", `${event.pageX + 14}px`)
    //     .style("top", `${event.pageY + 14}px`);

    
    svg.append("rect")
        .attr("x", margin.left)
        .attr("y", margin.top)
        .attr("width", width - margin.left - margin.right)
        .attr("height", height - margin.top - margin.bottom)
        .attr("fill", "none")
        .attr("pointer-events", "all")
        .on("mousemove", moved)
        .on("mouseleave", () => tooltip.style("opacity", 0));   
    
    
    
function applyRange(startDate, endDate) {

    const rangeData = cityData.filter(
        d =>
            d.date >= startDate &&
            d.date <= endDate
    );

    if (rangeData.length === 0) {
        return;
    }

    xScale.domain(
        d3.extent(rangeData, d => d.date)
    );

    yScale
        .domain(
            d3.extent(rangeData, d => d.temperature_c)
        )
        .nice();
    
        svg.select(".x-axis")
        .transition()
        .duration(600)
        .call(d3.axisBottom(xScale));

    svg.select(".y-axis")
        .transition()
        .duration(600)
        .call(d3.axisLeft(yScale));
    

    svg.selectAll(".city-line")
        .attr("d", d => line(d[1]));
}

d3.select("#apply-range")
    .on("click", function () {

        const s = d3.select("#start-date").property("value");
        const e = d3.select("#end-date").property("value");

        if (!s || !e) {
            return;
        }

        applyRange(new Date(s), new Date(e));
    });
    
    //     const brush = d3.brushX()
    //     .extent([
    //         [margin.left, margin.top],
    //         [
    //             width - margin.right,
    //             height - margin.bottom
    //         ]
    //     ])
    //     .on("end", brushed);
    
    // svg.append("g")
    //     .call(brush);
    
    // function brushed(event) {
    
    //     if (!event.selection) {
    //         return;
    //     }
    
    //     const [x0, x1] =
    //         event.selection;
    
    //     const startDate =
    //         xScale.invert(x0);
    
    //     const endDate =
    //         xScale.invert(x1);
    
    //     console.log(
    //         startDate,
    //         endDate
    //     );
    // }











   
    //animate 
    let currentIndex = 0;
    let timer = null;
    const marker = svg.append("circle")
    .attr("r", 7)
        .attr("fill", "red");
    
    const dateLabel = svg.append("text")
        .attr("x", width - 160)
        .attr("y", 40)
        .attr("font-size", 20);
    
        function showFrame(index) {

            const d = cityData[index];
        
            marker
                .attr(
                    "cx",
                    xScale(d.date)
                )
                .attr(
                    "cy",
                    yScale(d[currentMetric])
                );
        
            dateLabel.text(
                d3.timeFormat("%Y-%m-%d")(
                    d.date
                )
            );
        
            d3.select("#time-slider")
                .property("value", index);
        }
    
        function play() {

            if (timer) return;
        
            timer = d3.interval(
                () => {
        
                    showFrame(currentIndex);
        
                    currentIndex += 1;
        
                    if (
                        currentIndex >=
                        cityData.length
                    ) {
                        pause();
                    }
        
                },
                150
            );
        }
    
        function pause() {

            if (timer) {
                timer.stop();
                timer = null;
            }
        }
    
        function reset() {

            pause();
        
            currentIndex = 0;
        
            showFrame(0);
        }
    
        d3.select("#play")
        .on("click", play);
    
    d3.select("#pause")
        .on("click", pause);
    
    d3.select("#reset")
        .on("click", reset);
    
    d3.select("#time-slider")
        .on("input", function() {
    
            pause();
    
            currentIndex =
                +this.value;
    
            showFrame(currentIndex);
        });
    
    
    
    

 
    
});

// ============================================================
// LAB 7 ASSIGNMENT — Animated Temporal Commercial Network
// Append this to lab7.js, below the tasks code.
// ============================================================

Promise.all([
    d3.csv(
        "../data/lab7_assignment_companies.csv",
        d => ({
            id: d.id,
            company_name: d.company_name,
            sector: d.sector,
            region: d.region
        })
    ),
    d3.csv(
        "../data/lab7_assignment_transactions_60days.csv",
        d => ({
            date: d3.timeParse("%Y-%m-%d")(d.date),
            day: +d.day,
            source_id: d.source,
            target_id: d.target,
            amount_usd: +d.amount_usd,
            transaction_type: d.transaction_type,
            transaction_count: +d.transaction_count
        })
    )
])
.then(([companies, transactions]) => {

    const netWidth = 900;
    const netHeight = 620;
    const netMargin = { top: 30, right: 210, bottom: 30, left: 30 };

    const totalDays = 60;

    let currentDay = 1;
    let netTimer = null;

    const companyById = new Map(
        companies.map(c => [c.id, c])
    );


    // ========================================================
    // SCALES
    // ========================================================

    const sectors = Array.from(
        new Set(companies.map(d => d.sector))
    ).sort(d3.ascending);

    const regions = Array.from(
        new Set(companies.map(d => d.region))
    ).sort(d3.ascending);

    const types = Array.from(
        new Set(transactions.map(d => d.transaction_type))
    ).sort(d3.ascending);

    const sectorColor = d3.scaleOrdinal()
        .domain(sectors)
        .range(d3.schemeTableau10);

    const typeColor = d3.scaleOrdinal()
        .domain(types)
        .range(d3.schemeSet2);

    const shapeList = [
        d3.symbolCircle,
        d3.symbolSquare,
        d3.symbolTriangle,
        d3.symbolDiamond,
        d3.symbolWye
    ];

    const regionShape = d3.scaleOrdinal()
        .domain(regions)
        .range(shapeList);

    const symbolGen = d3.symbol();

    // the busiest single-day volume any company reaches,
    // so node size is comparable across all 60 days
    const maxDailyVolume = d3.max(
        d3.range(1, totalDays + 1),
        day => {
            const dayRows = transactions.filter(t => t.day === day);
            return d3.max(companies, c =>
                d3.sum(
                    dayRows.filter(
                        t => t.source_id === c.id || t.target_id === c.id
                    ),
                    t => t.amount_usd
                )
            );
        }
    );

    // area proportional to volume, with a floor so idle
    // companies stay visible
    const sizeScale = d3.scaleLinear()
        .domain([0, maxDailyVolume])
        .range([170, 1500]);

    const widthScale = d3.scaleLinear()
        .domain(d3.extent(transactions, d => d.amount_usd))
        .range([1.5, 7]);


    // ========================================================
    // SVG
    // ========================================================

    const netSvg = d3.select("#assignment-network")
        .append("svg")
        .attr("width", netWidth)
        .attr("height", netHeight);

    const linkGroup = netSvg.append("g").attr("class", "a-links");
    const nodeGroup = netSvg.append("g").attr("class", "a-nodes");
    const labelGroup = netSvg.append("g").attr("class", "a-labels");

    const netTooltip = d3.select("#a-tooltip");

    const dayLabel = netSvg.append("text")
        .attr("x", 20)
        .attr("y", 34)
        .attr("font-size", 22)
        .attr("font-weight", "bold")
        .attr("fill", "#333");


    // ========================================================
    // PART D — MENTAL MAP
    //
    // Settle the layout ONCE on the aggregate 60-day network,
    // remember each node's home position, then anchor nodes to
    // home with weak forces. Days change which links are drawn,
    // not where companies live.
    // ========================================================

    const aggregateLinks = Array.from(
        d3.group(
            transactions,
            d => `${d.source_id}|${d.target_id}`
        ),
        ([key, rows]) => ({
            source: rows[0].source_id,
            target: rows[0].target_id,
            weight: d3.sum(rows, r => r.amount_usd)
        })
    );

    const simulation = d3.forceSimulation(companies)
        .force(
            "link",
            d3.forceLink(aggregateLinks)
                .id(d => d.id)
                .distance(120)
        )
        .force("charge", d3.forceManyBody().strength(-620))
        .force(
            "center",
            d3.forceCenter(
                (netWidth - netMargin.right) / 2,
                netHeight / 2
            )
        )
        .force("collide", d3.forceCollide(42))
        .stop();

    // run it synchronously so the layout is settled before
    // the first frame is ever drawn
    for (let i = 0; i < 400; i += 1) {
        simulation.tick();
    }

    companies.forEach(c => {
        c.home_x = c.x;
        c.home_y = c.y;
    });

    // now anchor to home and swap in per-day links
    simulation
        .force(
            "link",
            d3.forceLink([])
                .id(d => d.id)
                .distance(120)
        )
        .force("x", d3.forceX(d => d.home_x).strength(0.35))
        .force("y", d3.forceY(d => d.home_y).strength(0.35))
        .on("tick", ticked);


    function ticked() {

        linkGroup.selectAll("line")
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        nodeGroup.selectAll(".a-node")
            .attr(
                "transform",
                d => `translate(${d.x}, ${d.y})`
            );

        labelGroup.selectAll(".a-label")
            .attr("x", d => d.x)
            .attr("y", d => d.y + 30);
    }


    // ========================================================
    // PART B — dynamic node volume
    // ========================================================

    function calculateVolume(companyId, currentLinks) {

        return d3.sum(
            currentLinks.filter(
                d =>
                    d.source_id === companyId ||
                    d.target_id === companyId
            ),
            d => d.amount_usd
        );
    }


    // ========================================================
    // PART A + C — draw one day
    // ========================================================

    function showDay(day) {

        // fresh copies: forceLink overwrites source/target with
        // node objects, and we must not corrupt the raw rows
        const currentLinks = transactions
        .filter(d => d.day === day)
        .map(d => ({
            ...d,
            source: d.source_id,
            target: d.target_id
        }));

        const volumeById = new Map(
            companies.map(
                c => [c.id, calculateVolume(c.id, currentLinks)]
            )
        );

        // ---------- links: enter fades in, exit fades out ----------

        linkGroup.selectAll("line")
            .data(
                currentLinks,
                d => `${d.source_id}-${d.target_id}`
            )
            .join(
                enter =>
                    enter
                    .append("line")
                    .attr("stroke", d => typeColor(d.transaction_type))
                    .attr("stroke-width", d => widthScale(d.amount_usd))
                    .attr("stroke-linecap", "round")
                    .attr("opacity", 0)
                    .call(
                        e =>
                            e.transition()
                            .duration(400)
                            .attr("opacity", 0.75)
                    ),

                update =>
                    update
                    .attr("stroke", d => typeColor(d.transaction_type))
                    .attr("stroke-width", d => widthScale(d.amount_usd)),

                exit =>
                    exit
                    .transition()
                    .duration(400)
                    .attr("opacity", 0)
                    .remove()
            )
            .on("mouseover", function (event, d) {
                netTooltip
                    .style("opacity", 1)
                    .html(`
                        <strong>${companyById.get(d.source_id).company_name}</strong>
                        &harr;
                        <strong>${companyById.get(d.target_id).company_name}</strong><br>
                        Day ${d.day} &middot; ${d3.timeFormat("%Y-%m-%d")(d.date)}<br>
                        Type: ${d.transaction_type}<br>
                        Amount: $${d.amount_usd.toLocaleString()}<br>
                        Transactions: ${d.transaction_count}
                    `);
            })
            .on("mousemove", moveNetTooltip)
            .on("mouseout", hideNetTooltip);

        // ---------- nodes ----------

        nodeGroup.selectAll(".a-node")
            .data(companies, d => d.id)
            .join(
                enter =>
                    enter
                    .append("path")
                    .attr("class", "a-node")
                    .attr("fill", d => sectorColor(d.sector))
                    .attr("cursor", "pointer")
            )
            .attr("stroke", "#fff")
            .on("mouseover", function (event, d) {
                const vol = volumeById.get(d.id);
                netTooltip
                    .style("opacity", 1)
                    .html(`
                        <strong>${d.company_name}</strong><br>
                        Sector: ${d.sector}<br>
                        Region: ${d.region}<br>
                        Volume on day ${day}:
                        $${vol.toLocaleString()}<br>
                        Partners today: ${
                            currentLinks.filter(
                                l =>
                                    l.source_id === d.id ||
                                    l.target_id === d.id
                            ).length
                        }
                    `);
            })
            .on("mousemove", moveNetTooltip)
            .on("mouseout", hideNetTooltip)
            .transition()
            .duration(350)
            .attr(
                "d",
                d =>
                    symbolGen
                        .type(regionShape(d.region))
                        .size(sizeScale(volumeById.get(d.id)))()
            )
            // active companies get a stronger outline
            .attr(
                "stroke-width",
                d => volumeById.get(d.id) > 0 ? 3 : 1
            )
            .attr(
                "opacity",
                d => volumeById.get(d.id) > 0 ? 1 : 0.45
            );

        // ---------- labels ----------

        labelGroup.selectAll(".a-label")
            .data(companies, d => d.id)
            .join("text")
            .attr("class", "a-label")
            .attr("text-anchor", "middle")
            .attr("font-size", 10)
            .attr("fill", "#444")
            .text(d => d.company_name);

        // ---------- gentle restart, not a rebuild ----------

        simulation.force("link").links(currentLinks);

        simulation
            .nodes(companies)
            .alpha(0.25)
            .restart();

        // ---------- day label, slider, summary ----------

        const dayDate = currentLinks.length > 0
            ? d3.timeFormat("%Y-%m-%d")(currentLinks[0].date)
            : "";

        dayLabel.text(`Day ${day}${dayDate ? "  ·  " + dayDate : ""}`);

        d3.select("#a-slider").property("value", day);

        d3.select("#a-day-label")
            .text(`Day ${day} of ${totalDays}${dayDate ? " — " + dayDate : ""}`);

        const totalValue = d3.sum(
            currentLinks,
            d => d.amount_usd
        );

        const activeCompanies = new Set(
            currentLinks.flatMap(
                d => [d.source_id, d.target_id]
            )
        ).size;

        d3.select("#a-summary").html(`
            Active companies: <strong>${activeCompanies}</strong> of ${companies.length}
            &nbsp;&middot;&nbsp;
            Active relationships: <strong>${currentLinks.length}</strong>
            &nbsp;&middot;&nbsp;
            Total value: <strong>$${totalValue.toLocaleString()}</strong>
        `);

        overviewMarker
            .attr("x1", overviewX(day))
            .attr("x2", overviewX(day));
    }


    function moveNetTooltip(event) {
        netTooltip
            .style("left", `${event.pageX + 14}px`)
            .style("top", `${event.pageY + 14}px`);
    }

    function hideNetTooltip() {
        netTooltip.style("opacity", 0);
    }


    // ========================================================
    // OVERVIEW — links per day across all 60 days
    //
    // Animation alone makes distant comparison hard, so this
    // static overview answers "how does connectivity change?"
    // at a glance while the animation shows structure.
    // ========================================================

    const ovWidth = 900;
    const ovHeight = 140;
    const ovMargin = { top: 16, right: 20, bottom: 30, left: 50 };

    const perDay = d3.range(1, totalDays + 1).map(day => {
        const rows = transactions.filter(t => t.day === day);
        return {
            day: day,
            links: rows.length,
            value: d3.sum(rows, r => r.amount_usd)
        };
    });

    const ovSvg = d3.select("#assignment-overview")
        .append("svg")
        .attr("width", ovWidth)
        .attr("height", ovHeight);

    const overviewX = d3.scaleLinear()
        .domain([1, totalDays])
        .range([ovMargin.left, ovWidth - ovMargin.right]);

    const overviewY = d3.scaleLinear()
        .domain([0, d3.max(perDay, d => d.links)])
        .nice()
        .range([ovHeight - ovMargin.bottom, ovMargin.top]);

    ovSvg.append("path")
        .datum(perDay)
        .attr("fill", "none")
        .attr("stroke", "#5b8fb9")
        .attr("stroke-width", 2)
        .attr(
            "d",
            d3.line()
                .x(d => overviewX(d.day))
                .y(d => overviewY(d.links))
        );

    ovSvg.append("g")
        .attr(
            "transform",
            `translate(0,${ovHeight - ovMargin.bottom})`
        )
        .call(
            d3.axisBottom(overviewX)
                .ticks(12)
                .tickFormat(d3.format("d"))
        );

    ovSvg.append("g")
        .attr("transform", `translate(${ovMargin.left},0)`)
        .call(d3.axisLeft(overviewY).ticks(4));

    ovSvg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -ovHeight / 2)
        .attr("y", 14)
        .attr("text-anchor", "middle")
        .attr("font-size", 11)
        .text("Links");

    const overviewMarker = ovSvg.append("line")
        .attr("y1", ovMargin.top)
        .attr("y2", ovHeight - ovMargin.bottom)
        .attr("stroke", "#c0504d")
        .attr("stroke-width", 2);

    // click the overview to jump to a day
    ovSvg.append("rect")
        .attr("x", ovMargin.left)
        .attr("y", ovMargin.top)
        .attr("width", ovWidth - ovMargin.left - ovMargin.right)
        .attr("height", ovHeight - ovMargin.top - ovMargin.bottom)
        .attr("fill", "none")
        .attr("pointer-events", "all")
        .attr("cursor", "pointer")
        .on("click", function (event) {
            const [mx] = d3.pointer(event);
            const day = Math.round(overviewX.invert(mx));
            netPause();
            currentDay = Math.max(1, Math.min(totalDays, day));
            showDay(currentDay);
        });


    // ========================================================
    // PART C — play, pause, reset, slider
    // ========================================================

    function netPlay() {

        if (netTimer) {
            return;
        }

        netTimer = d3.interval(
            () => {

                showDay(currentDay);

                currentDay += 1;

                if (currentDay > totalDays) {
                    currentDay = totalDays;
                    netPause();
                }
            },
            600
        );
    }


    function netPause() {

        if (netTimer) {
            netTimer.stop();
            netTimer = null;
        }
    }


    function netReset() {

        netPause();
        currentDay = 1;
        showDay(1);
    }


    d3.select("#a-play").on("click", netPlay);
    d3.select("#a-pause").on("click", netPause);
    d3.select("#a-reset").on("click", netReset);

    d3.select("#a-slider")
        .attr("min", 1)
        .attr("max", totalDays)
        .on("input", function () {
            netPause();
            currentDay = +this.value;
            showDay(currentDay);
        });


    // ========================================================
    // LEGEND
    // ========================================================

    const legend = netSvg.append("g")
        .attr(
            "transform",
            `translate(${netWidth - netMargin.right + 20}, 50)`
        );

    let ly = 0;

    legend.append("text")
        .attr("y", ly)
        .attr("font-weight", "bold")
        .attr("font-size", 12)
        .text("Sector — colour");

    sectors.forEach((sector, i) => {
        legend.append("circle")
            .attr("cx", 7)
            .attr("cy", ly + 16 + i * 18)
            .attr("r", 6)
            .attr("fill", sectorColor(sector));
        legend.append("text")
            .attr("x", 20)
            .attr("y", ly + 20 + i * 18)
            .attr("font-size", 11)
            .text(sector);
    });

    ly += 28 + sectors.length * 18;

    legend.append("text")
        .attr("y", ly)
        .attr("font-weight", "bold")
        .attr("font-size", 12)
        .text("Region — shape");

    regions.forEach((region, i) => {
        legend.append("path")
            .attr(
                "d",
                symbolGen.type(regionShape(region)).size(110)()
            )
            .attr(
                "transform",
                `translate(8, ${ly + 16 + i * 18})`
            )
            .attr("fill", "#888");
        legend.append("text")
            .attr("x", 20)
            .attr("y", ly + 20 + i * 18)
            .attr("font-size", 11)
            .text(region);
    });

    ly += 28 + regions.length * 18;

    legend.append("text")
        .attr("y", ly)
        .attr("font-weight", "bold")
        .attr("font-size", 12)
        .text("Transaction type — link colour");

    types.forEach((type, i) => {
        legend.append("line")
            .attr("x1", 0)
            .attr("x2", 16)
            .attr("y1", ly + 16 + i * 18)
            .attr("y2", ly + 16 + i * 18)
            .attr("stroke", typeColor(type))
            .attr("stroke-width", 3);
        legend.append("text")
            .attr("x", 22)
            .attr("y", ly + 20 + i * 18)
            .attr("font-size", 11)
            .text(type);
    });

    ly += 28 + types.length * 18;

    legend.append("text")
        .attr("y", ly)
        .attr("font-weight", "bold")
        .attr("font-size", 12)
        .text("Node size — daily volume");

    legend.append("text")
        .attr("y", ly + 16)
        .attr("font-size", 11)
        .text("Link width — amount");

    legend.append("text")
        .attr("y", ly + 32)
        .attr("font-size", 11)
        .text("Faded — inactive today");


    // ========================================================
    // START
    // ========================================================

    showDay(1);

});
