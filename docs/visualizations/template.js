/**
 * Visualization Template
 * Copy this file and modify for new visualizations
 */
function createNewVisualization() {
    // Configuration
    const width = 800;
    const height = 400;
    const margin = { top: 40, right: 30, bottom: 60, left: 50 };
    
    // Create SVG container
    const svg = d3.select('#visualization-element-id')
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top})`);
    
    // Fetch data
    fetch('path/to/data.json')
        .then(response => response.json())
        .then(data => {
            console.log("Loaded Data:", data);
            
            // Data processing and visualization code here
            // ...
            
        })
        .catch(error => {
            console.error('Error loading data:', error);
            d3.select('#visualization-element-id')
                .append('p')
                .text('Error loading data. Please check the console for details.');
        });
}

// Initialize when the DOM is ready
document.addEventListener('DOMContentLoaded', createNewVisualization);