        
//Lab 1   
const svgS = d3.select("#chart")
    .append("svg")
    .attr("width", 650)
    .attr("height", 350);
    
const color = d3.scaleLinear()
    .domain([55, 95])
    .range(["red", "green"]);

d3.csv("../data/students.csv", d => ({
    name: d.name,
    score: +d.score}))
    .then(data => {

        
        svgS.selectAll("rect")
            .data(data)
            .join("rect")
            .attr("x", (d,i) => i*80 + 20) //OHHH i is the ith rect, iterating
            .attr("y", d => 300 - d.score*3) //y goes downward so want the sum of the bar height and space to be 400 so that level at bottom
            .attr("width" , 40) 
            .attr("height", d => d.score*3) //change based on score
            .attr("fill", d => color(d.score)) //change green to red based on score
            .attr("rx", 3)
    
        svgS.selectAll("text")
            .data(data)
            .join("text")
            .attr("x", (d,i) => i*80 + 40)
            .attr("y", 320)
            .attr("text-anchor", "middle")
            .text(d => d.name);
            
        svgS.selectAll(".name-label")
            .data(data)
            .join("text")
            .attr("class", "name-label")
            .attr("x", (d,i) => i*80 + 40)
            .attr("y", 340)
            .attr("text-anchor", "middle")
            .text(d => d.score);
        
    });












