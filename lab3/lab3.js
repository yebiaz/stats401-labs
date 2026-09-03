// d3.csv("../data/books.csv")
//     .then(data => {

//         const columns = data.columns;
//         let ascending = true;

//         const table = d3.select(
//             "#data-table"
//         );

//         const header = table
//             .select("thead")
//             .append("tr");

//         header.selectAll("th")
//             .data(columns)
//             .join("th")
//             .text(d => d)
//             .style("cursor", "pointer")
//             .on(
//                 "click",
//                 function(event, column) {

//                     data.sort(
//                         (a, b) =>
//                             ascending
//                             ? d3.ascending(
//                                 a[column],
//                                 b[column]
//                               )
//                             : d3.descending(
//                                 a[column],
//                                 b[column]
//                               )
//                     );

//                     ascending = !ascending;

//                     updateRows();
//                 }
//             );

//         function updateRows() {

//             const rows = table
//                 .select("tbody")
//                 .selectAll("tr")
//                 .data(data);

//             rows.join("tr")
//                 .selectAll("td")
//                 .data(
//                     row =>
//                         columns.map(
//                             column =>
//                                 row[column]
//                         )
//                 )
//                 .join("td")
//                 .text(d => d);
//         }

//         updateRows();

//     });



// MY PART WITH MET API 
d3.csv("../data/lab3_data.csv")
    .then(data => {

        const columns = data.columns;
        const originalData = data.slice(); //want to keep og for button  
        let currentData = data.slice();

        let ascending = true; //ascending for object titles 
        let sortColumn = null;

        const filterColumns = [ //these are the columns I felt would be weird to order and since they have a number of bins, the user can select which category they want to see 
            "Department"
        ];

        const table = d3.select("#data-table");

        const header = table
            .select("thead")
            .append("tr");

        // filters (a lot of ai help for implementing my idea)

        const filterBox = d3.select("#filters"); //**************************

        filterColumns.forEach(column => {

            const values = Array.from(
                new Set(originalData.map(d => d[column]))
            )
                .filter(v => v && v !== "")
                .sort(d3.ascending);

            const wrap = filterBox
                .append("div")
                .attr("class", "filter-item");

            wrap.append("label")
                .text(column.replace("_", " "));

            const select = wrap.append("select")
                .attr("data-column", column)
                .on("change", applyFilters);

            select.append("option")
                .attr("value", "")
                .text("All");

            select.selectAll("option.value")
                .data(values)
                .join("option")
                .attr("class", "value")
                .attr("value", d => d)
                .text(d => d.length > 60 ? d.slice(0, 60) + "..." : d);
        });

        d3.select("#reset-button")
            .on("click", function () {
                filterBox.selectAll("select").property("value", "");
                sortColumn = null;
                ascending = true;
                currentData = originalData.slice(); //go back to the original data before all the odering and filtering
                updateHeader();
                updateRows();
            });

        function applyFilters() {

            currentData = originalData.filter(row => {

                let keep = true;

                filterBox.selectAll("select").each(function () {
                    const column = this.getAttribute("data-column");
                    const chosen = this.value;
                    if (chosen !== "" && row[column] !== chosen) {
                        keep = false;
                    }
                });

                return keep;
            });

            if (sortColumn) {
                sortData(sortColumn);
            }

            updateRows();
        }

        // sorting for the other columns 

        function sortData(column) {

            currentData.sort((a, b) => {

                const x = a[column];
                const y = b[column];

                const xEmpty = x === "" || x == null;
                const yEmpty = y === "" || y == null;

                if (xEmpty && yEmpty) return 0;
                if (xEmpty) return 1;
                if (yEmpty) return -1;

                const nx = +x;
                const ny = +y;

                const numeric =
                    x !== "" && y !== "" &&
                    !isNaN(nx) && !isNaN(ny);

                const va = numeric ? nx : x;
                const vb = numeric ? ny : y;

                return ascending
                    ? d3.ascending(va, vb)
                    : d3.descending(va, vb);
            });
        }

        header.selectAll("th")
            .data(columns)
            .join("th")
            .style("cursor", "pointer")
            .on("click", function (event, column) {

                if (sortColumn === column) {
                    ascending = !ascending;
                } else {
                    sortColumn = column;
                    ascending = true;
                }

                sortData(column);
                updateHeader();
                updateRows();
            });

        function updateHeader() {
            header.selectAll("th")
                .text(d => {
                    if (d !== sortColumn) {
                        return d + " \u21C5";
                    }
                    return d + (ascending ? " \u25B2" : " \u25BC");
                });
        }

        // ---------- rows ----------

        function updateRows() {

            const rows = table
                .select("tbody")
                .selectAll("tr")
                .data(currentData);

            rows.join("tr")
                .selectAll("td")
                .data(
                    row =>
                        columns.map(
                            column =>
                                row[column]
                        )
                )
                .join("td")
                .text(d => d);

            d3.select("#row-count")
                .text(currentData.length + " of " + originalData.length + " records shown");
        }

        updateHeader();
        updateRows();
    });
