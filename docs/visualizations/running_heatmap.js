document.addEventListener('DOMContentLoaded', function() {
    // Config
    const isMobile = window.innerWidth < 768;

    // Set different parameters based on device type
    const weekCount = 53; // 53 weeks in a year
    const weekDays = 7;
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const numYears = 5; // Number of years to display
    const legendHeight = 40; // Height reserved for legend

    // For desktop: fit within 900px
    // For mobile: use larger cells but allow horizontal scrolling
    const maxDesiredWidth = isMobile ? 1200 : 900; // Larger for mobile to ensure cells are visible
    const minCellSize = isMobile ? 8 : 6; // Ensure cells don't get too small on any device

    // Calculate cell size based on desired max width
    const availableWidthForCells = maxDesiredWidth - 40; // 40px for labels
    const cellAndMarginWidth = availableWidthForCells / weekCount;
    const cellSize = Math.max(Math.floor(cellAndMarginWidth - 2), minCellSize); // Ensure minimum cell size
    const cellMargin = 2;

    // Recalculate actual dimensions
    const width = weekCount * (cellSize + cellMargin);
    const height = weekDays * (cellSize + cellMargin);

    // Create SVG container for all years
    const svg = d3.select('#running-heatmap')
        .append('svg')
        .attr('width', width + 40) // Extra space for labels
        .attr('height', (height + 70) * numYears + legendHeight) // Add extra height for legend
        .attr('viewBox', `0 0 ${width + 40} ${(height + 70) * numYears + legendHeight}`)
        .attr('preserveAspectRatio', 'xMidYMid meet') // This helps with scaling
        .append('g')
        .attr('transform', `translate(30, ${legendHeight + 10})`); // Space for day labels and legend
    
    // Fetch JSON data
    fetch(runningDataFile)
        .then(response => response.json())
        .then(data => {
            console.log("Loaded Data:", data);
            // First, calculate global max/min for consistent color scaling across all years
            let allMiles = [];
            const now = new Date();
            const currentYear = now.getFullYear();
            const years = Array.from({length: numYears}, (_, i) => currentYear - i);
            
            years.forEach(year => {
                const startDate = new Date(year, 0, 1);
                const endDate = new Date(year, 11, 31);
                let currentDate = new Date(startDate);
                
                while (currentDate <= endDate) {
                    const dateStr = currentDate.toISOString().split('T')[0];
                    const miles = data[dateStr] && data[dateStr].distance_miles ? data[dateStr].distance_miles : 0;
                    if (miles > 0) allMiles.push(miles);
                    currentDate.setDate(currentDate.getDate() + 1);
                }
            });
            
            const maxMiles = allMiles.length > 0 ? d3.max(allMiles) : 10;
            
            // Color scale - white to blue (global scale)
            const color = d3.scaleSequential()
                .domain([0, maxMiles])  // Map your values from 0 to 1
                .interpolator(t => d3.interpolateBlues(0.15 + t * 0.85));

            // Add global legend at the top
            addLegend(svg, maxMiles, color, width, -legendHeight);
            
            // Process each year
            years.forEach((year, index) => {
                const yOffset = index * (height + 70); // Vertical offset for each year
                
                // Add year label
                svg.append('text')
                    .attr('class', 'yearLabel')
                    .attr('x', 0)
                    .attr('y', yOffset - 5)
                    .style('font-size', '14px')
                    .style('font-weight', 'bold')
                    .text(year);
                
                // Add day labels for each year (Sun, Mon, etc)
                svg.selectAll(`.dayLabel${index}`)
                    .data(dayNames)
                    .enter()
                    .append('text')
                    .attr('class', `dayLabel${index}`)
                    .attr('x', -10)
                    .attr('y', (d, i) => (i * (cellSize + cellMargin)) + cellSize + yOffset)
                    .style('text-anchor', 'end')
                    .style('font-size', '10px')
                    .text(d => d);
                    
                createHeatmap(data, year, yOffset, color);
            });
        })
        .catch(error => {
            console.error('Error loading running data:', error);
            // Display error message
            d3.select('#running-heatmap')
                .append('p')
                .text('Error loading running data. Please check the console for details.');
        });
        
    // Function to create heatmap for a specific year
    function createHeatmap(runningData, year, yOffset, colorScale) {
        // We need to get data for part of the previous year and part of the next year
        // to ensure we have complete weeks
        const yearStart = new Date(year, 0, 1);
        const yearEnd = new Date(year, 11, 31);
        
        // Get the day of the week for Jan 1 (0 = Sunday, 6 = Saturday)
        const firstDayOfYear = yearStart.getDay();
        
        // Calculate the start date to show (to ensure complete weeks)
        // If year doesn't start on Sunday, go back to previous Sunday
        const displayStart = new Date(yearStart);
        if (firstDayOfYear > 0) {
            displayStart.setDate(displayStart.getDate() - firstDayOfYear);
        }
        
        // Calculate the end date to show (to ensure complete weeks)
        // If year doesn't end on Saturday, go forward to next Saturday
        const lastDayOfYear = yearEnd.getDay();
        const displayEnd = new Date(yearEnd);
        if (lastDayOfYear < 6) {
            displayEnd.setDate(displayEnd.getDate() + (6 - lastDayOfYear));
        }
        
        // Generate all dates in the display range
        const dateRange = [];
        let currentDate = new Date(displayStart);
        
        while (currentDate <= displayEnd) {
            dateRange.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        // Create data structure for heatmap
        const heatmapData = dateRange.map(date => {
            const dateStr = date.toISOString().split('T')[0];
            return {
                date: date,
                miles: runningData[dateStr] ? runningData[dateStr].distance_miles : 0,
                day: date.getDay(),
                month: date.getMonth(),
                year: date.getFullYear(),
                isCurrentYear: date.getFullYear() === year
            };
        });
        
        // Group dates by week (Sunday-Saturday)
        // Each Sunday starts a new week
        let weekCounter = 0;
        let currentWeek = [];
        const weeks = [];
        
        heatmapData.forEach(d => {
            if (d.day === 0 && currentWeek.length > 0) {
                // New Sunday, start a new week
                weeks.push(currentWeek);
                currentWeek = [];
                weekCounter++;
            }
            
            // Add date to current week with week index
            d.week = weekCounter;
            currentWeek.push(d);
        });
        
        // Add the last week if it has data
        if (currentWeek.length > 0) {
            weeks.push(currentWeek);
        }
        
        // Draw cells
        svg.selectAll(`.day${year}`)
            .data(heatmapData)
            .enter()
            .append('rect')
            .attr('class', `day${year}`)
            .attr('width', cellSize)
            .attr('height', cellSize)
            .attr('x', d => d.week * (cellSize + cellMargin))
            .attr('y', d => d.day * (cellSize + cellMargin) + yOffset)
            .attr('fill', d => {
                // For dates outside the current year, use lighter color
                if (!d.isCurrentYear) {
                    return '#f8f9fa'; // Very light gray for dates outside current year
                }
                return d.miles > 0 ? colorScale(d.miles) : '#ebedf0';
            })
            .attr('stroke', d => d.isCurrentYear ? 'none' : '#f0f0f0')
            .attr('stroke-width', 0.5)
            .append('title') // Tooltip
            .text(d => `${d.date.toDateString()}: ${d.miles.toFixed(2)} miles`);
            
        // Add month labels
        const months = d3.timeMonths(
            d3.timeMonth.floor(yearStart),
            d3.timeMonth.ceil(yearEnd)
        );
        
        svg.selectAll(`.monthLabel${year}`)
            .data(months)
            .enter()
            .append('text')
            .attr('class', `monthLabel${year}`)
            .attr('x', d => {
                // Find the first day of the month
                const firstDayOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
                // Find its data point to get the week
                const matchingData = heatmapData.find(item => 
                    item.date.getFullYear() === firstDayOfMonth.getFullYear() &&
                    item.date.getMonth() === firstDayOfMonth.getMonth() &&
                    item.date.getDate() === 1
                );
                
                return matchingData ? matchingData.week * (cellSize + cellMargin) : 0;
            })
            .attr('y', height + 15 + yOffset)
            .style('text-anchor', 'start')
            .style('font-size', '10px')
            .text(d => monthNames[d.getMonth()]);
    }
    
    function addLegend(svg, maxMiles, colorScale, width, yOffset) {
    const legendWidth = 200;
    const legendHeight = 10;

    const legend = svg.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(${(width - legendWidth)/2}, ${yOffset + 5})`); // Add 10px padding, Center the legend
           
    // Gradient definition
    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
        .attr('id', 'gradient')
        .attr('x1', '0%').attr('x2', '100%')
        .attr('y1', '0%').attr('y2', '0%');

    d3.range(0, 1.1, 0.2).forEach(t => {
        gradient.append('stop')
            .attr('offset', `${t * 100}%`)
            .attr('stop-color', colorScale(t * maxMiles));
    });

    // Legend bar
    legend.append('rect')
        .attr('width', legendWidth)
        .attr('height', legendHeight)
        .style('fill', 'url(#gradient)');

    // Legend axis
    const legendScale = d3.scaleLinear()
        .domain([0, maxMiles])
        .range([0, legendWidth]);

    legend.append('g')
        .attr('transform', `translate(0, ${legendHeight})`)
        .call(d3.axisBottom(legendScale).ticks(5).tickSize(6))
        .selectAll('text')
        .style('font-size', '8px');

    // Legend title
    legend.append('text')
        .attr('x', legendWidth / 2)
        .attr('y', -5)
        .attr('text-anchor', 'middle')
        .style('font-size', '10px')
        .text('Miles Run');
}
});