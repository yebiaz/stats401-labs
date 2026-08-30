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
  
    
      
        
