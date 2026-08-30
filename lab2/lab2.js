const width = 800;
const height = 500;

const margin = {
    top: 40,
    right: 170,
    bottom: 70,
    left: 70
};

d3.csv("../data/students_multivariate.csv", d => ({
    name: d.name,
    study_hours: +d.study_hours,
    score: +d.score,
    major: d.major,
    year: d.year
}))
.then(data => {

    //make the axes scale be according to vars (study hours x) 
    const xScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.study_hours))
        .nice() //rounds out the end numbers like 97 to 100 
        .range([
            margin.left,
            width - margin.right 
        ]);
    
    //reversed for y 
    const yScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.score))
        .nice()
        .range([
            height - margin.bottom, 
            margin.top
        ]); // margin 

    const svg = d3.select("#chart") //which chart is it going to 
        .append("svg")
        .attr("width", width)
        .attr("height", height);
    
    const majors = Array.from(
        new Set(data.map(d => d.major))
    );
        
    const colorScale = d3.scaleOrdinal()
        .domain(majors)
        .range(d3.schemeTableau10);
    
    const sizeScale = d3.scaleOrdinal()
        .domain([
            "Freshman",
            "Sophomore",
            "Junior",
            "Senior"
        ])
        .range([
            5,
            7,
            9,
            11
        ]);
    
    const legend = svg.append("g")
        .attr(
            "transform",
            `translate(${width - margin.right + 25}, 60)`
    );

    const legendItems = legend
        .selectAll(".legend-item")
        .data(majors)
        .join("g")
        .attr("class", "legend-item")
        .attr(
            "transform",
            (d, i) => `translate(0, ${i * 28})`
    );
    
    const tooltip = d3.select("#tooltip");

//add x-axis 
    svg.append("g") // why called g: like div, make unit 
        .attr(
            "transform", // reposition (can be translate, rotate, scale)
            `translate(0, ${height - margin.bottom})` //x, y
        )
        .call(d3.axisBottom(xScale)); // what is call: call the function to (g)

    svg.append("g")
        .attr(
            "transform",
            `translate(${margin.left}, 0)`
        )
        .call(d3.axisLeft(yScale));

//labels 
    svg.append("text") // called text 
        .attr("x", width / 2)
        .attr("y", height - 20)
        .attr("text-anchor", "middle")
        .text("Study Hours");

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", 20)
        .attr("text-anchor", "middle")
        .text("Exam Score");

    svg.selectAll("circle")
        .data(data)
        .join("circle")
        .attr("cx", d => xScale(d.study_hours))
        .attr("cy", d => yScale(d.score))
        .attr("r", d => sizeScale(d.year))
        .attr("fill", d => colorScale(d.major))
        .on("mouseover", function (event, d) {

            tooltip
                .style("opacity", 1)
                .html(`
                    <strong>${d.name}</strong><br>
                    Study Hours: ${d.study_hours}<br>
                    Score: ${d.score}<br>
                    Major: ${d.major}<br>
                    Year: ${d.year}
                `);
        
        })
        .on("mousemove", function (event) {
        
            tooltip
                .style("left", `${event.pageX + 10}px`)
                .style("top", `${event.pageY + 10}px`);
        
        })
        .on("mouseout", function () {
        
            tooltip
                .style("opacity", 0);
        
        });

    legendItems.append("circle")
        .attr("r", 6)
        .attr("fill", d => colorScale(d));
    
    legendItems.append("text")
        .attr("x", 12)
        .attr("y", 4)
        .text(d => d);


});










//put temp on x axis 
//population on y axis 
//so with trend see how as temp increases, population increases 

//make development level be size (because visualizing the actual size), was going to do opacity but 
    //also see trend of as population increases size of development increases
//region can be color (a bit arbitrary) 

//making the numerical ones be the axes 
d3.csv("../data/cities_multivariate.csv", d => ({
    city: d.city,
    popul: +d.population,
    temp: +d.temp_c,
    dev: d.development_level,
    reg: d.region
}))
.then(data => {

    //making temp x axis 
    const xScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.temp))
        .nice()  
        .range([
            margin.left,
            width - margin.right 
        ]);
    
    //reversed for y 
    const yScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.popul))
        .nice()
        .range([
            height - margin.bottom, 
            margin.top
        ]); 

    const svg = d3.select("#chart2")  
        .append("svg")
        .attr("width", width)
        .attr("height", height);
    
    const regions = Array.from(
        new Set(data.map(d => d.reg))
    );
        
    const colorScale = d3.scaleOrdinal()
        .domain(regions)
        .range(d3.schemeTableau10);
    
    const sizeScale = d3.scaleOrdinal()
        .domain([
            "Low",
            "Medium",
            "High"
        ]) // way to make automatic? so starting number then for loop + 3 for however many items in domain (auto from values in var set)
        .range([
            5,
            8,
            11
        ]);
    
    const legend = svg.append("g")
        .attr(
            "transform",
            `translate(${width - margin.right + 25}, 60)`
    );

    const legendItems = legend
        .selectAll(".legend-item")
        .data(regions)
        .join("g")
        .attr("class", "legend-item")
        .attr(
            "transform",
            (d, i) => `translate(0, ${i * 28})`
    );
    
    const tooltip = d3.select("#tooltip");

//add x-axis 
    svg.append("g") 
        .attr(
            "transform", 
            `translate(0, ${height - margin.bottom})` //x, y
        )
        .call(d3.axisBottom(xScale));

    svg.append("g")
        .attr(
            "transform",
            `translate(${margin.left}, 0)`
        )
        .call(d3.axisLeft(yScale));

//labels STILL NOT DONE 
    svg.append("text") // called text 
        .attr("x", width / 2)
        .attr("y", height - 20)
        .attr("text-anchor", "middle")
        .text("Temperature (C)");

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", 20)
        .attr("text-anchor", "middle")
        .text("Population (millions)");

    svg.selectAll(".city-point")
        .data(data)
        .join("circle")
        .attr("cx", d => xScale(d.temp))
        .attr("cy", d => yScale(d.popul))
        .attr("r", d => sizeScale(d.dev))
        .attr("fill", d => colorScale(d.reg))
        .on("mouseover", function (event, d) {

            tooltip
                .style("opacity", 1)
                .html(`
                    <strong>${d.city}</strong><br>
                    Temperature: ${d.temp}<br>
                    Population Size: ${d.popul}<br>
                    Development Level: ${d.dev}<br>
                    Region: ${d.reg}
                `);
        
        })
        .on("mousemove", function (event) {
        
            tooltip
                .style("left", `${event.pageX + 10}px`)
                .style("top", `${event.pageY + 10}px`);
        
        })
        .on("mouseout", function () {
        
            tooltip
                .style("opacity", 0);
        
        });

    legendItems.append("circle")
        .attr("r", 6)
        .attr("fill", d => colorScale(d));
    
    legendItems.append("text")
        .attr("x", 12)
        .attr("y", 4)
        .text(d => d);
    
    
    
    
    
    
    
    
    
    
    
    //non scatter plot compass 
//a second option 
//make the coordinate system be centered so region is seen by where on map they are.

const regionPos = {
    North: { x:  0, y: -1 },
    South: { x:  0, y:  1 },
    East:  { x:  1, y:  0 },
    West:  { x: -1, y:  0 }
};

const devScore = { Low: 1, Medium: 2, High: 3 };

const byRegion = d3.rollups( // rollups groups by key and finds average (like query)
    data,
    v => ({
        avgTemp: d3.mean(v, d => d.temp),
        avgPop:  d3.mean(v, d => d.popul),
        avgDev:  d3.mean(v, d => devScore[d.dev]),
        cities:  v.map(d => d.city).join(", ")
    }),
    d => d.reg
).map(([reg, vals]) => ({ reg, ...vals }));

const w2 = 980, h2 = 680;
const cx0 = 330, cy0 = h2 / 2, spread = 210;

const svg2 = d3.select("#chart3")
    .append("svg")
    .attr("width", w2)
    .attr("height", h2);

const rScale = d3.scaleSqrt() //so not so exaggerated
    .domain([0, d3.max(byRegion, d => d.avgPop)])
    .range([0, 70]);

const tempColor = d3.scaleSequential(d3.interpolateRdYlBu)
    .domain(d3.extent(byRegion, d => d.avgTemp).reverse());

const ringScale = d3.scaleLinear()
    .domain([1, 3])
    .range([2, 12]);

svg2.selectAll(".region-bubble")
    .data(byRegion)
    .join("circle")
    .attr("class", "region-bubble")
    .attr("cx", d => cx0 + regionPos[d.reg].x * spread)
    .attr("cy", d => cy0 + regionPos[d.reg].y * spread)
    .attr("r",  d => rScale(d.avgPop))
    .attr("fill", d => tempColor(d.avgTemp))
    .attr("stroke", "#333")
    .attr("stroke-width", d => ringScale(d.avgDev))
    .attr("opacity", 0.9)
    .on("mouseover", function (event, d) {
        tooltip.style("opacity", 1).html(`
            <strong>${d.reg}</strong><br>
            Avg temperature: ${d.avgTemp.toFixed(1)} °C<br>
            Avg population: ${d.avgPop.toFixed(2)} M<br>
            Avg development: ${d.avgDev.toFixed(2)} of 3<br>
            Cities: ${d.cities}
        `);
    })
    .on("mousemove", function (event) {
        tooltip.style("left", `${event.pageX + 10}px`)
               .style("top",  `${event.pageY + 10}px`);
    })
    .on("mouseout", function () {
        tooltip.style("opacity", 0);
    });

svg2.selectAll(".region-name")
    .data(byRegion)
    .join("text")
    .attr("class", "region-name")
    .attr("x", d => cx0 + regionPos[d.reg].x * spread)
    .attr("y", d => cy0 + regionPos[d.reg].y * spread + 5)
    .attr("text-anchor", "middle")
    .attr("font-size", "15px")
    .attr("font-weight", "bold")
    .text(d => d.reg);

    const tExtent = d3.extent(byRegion, d => d.avgTemp);

const defs = svg2.append("defs");
const grad = defs.append("linearGradient")
    .attr("id", "tempGrad")
    .attr("x1", "0%").attr("x2", "0%")
    .attr("y1", "0%").attr("y2", "100%");

d3.range(0, 1.01, 0.1).forEach(t => {
    grad.append("stop")
        .attr("offset", `${t * 100}%`)
        .attr("stop-color", tempColor(tExtent[1] - t * (tExtent[1] - tExtent[0])));
});

const leg = svg2.append("g").attr("transform", "translate(760, 60)");

leg.append("text")
    .attr("font-weight", "bold").attr("font-size", "13px")
    .text("Avg temperature");

leg.append("rect")
    .attr("x", 0).attr("y", 12)
    .attr("width", 18).attr("height", 120)
    .attr("fill", "url(#tempGrad)")
    .attr("stroke", "#999").attr("stroke-width", 0.5);

leg.append("text").attr("x", 24).attr("y", 24)
    .attr("font-size", "12px").text(`${tExtent[1].toFixed(1)} °C`);
leg.append("text").attr("x", 24).attr("y", 132)
    .attr("font-size", "12px").text(`${tExtent[0].toFixed(1)} °C`);

const sizeLeg = leg.append("g").attr("transform", "translate(0, 200)");

sizeLeg.append("text")
    .attr("font-weight", "bold").attr("font-size", "13px")
    .text("Avg population");

const sizeVals = [0.6, 1.4, 2.1];

sizeLeg.selectAll(".size-key")
    .data(sizeVals)
    .join("circle")
    .attr("class", "size-key")
    .attr("cx", 40)
    .attr("cy", d => 145 - rScale(d))
    .attr("r", d => rScale(d))
    .attr("fill", "none")
    .attr("stroke", "#777");

sizeLeg.selectAll(".size-label")
    .data(sizeVals)
    .join("text")
    .attr("class", "size-label")
    .attr("x", 90)
    .attr("y", d => 145 - 2 * rScale(d) + 12)
    .attr("font-size", "11px")
    .text(d => `${d}M`);

const ringLeg = leg.append("g").attr("transform", "translate(0, 370)");

ringLeg.append("text")
    .attr("font-weight", "bold").attr("font-size", "13px")
    .text("Avg development");

[["Lower", 1], ["Higher", 3]].forEach(([label, val], i) => {
    ringLeg.append("circle")
        .attr("cx", 16).attr("cy", 30 + i * 42).attr("r", 12)
        .attr("fill", "#ddd")
        .attr("stroke", "#333")
        .attr("stroke-width", ringScale(val));
    ringLeg.append("text")
        .attr("x", 40).attr("y", 34 + i * 42)
        .attr("font-size", "12px").text(label);
});

    
    
    
    
    
    
    
    
    
    
    
    
    
    
    //no averages
    // --- Chart 4: individual cities clustered by compass region ---
const regionPos4 = {
    North: { x:  0, y: -1 },
    South: { x:  0, y:  1 },
    East:  { x:  1, y:  0 },
    West:  { x: -1, y:  0 }
};

const devScore4 = { Low: 1, Medium: 2, High: 3 };

const w4 = 900, h4 = 700;
const cx4 = 330, cy4 = h4 / 2, spread4 = 230;

const svg4 = d3.select("#chart4")
    .append("svg")
    .attr("width", w4)
    .attr("height", h4);

const rScale4 = d3.scaleSqrt()
    .domain([0, d3.max(data, d => d.popul)])
    .range([0, 42]);

const tempColor4 = d3.scaleSequential(d3.interpolateRdYlBu)
    .domain(d3.extent(data, d => d.temp).reverse());

const ringScale4 = d3.scaleLinear()
    .domain([1, 3])
    .range([1.5, 7]);

const placed4 = [];
d3.groups(data, d => d.reg).forEach(([reg, cities]) => {
    const rx = cx4 + regionPos4[reg].x * spread4;
    const ry = cy4 + regionPos4[reg].y * spread4;
    const ring = 62;

    cities.forEach((d, i) => {
        const angle = (i / cities.length) * 2 * Math.PI - Math.PI / 2;
        placed4.push({
            ...d,
            px: rx + Math.cos(angle) * ring,
            py: ry + Math.sin(angle) * ring
        });
    });
});

svg4.selectAll(".region-title4")
    .data(Object.keys(regionPos4))
    .join("text")
    .attr("class", "region-title4")
    .attr("x", r => cx4 + regionPos4[r].x * spread4)
    .attr("y", r => cy4 + regionPos4[r].y * spread4 + 6)
    .attr("text-anchor", "middle")
    .attr("font-size", "17px")
    .attr("font-weight", "bold")
    .attr("fill", "#bbb")
    .text(r => r);

svg4.selectAll(".city-bubble4")
    .data(placed4)
    .join("circle")
    .attr("class", "city-bubble4")
    .attr("cx", d => d.px)
    .attr("cy", d => d.py)
    .attr("r",  d => rScale4(d.popul))
    .attr("fill", d => tempColor4(d.temp))
    .attr("stroke", "#333")
    .attr("stroke-width", d => ringScale4(devScore4[d.dev]))
    .attr("opacity", 0.9)
    .on("mouseover", function (event, d) {
        d3.select(this).attr("stroke", "#000");
        tooltip.style("opacity", 1).html(`
            <strong>${d.city}</strong> (${d.reg})<br>
            Temperature: ${d.temp} °C<br>
            Population: ${d.popul} M<br>
            Development: ${d.dev}
        `);
    })
    .on("mousemove", function (event) {
        tooltip.style("left", `${event.pageX + 10}px`)
               .style("top",  `${event.pageY + 10}px`);
    })
    .on("mouseout", function () {
        d3.select(this).attr("stroke", "#333");
        tooltip.style("opacity", 0);
    });

svg4.selectAll(".city-name4")
    .data(placed4)
    .join("text")
    .attr("class", "city-name4")
    .attr("x", d => d.px)
    .attr("y", d => d.py + rScale4(d.popul) + 14)
    .attr("text-anchor", "middle")
    .attr("font-size", "11px")
    .text(d => d.city);

// legend
const leg4 = svg4.append("g").attr("transform", "translate(700, 60)");

const t4 = d3.extent(data, d => d.temp);

const defs4 = svg4.append("defs");
const grad4 = defs4.append("linearGradient")
    .attr("id", "tempGrad4")
    .attr("x1", "0%").attr("x2", "0%")
    .attr("y1", "0%").attr("y2", "100%");

d3.range(0, 1.01, 0.1).forEach(t => {
    grad4.append("stop")
        .attr("offset", `${t * 100}%`)
        .attr("stop-color", tempColor4(t4[1] - t * (t4[1] - t4[0])));
});

leg4.append("text")
    .attr("font-weight", "bold").attr("font-size", "13px")
    .text("Temperature");

leg4.append("rect")
    .attr("x", 0).attr("y", 12)
    .attr("width", 18).attr("height", 120)
    .attr("fill", "url(#tempGrad4)")
    .attr("stroke", "#999").attr("stroke-width", 0.5);

leg4.append("text").attr("x", 24).attr("y", 24)
    .attr("font-size", "12px").text(`${t4[1]} °C`);
leg4.append("text").attr("x", 24).attr("y", 132)
    .attr("font-size", "12px").text(`${t4[0]} °C`);

const sizeLeg4 = leg4.append("g").attr("transform", "translate(0, 175)");

sizeLeg4.append("text")
    .attr("font-weight", "bold").attr("font-size", "13px")
    .text("Population");

const sizeVals4 = [0.5, 1.6, 3.2];

sizeLeg4.selectAll(".size-key4")
    .data(sizeVals4)
    .join("circle")
    .attr("class", "size-key4")
    .attr("cx", 45)
    .attr("cy", d => 115 - rScale4(d))
    .attr("r", d => rScale4(d))
    .attr("fill", "none")
    .attr("stroke", "#777");

sizeLeg4.selectAll(".size-label4")
    .data(sizeVals4)
    .join("text")
    .attr("class", "size-label4")
    .attr("x", 100)
    .attr("y", d => 115 - 2 * rScale4(d) + 12)
    .attr("font-size", "11px")
    .text(d => `${d}M`);

const ringLeg4 = leg4.append("g").attr("transform", "translate(0, 310)");

ringLeg4.append("text")
    .attr("font-weight", "bold").attr("font-size", "13px")
    .text("Development");

[["Low", 1], ["Medium", 2], ["High", 3]].forEach(([label, val], i) => {
    ringLeg4.append("circle")
        .attr("cx", 16).attr("cy", 30 + i * 40).attr("r", 11)
        .attr("fill", "#e8e8e8")
        .attr("stroke", "#333")
        .attr("stroke-width", ringScale4(val));
    ringLeg4.append("text")
        .attr("x", 40).attr("y", 34 + i * 40)
        .attr("font-size", "12px").text(label);
});

});












