d3.csv(
    "../data/lab4_clean_tweets.csv",
    d => ({
        ...d,
        year: +d.year,
        favorites: +d.favorites,
        retweets: +d.retweets,
        sentiment_score: +d.sentiment_score
    })
)
.then(data => {

    const width = 900;
    const height = 460;

    const margin = {
        top: 40,
        right: 150,
        bottom: 70,
        left: 70
    };

    const sentiments = ["Negative", "Neutral", "Positive"];

    const colorScale = d3.scaleOrdinal()
        .domain(sentiments)
        .range(["#c0504d", "#bfbfbf", "#4f81a8"]);

    const tooltip = d3.select("#tooltip");

    const years = Array.from(
        new Set(data.map(d => d.year))
    ).sort(d3.ascending);

    // ---------- Chart 1: sentiment counts by year ----------

    const counts = [];

    years.forEach(year => {
        sentiments.forEach(sentiment => {
            counts.push({
                year: year,
                sentiment: sentiment,
                count: data.filter(
                    d => d.year === year &&
                         d.sentiment === sentiment
                ).length
            });
        });
    });

    const svg1 = d3.select("#chart-counts")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    const xYear = d3.scaleBand()
        .domain(years)
        .range([margin.left, width - margin.right])
        .padding(0.2);

    const xSentiment = d3.scaleBand()
        .domain(sentiments)
        .range([0, xYear.bandwidth()])
        .padding(0.05);

    const yCount = d3.scaleLinear()
        .domain([0, d3.max(counts, d => d.count)])
        .nice()
        .range([height - margin.bottom, margin.top]);

    svg1.selectAll(".count-bar")
        .data(counts)
        .join("rect")
        .attr("class", "count-bar")
        .attr("x", d => xYear(d.year) + xSentiment(d.sentiment))
        .attr("y", d => yCount(d.count))
        .attr("width", xSentiment.bandwidth())
        .attr("height", d => yCount(0) - yCount(d.count))
        .attr("fill", d => colorScale(d.sentiment))
        .on("mouseover", function (event, d) {
            tooltip.style("opacity", 1).html(`
                <strong>${d.year}</strong><br>
                ${d.sentiment}: ${d.count} tweets
            `);
        })
        .on("mousemove", function (event) {
            tooltip
                .style("left", `${event.pageX + 10}px`)
                .style("top", `${event.pageY + 10}px`);
        })
        .on("mouseout", function () {
            tooltip.style("opacity", 0);
        });

    svg1.append("g")
        .attr(
            "transform",
            `translate(0, ${height - margin.bottom})`
        )
        .call(d3.axisBottom(xYear).tickFormat(d3.format("d")));

    svg1.append("g")
        .attr(
            "transform",
            `translate(${margin.left}, 0)`
        )
        .call(d3.axisLeft(yCount));

    svg1.append("text")
        .attr("x", (width - margin.right + margin.left) / 2)
        .attr("y", height - 20)
        .attr("text-anchor", "middle")
        .text("Year");

    svg1.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", 20)
        .attr("text-anchor", "middle")
        .text("Number of tweets");

    const legend = svg1.append("g")
        .attr(
            "transform",
            `translate(${width - margin.right + 25}, 60)`
        );

    const legendItems = legend
        .selectAll(".legend-item")
        .data(sentiments)
        .join("g")
        .attr("class", "legend-item")
        .attr(
            "transform",
            (d, i) => `translate(0, ${i * 28})`
        );

    legendItems.append("rect")
        .attr("width", 14)
        .attr("height", 14)
        .attr("fill", d => colorScale(d));

    legendItems.append("text")
        .attr("x", 22)
        .attr("y", 12)
        .attr("font-size", "13px")
        .text(d => d);

    // ---------- Chart 2: average sentiment score by year ----------

    const byYear = d3.rollups(
        data,
        v => ({
            avg: d3.mean(v, d => d.sentiment_score),
            n: v.length
        }),
        d => d.year
    )
        .map(([year, vals]) => ({ year, ...vals }))
        .sort((a, b) => d3.ascending(a.year, b.year));

    const h2 = 400;

    const svg2 = d3.select("#chart-trend")
        .append("svg")
        .attr("width", width)
        .attr("height", h2);

    const xTrend = d3.scalePoint()
        .domain(years)
        .range([margin.left, width - margin.right])
        .padding(0.5);

    const yTrend = d3.scaleLinear()
        .domain(d3.extent(byYear, d => d.avg))
        .nice()
        .range([h2 - margin.bottom, margin.top]);

    // reference line at zero separates net positive from net negative
    svg2.append("line")
        .attr("x1", margin.left)
        .attr("x2", width - margin.right)
        .attr("y1", yTrend(0))
        .attr("y2", yTrend(0))
        .attr("stroke", "#999")
        .attr("stroke-dasharray", "4 4");

    const lineGenerator = d3.line()
        .x(d => xTrend(d.year))
        .y(d => yTrend(d.avg));

    svg2.append("path")
        .datum(byYear)
        .attr("fill", "none")
        .attr("stroke", "#4f81a8")
        .attr("stroke-width", 2)
        .attr("d", lineGenerator);

    svg2.selectAll(".trend-point")
        .data(byYear)
        .join("circle")
        .attr("class", "trend-point")
        .attr("cx", d => xTrend(d.year))
        .attr("cy", d => yTrend(d.avg))
        .attr("r", 5)
        .attr("fill", "#4f81a8")
        .on("mouseover", function (event, d) {
            tooltip.style("opacity", 1).html(`
                <strong>${d.year}</strong><br>
                Average score: ${d.avg.toFixed(3)}<br>
                Tweets: ${d.n}
            `);
        })
        .on("mousemove", function (event) {
            tooltip
                .style("left", `${event.pageX + 10}px`)
                .style("top", `${event.pageY + 10}px`);
        })
        .on("mouseout", function () {
            tooltip.style("opacity", 0);
        });

    svg2.append("g")
        .attr(
            "transform",
            `translate(0, ${h2 - margin.bottom})`
        )
        .call(d3.axisBottom(xTrend).tickFormat(d3.format("d")));

    svg2.append("g")
        .attr(
            "transform",
            `translate(${margin.left}, 0)`
        )
        .call(d3.axisLeft(yTrend));

    svg2.append("text")
        .attr("x", (width - margin.right + margin.left) / 2)
        .attr("y", h2 - 20)
        .attr("text-anchor", "middle")
        .text("Year");

    svg2.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -h2 / 2)
        .attr("y", 20)
        .attr("text-anchor", "middle")
        .text("Average sentiment score");
});



























/////////
d3.csv(
    "../data/lab4_clean_tweets.csv",
    d => ({
        ...d,
        likes: +d.likes,
        retweets: +d.retweets,
        sentiment_score:
            +d.sentiment_score
    })
)
.then(data => {

    console.log(data);

});