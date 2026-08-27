console.log("Hello STATS 401!");

let course = "STATS 401";
let students = 40;

console.log(course);
console.log(students);

let data = [10, 20, 30, 40, 50];

console.log(data);

let student = {
    name: "Alice",
    score: 85
};

console.log(student.name);
console.log(student.score);

let studentSet = [
    {name: "Alice", score: 85},
    {name: "Bob", score: 72},
    {name: "Carol", score: 91}
];

console.log(studentSet);

console.log(d3);
console.log("D3 version:", d3.version);

d3.select("#message")
    .text("This text was changed using D3!");
    
const data2 = [10, 20, 30, 40, 50];

d3.select("#numbers")
    .selectAll("p")
    .data(data2)
    .join("p")
    .text(d => `Value: ${d}`);

const values = [10, 20, 30, 40, 50];

const svgD = d3.select("#svg-demo")
    .append("svg")
    .attr("width", 600)
    .attr("height", 200);

svgD.selectAll("circle")
    .data(values)
    .join("circle")
    .attr("cx", (d, i) => 60 + i * 100)
    .attr("cy", 100)
    .attr("r", d => d / 2)
    .attr("fill", "steelblue");
  
    
      
        
          
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





