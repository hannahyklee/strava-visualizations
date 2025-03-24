function createCumulativeMilesGraph() {
    // Configuration
    const width = 800;
    const height = 400;
    const margin = { top: 40, right: 60, bottom: 60, left: 50 }; // Increased right margin for legend
    
    // Create SVG container
    const svg = d3.select('#cumulative-miles')
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', `0 0 ${width + margin.right} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet') // This helps with scaling
        .append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top})`);
    
    // Track currently highlighted year
    let highlightedYear = null;

    // Fetch data
    fetch(runningDataFile)
        .then(response => response.json())
        .then(data => {
            console.log("Loaded Data:", data);
            
            // Get current year
            const currentYear = new Date().getFullYear();

            // Process data
            const parsedData = {};
            Object.keys(data).forEach(dateStr => {
                const date = new Date(dateStr);
                const year = date.getFullYear();
                const monthDay = d3.timeFormat('%m-%d')(date); // Extract month and day
                if (!parsedData[year]) parsedData[year] = [];
                parsedData[year].push({ date: new Date(`2000-${monthDay}`), miles: data[dateStr]?.distance_miles || 0 });
            });
            
            // Sort and accumulate miles
            Object.keys(parsedData).forEach(year => {
                parsedData[year].sort((a, b) => a.date - b.date);
                let cumulative = 0;
                parsedData[year] = parsedData[year].map(d => {
                    cumulative += d.miles;
                    return { date: d.date, cumulative };
                });

                // Extend line horizontally only for past years (not the current year)
                if (parseInt(year) < currentYear) {
                    const lastEntry = parsedData[year][parsedData[year].length - 1];
                    if (lastEntry.date < new Date('2000-12-31')) {
                        parsedData[year].push({ date: new Date('2000-12-31'), cumulative: lastEntry.cumulative });
                    }
                }
            });
            
            // Sort years (newest first for legend)
            const sortedYears = Object.keys(parsedData).sort((a, b) => b - a);
            
            // Flatten data for scales
            const allData = sortedYears.flatMap(year => parsedData[year]);
            
            // Scales
            const xScale = d3.scaleTime()
                .domain([new Date('2000-01-01'), new Date('2000-12-31')])
                .range([0, width - margin.left - margin.right]);
            
            const yScale = d3.scaleLinear()
                .domain([0, d3.max(allData, d => d.cumulative)])
                .nice()
                .range([height - margin.top - margin.bottom, 0]);
            
            const line = d3.line()
                .x(d => xScale(d.date))
                .y(d => yScale(d.cumulative))
                .curve(d3.curveMonotoneX);
            
            const color = d3.scaleSequential(d3.interpolateViridis)
                .domain([0, sortedYears.length - 1]);

            // Add lines
            const yearGroups = svg.selectAll('.year-group')
                .data(sortedYears.map((year, i) => [year, parsedData[year], i]))
                .enter()
                .append('g')
                .attr('class', 'year-group')
                .attr('data-year', d => d[0]);
            
            yearGroups.append('path')
                .attr('fill', 'none')
                .attr('stroke', d => color(d[2])) // Use color scale
                .attr('stroke-width', 2)
                .attr('d', d => line(d[1]))
                .attr('class', 'line')
                .style('cursor', 'pointer')
                .on('click', function(event, d) {
                    toggleHighlight(d[0]);
                });
            
            // Add legend (sorted newest to oldest)
            const legend = svg.append('g')
                .attr('class', 'legend')
                .attr('transform', `translate(${width - margin.right}, 0)`); // Move legend outside graph
            
            const legendEntries = legend.selectAll('.legend-entry')
                .data(sortedYears)
                .enter()
                .append('g')
                .attr('class', 'legend-entry')
                .attr('transform', (d, i) => `translate(0, ${i * 20})`)
                .on('click', function(event, year) {
                    toggleHighlight(year);
                });
            
            legendEntries.append('rect')
                .attr('width', 18)
                .attr('height', 18)
                .attr('fill', (d, i) => color(i))
                .style('cursor', 'pointer');
            
            legendEntries.append('text')
                .attr('x', 25)
                .attr('y', 12)
                .style('text-anchor', 'start')
                .text(d => d)
                .style('cursor', 'pointer');

            // Axes
            svg.append('g')
                .attr('transform', `translate(0, ${height - margin.top - margin.bottom})`)
                .call(d3.axisBottom(xScale).tickFormat(d3.timeFormat('%b')));
            
            svg.append('g')
                .call(d3.axisLeft(yScale));

            // Function to toggle highlight for a specific year
            function toggleHighlight(year) {
                if (highlightedYear === year) {
                    // Reset to normal
                    highlightedYear = null;
                    svg.selectAll('.line').style('opacity', 1);
                    legend.selectAll('text').style('font-weight', 'normal');
                } else {
                    // Highlight selected year
                    highlightedYear = year;
                    svg.selectAll('.line').style('opacity', 0.2);
                    svg.selectAll(`[data-year="${year}"] .line`).style('opacity', 1);
                    legend.selectAll('text').style('font-weight', 'normal');
                    legend.selectAll('.legend-entry')
                        .filter(d => d == year)
                        .select('text')
                        .style('font-weight', 'bold');
                }
            }
        })
        .catch(error => {
            console.error('Error loading data:', error);
            d3.select('#cumulative-miles')
                .append('p')
                .text('Error loading data. Please check the console for details.');
        });
}

document.addEventListener('DOMContentLoaded', createCumulativeMilesGraph);
