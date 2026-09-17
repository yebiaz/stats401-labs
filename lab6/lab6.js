const width = 1000;
const height = 650;

const treemapWidth = 900;
const treemapHeight = 550;


d3.json(
    "../data/lab6_small_hierarchy.json"
)
.then(data => {

    const root = d3.hierarchy(data);

    console.log(root);
    console.log(root.descendants());

    root.sum(
        d => d.value || 0
    );

    console.log(root.value);

    const treeLayout = d3.tree()
        .size([
            height - 100,
            width - 250
        ]);

    const treeSvg = d3.select("#tree")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    const treeGroup = treeSvg
        .append("g")
        .attr(
            "transform",
            "translate(100,50)"
        );

    function updateTree() {

        // recompute positions for the CURRENT tree shape
        treeLayout(root);

        treeGroup
            .selectAll(".link")
            .data(root.links())
            .join("path")
            .attr("class", "link")
            .attr("fill", "none")
            .attr("stroke", "#999")
            .attr(
                "d",
                d3.linkHorizontal()
                    .x(d => d.y)
                    .y(d => d.x)
            );


        const nodes = treeGroup
            .selectAll(".node")
            .data(root.descendants())
            .join("g")
            .attr("class", "node")
            .attr("cursor", "pointer")
            .attr(
                "transform",
                d => `translate(${d.y}, ${d.x})`
            );

        // one circle per node group
        nodes
            .selectAll("circle")
            .data(d => [d])
            .join("circle")
            .attr("r", 6)
            .attr(
                "fill",
                d =>
                    d.children || d._children
                    ? "steelblue"
                    : "orange"
            );

        // one label per node group
        nodes
            .selectAll("text")
            .data(d => [d])
            .join("text")
            .attr("x", 10)
            .attr("dy", "0.35em")
            .attr("font-size", "12px")
            .text(d => d.data.name);


        nodes.on("click", toggleNode);
    }


    function toggleNode(event, d) {

        if (d.children) {

            d._children = d.children;
            d.children = null;

        } else {

            d.children = d._children;
            d._children = null;
        }

        updateTree();
    }


    // first draw
    updateTree();


    const treemapRoot = d3.hierarchy(data)
        .sum(
            d => d.value || 0
        )
        .sort(
            (a, b) => b.value - a.value
        );

    const treemapLayout = d3.treemap()
        .tile(d3.treemapSquarify)
        .size([
            treemapWidth,
            treemapHeight
        ])
        .paddingInner(2)
        .paddingOuter(4);

    // this call writes x0, y0, x1, y1 onto every node
    treemapLayout(treemapRoot);

    const treemapSvg = d3.select("#treemap")
        .append("svg")
        .attr("width", treemapWidth)
        .attr("height", treemapHeight);


    const leaves = treemapRoot.leaves();

    const cell = treemapSvg
        .selectAll(".cell")
        .data(leaves)
        .join("g")
        .attr("class", "cell")
        .attr(
            "transform",
            d => `translate(${d.x0}, ${d.y0})`
        );

    cell.append("rect")
        .attr("width", d => d.x1 - d.x0)
        .attr("height", d => d.y1 - d.y0);

    cell.append("text")
        .attr("x", 5)
        .attr("y", 18)
        .attr("font-size", "11px")
        .attr("fill", "#fff")
        .text(d => d.data.name);

    function getContinent(d) {

        let current = d;

        // walk up until we are one level below the root
        while (current.depth > 1) {
            current = current.parent;
        }

        return current.data.name;
    }

    const continents = [
        "North America",
        "Europe",
        "Asia"
    ];

    const colorScale = d3.scaleOrdinal()
        .domain(continents)
        .range(d3.schemeTableau10);

    cell.select("rect")
        .attr(
            "fill",
            d => colorScale(getContinent(d))
        );


    const tooltip = d3.select("#tooltip");

    cell
        .on(
            "mouseover",
            function (event, d) {
                tooltip
                    .style("opacity", 1)
                    .html(`
                        <strong>${d.data.name}</strong><br>
                        ${getContinent(d)}<br>
                        Population: ${d.value} thousand
                    `);
            }
        )
        .on(
            "mousemove",
            function (event) {
                tooltip
                    .style("left", `${event.pageX + 10}px`)
                    .style("top", `${event.pageY + 10}px`);
            }
        )
        .on(
            "mouseout",
            function () {
                tooltip.style("opacity", 0);
            }
        );


    const x = d3.scaleLinear()
        .domain([0, treemapWidth])
        .range([0, treemapWidth]);

    const y = d3.scaleLinear()
        .domain([0, treemapHeight])
        .range([0, treemapHeight]);


    function zoomTo(d) {

        x.domain([d.x0, d.x1]);
        y.domain([d.y0, d.y1]);

        cell.transition()
            .duration(600)
            .attr(
                "transform",
                node =>
                    `translate(${x(node.x0)}, ${y(node.y0)})`
            );

        cell.select("rect")
            .transition()
            .duration(600)
            .attr(
                "width",
                node => x(node.x1) - x(node.x0)
            )
            .attr(
                "height",
                node => y(node.y1) - y(node.y0)
            );
    }


    // click a cell to zoom to its parent group,
    // click the background to zoom back out
    cell.on("click", function (event, d) {
        zoomTo(d.parent);
    });

    treemapSvg.on("click", function (event) {
        if (event.target === this) {
            zoomTo(treemapRoot);
        }
    });


    const treemapRoot2 = d3.hierarchy(data)
        .sum(d => d.value || 0)
        .sort((a, b) => b.value - a.value);

    const treemapLayout2 = d3.treemap()
        .tile(d3.treemapSliceDice)
        .size([
            treemapWidth,
            treemapHeight
        ])
        .paddingInner(2)
        .paddingOuter(4);

    treemapLayout2(treemapRoot2);

    const treemapSvg2 = d3.select("#treemap2")
        .append("svg")
        .attr("width", treemapWidth)
        .attr("height", treemapHeight);

    const cell2 = treemapSvg2
        .selectAll(".cell")
        .data(treemapRoot2.leaves())
        .join("g")
        .attr("class", "cell")
        .attr(
            "transform",
            d => `translate(${d.x0}, ${d.y0})`
        );

    cell2.append("rect")
        .attr("width", d => d.x1 - d.x0)
        .attr("height", d => d.y1 - d.y0)
        .attr(
            "fill",
            d => colorScale(getContinent(d))
        );

    cell2.append("text")
        .attr("x", 5)
        .attr("y", 18)
        .attr("font-size", "11px")
        .attr("fill", "#fff")
        .text(d => d.data.name);


});


//assignment
//encode gdp amount (area) and status (color, but ordinal in three values)
//two different segmentation methods 

//like lab, convert to json 
//make treemaps and use tooltips 
//choose vis channels and strategies reasoning after review slides

d3.json("../data/lab6_assignment_gdp.json")
.then(gdpData => {

    const gdpWidth = 900;
    const gdpHeight = 560;

    // diverging: Decrease and Increase are opposite directions,
    // Unchanged is the neutral midpoint
    const statusColor = d3.scaleOrdinal()
        .domain(["Decrease", "Unchanged", "Increase"])
        .range(["#e08214", "#b8b8b8", "#3a76a8"]);

    const gdpTooltip = d3.select("#tooltip");

    // walk up to the node at a given depth
    function ancestorName(d, depth) {
        let current = d;
        while (current.depth > depth) {
            current = current.parent;
        }
        return current.data.name;
    }

    function drawGdpTreemap(containerId, tileMethod) {

        // a separate hierarchy per treemap, so the two layouts
        // cannot overwrite each other's x0/y0/x1/y1
        const root = d3.hierarchy(gdpData)
            .sum(d => d.gdp_billion_usd || 0)
            .sort((a, b) => b.value - a.value);

        const layout = d3.treemap()
            .tile(tileMethod)
            .size([gdpWidth, gdpHeight])
            .paddingOuter(4)
            .paddingInner(2)
            .paddingTop(d => d.depth === 1 ? 24 : 4)
            ;

        layout(root);

        const svg = d3.select(containerId)
            .append("svg")
            .attr("width", gdpWidth)
            .attr("height", gdpHeight);

        // continent bands, drawn first so they sit behind
        

        const cell = svg.selectAll(".gdp-cell")
            .data(root.leaves())
            .join("g")
            .attr("class", "gdp-cell")
            .attr(
                "transform",
                d => `translate(${d.x0}, ${d.y0})`
            );

        cell.append("rect")
            .attr("width", d => d.x1 - d.x0)
            .attr("height", d => d.y1 - d.y0)
            .attr("fill", d => statusColor(d.data.gdp_status))
            .attr("stroke", "#fff")
            .attr("stroke-width", 0.5);

        // only label rectangles with room for the text
        cell.append("text")
            .attr("x", 4)
            .attr("y", 13)
            .attr("font-size", "10px")
            .attr("fill", "#fff")
            .text(
                d =>
                    (d.x1 - d.x0) > 55 && (d.y1 - d.y0) > 18
                    ? d.data.name
                    : ""
            );

        cell
            .on("mouseover", function (event, d) {
                gdpTooltip
                    .style("opacity", 1)
                    .html(`
                        <strong>${d.data.name}</strong><br>
                        ${ancestorName(d, 2)}, ${ancestorName(d, 1)}<br>
                        GDP: $${d.value.toLocaleString()} billion<br>
                        Status: ${d.data.gdp_status}
                    `);
            })
            .on("mousemove", function (event) {
                gdpTooltip
                    .style("left", `${event.pageX + 12}px`)
                    .style("top", `${event.pageY + 12}px`);
            })
            .on("mouseout", function () {
                gdpTooltip.style("opacity", 0);
            });
        
            svg.selectAll(".continent-label")
            .data(root.descendants().filter(d => d.depth === 1))
            .join("text")
            .attr("class", "continent-label")
            .attr("x", d => d.x0 + 4)
            .attr("y", d => d.y0 + 13)
            .attr("font-size", "12px")
            .attr("font-weight", "bold")
            .attr("fill", "#444")
            .text(d => d.data.name);
    }

    
    drawGdpTreemap("#gdp-treemap-1", d3.treemapSquarify);
    drawGdpTreemap("#gdp-treemap-2", d3.treemapSliceDice);


    const legendSvg = d3.select("#gdp-legend")
        .append("svg")
        .attr("width", 420)
        .attr("height", 40);

    const statuses = ["Decrease", "Unchanged", "Increase"];

    const legendItem = legendSvg.selectAll(".legend-item")
        .data(statuses)
        .join("g")
        .attr("class", "legend-item")
        .attr(
            "transform",
            (d, i) => `translate(${i * 130}, 10)`
        );

    legendItem.append("rect")
        .attr("width", 16)
        .attr("height", 16)
        .attr("fill", d => statusColor(d));

    legendItem.append("text")
        .attr("x", 24)
        .attr("y", 12)
        .attr("font-size", "13px")
        .attr("fill", "#333")
        .text(d => d);
});