import * as d3 from 'd3';
import { getDimensions, tooltip, formatValue } from '../utils/helpers.js';

/**
 * Reusable, Data-Agnostic, Fully Responsive D3 Multi-Line and Area Chart.
 */
export class LineChart {
  /**
   * Constructs the line chart.
   * @param {string} selector - Selector of the container DOM element
   * @param {Object} config - Config mapping { xKey, yKey, groupKey, xScaleType, yLabel, colors }
   */
  constructor(selector, config = {}) {
    this.container = document.querySelector(selector);
    if (!this.container) throw new Error(`Container ${selector} not found`);

    this.config = {
      xKey: config.xKey || 'x',
      yKey: config.yKey || 'y',
      groupKey: config.groupKey || 'series',
      xScaleType: config.xScaleType || 'linear', // 'linear' or 'time'
      yLabel: config.yLabel || 'Value',
      margin: config.margin || { top: 30, right: 30, bottom: 40, left: 55 },
      colors: config.colors || d3.schemeTableau10
    };

    this.svg = null;
    this.g = null;
    this.data = null;
    this.colorScale = null;

    this.init();
  }

  /**
   * Initializes visual SVG layout and registers structural elements.
   */
  init() {
    this.container.innerHTML = '';
    
    // Create base SVG
    this.svg = d3.select(this.container)
      .append('svg')
      .attr('class', 'd3-chart');

    this.g = this.svg.append('g')
      .attr('transform', `translate(${this.config.margin.left}, ${this.config.margin.top})`);

    // Setup structural groupings
    this.gridGroup = this.g.append('g').attr('class', 'd3-grid-lines');
    this.xAxisGroup = this.g.append('g').attr('class', 'd3-axis x-axis');
    this.yAxisGroup = this.g.append('g').attr('class', 'd3-axis y-axis');
    
    // Label for Y-Axis
    this.yLabelText = this.svg.append('text')
      .attr('class', 'control-label')
      .attr('transform', 'rotate(-90)')
      .attr('text-anchor', 'middle')
      .attr('font-size', '0.75rem')
      .attr('fill', 'var(--text-secondary)');

    this.linesContainer = this.g.append('g').attr('class', 'lines-group');
    this.dotsContainer = this.g.append('g').attr('class', 'dots-group');

    // Dynamic color setup
    this.colorScale = d3.scaleOrdinal(this.config.colors);

    // Watch resize events
    const resizeObserver = new ResizeObserver(() => this.resize());
    resizeObserver.observe(this.container);
  }

  /**
   * Ingests, structures, and updates the data representation dynamically.
   * @param {Array} rawData - Array of data points
   */
  update(rawData) {
    if (!rawData || rawData.length === 0) return;
    this.data = rawData;

    const { xKey, yKey, groupKey, xScaleType } = this.config;

    // Standardize parsing for chronological schemas
    const parsedData = rawData.map(d => {
      const parsedX = xScaleType === 'time' && typeof d[xKey] === 'string' ? new Date(d[xKey]) : +d[xKey];
      return {
        ...d,
        _x: parsedX,
        _y: +d[yKey]
      };
    });

    // Group items by series key
    this.nestedData = Array.from(
      d3.group(parsedData, d => d[groupKey]),
      ([key, values]) => ({ key, values: values.sort((a, b) => a._x - b._x) })
    );

    // Sync colors for key groups
    const uniqueKeys = this.nestedData.map(d => d.key);
    this.colorScale.domain(uniqueKeys);

    this.draw(parsedData);
  }

  /**
   * Draws axes, path line structures, nodes, and legends.
   */
  draw(parsedData) {
    if (!this.data) return;

    // Get current dimensions
    const { margin, xScaleType, yLabel } = this.config;
    const { width, height, innerWidth, innerHeight } = getDimensions(this.container, margin);

    // Update main container elements
    this.svg
      .attr('width', width)
      .attr('height', height);

    // Setup scale ranges
    const xScale = xScaleType === 'time' 
      ? d3.scaleTime().range([0, innerWidth]) 
      : d3.scaleLinear().range([0, innerWidth]);

    const yScale = d3.scaleLinear().range([innerHeight, 0]);

    // Compute scale domains
    xScale.domain(d3.extent(parsedData, d => d._x));
    yScale.domain([0, d3.max(parsedData, d => d._y) * 1.1 || 10]);

    // Position axes
    this.xAxisGroup
      .attr('transform', `translate(0, ${innerHeight})`)
      .transition().duration(500)
      .call(d3.axisBottom(xScale).ticks(innerWidth > 500 ? 8 : 4));

    this.yAxisGroup
      .transition().duration(500)
      .call(d3.axisLeft(yScale).ticks(innerHeight > 300 ? 6 : 3).tickFormat(formatValue));

    // Position Y label
    this.yLabelText
      .attr('x', -innerHeight / 2 - margin.top)
      .attr('y', 15)
      .text(yLabel);

    // Render gridlines
    this.gridGroup.selectAll('line').remove();
    this.gridGroup.append('g')
      .attr('transform', `translate(0, ${innerHeight})`)
      .call(d3.axisBottom(xScale).tickSize(-innerHeight).tickFormat(''))
      .call(g => g.select('.domain').remove());

    this.gridGroup.append('g')
      .call(d3.axisLeft(yScale).tickSize(-innerWidth).tickFormat(''))
      .call(g => g.select('.domain').remove());

    // Path generators
    const lineGenerator = d3.line()
      .x(d => xScale(d._x))
      .y(d => yScale(d._y))
      .curve(d3.curveMonotoneX);

    const areaGenerator = d3.area()
      .x(d => xScale(d._x))
      .y0(innerHeight)
      .y1(d => yScale(d._y))
      .curve(d3.curveMonotoneX);

    // Update Line Groups (Enter/Update/Exit)
    const lines = this.linesContainer.selectAll('.line-group')
      .data(this.nestedData, d => d.key);

    const linesEnter = lines.enter().append('g')
      .attr('class', 'line-group');

    // Appending dynamic fills (area)
    linesEnter.append('path')
      .attr('class', 'chart-area')
      .style('fill', d => this.colorScale(d.key));

    // Appending lines
    linesEnter.append('path')
      .attr('class', 'chart-path')
      .style('stroke', d => this.colorScale(d.key));

    const linesMerge = linesEnter.merge(lines);

    // Transition Area fills
    linesMerge.select('.chart-area')
      .transition().duration(500)
      .attr('d', d => areaGenerator(d.values));

    // Transition Paths
    linesMerge.select('.chart-path')
      .transition().duration(500)
      .attr('d', d => lineGenerator(d.values));

    lines.exit().remove();

    // Node Interactive Dots
    const dotsData = parsedData;
    const dots = this.dotsContainer.selectAll('.chart-node')
      .data(dotsData, (d, i) => `${d[this.config.groupKey]}-${d._x}`);

    dots.enter().append('circle')
      .attr('class', 'chart-node')
      .attr('r', 0)
      .attr('cx', d => xScale(d._x))
      .attr('cy', d => yScale(d._y))
      .style('fill', 'var(--bg-base)')
      .style('stroke', d => this.colorScale(d[this.config.groupKey]))
      .merge(dots)
      .transition().duration(500)
      .attr('r', 4.5)
      .attr('cx', d => xScale(d._x))
      .attr('cy', d => yScale(d._y));

    dots.exit()
      .transition().duration(300)
      .attr('r', 0)
      .remove();

    // Rebind Interaction Events to Nodes
    const self = this;
    this.dotsContainer.selectAll('.chart-node')
      .on('mouseover', function(event, d) {
        d3.select(this)
          .transition().duration(150)
          .attr('r', 7.5);

        // Visual highlights - dim other paths
        self.linesContainer.selectAll('.line-group')
          .transition().duration(200)
          .style('opacity', g => g.key === d[self.config.groupKey] ? 1.0 : 0.2);

        // Tooltip Content
        const xString = self.config.xScaleType === 'time'
          ? d3.timeFormat('%B %Y')(d._x)
          : `${self.config.xKey}: ${d[self.config.xKey]}`;

        const htmlContent = `
          <div class="d3-tooltip-title">${d[self.config.groupKey]}</div>
          <div class="d3-tooltip-row">
            <span>Dimension:</span>
            <span class="d3-tooltip-val">${xString}</span>
          </div>
          <div class="d3-tooltip-row">
            <span>${self.config.yLabel}:</span>
            <span class="d3-tooltip-val">${formatValue(d._y)}</span>
          </div>
        `;
        tooltip.show(htmlContent, event);
      })
      .on('mousemove', function(event) {
        tooltip.move(event);
      })
      .on('mouseout', function() {
        d3.select(this)
          .transition().duration(150)
          .attr('r', 4.5);

        // Restore visual opacity of lines
        self.linesContainer.selectAll('.line-group')
          .transition().duration(200)
          .style('opacity', 1.0);

        tooltip.hide();
      });

    // Redraw custom dynamic legends
    this.drawLegend();
  }

  /**
   * Appends external, beautifully formatted HTML indicators.
   */
  drawLegend() {
    const legendContainer = document.getElementById(`legend-${this.container.id.replace('container-', '')}`);
    if (!legendContainer) return;

    legendContainer.innerHTML = '';
    this.colorScale.domain().forEach(key => {
      const item = document.createElement('div');
      item.className = 'legend-item';
      
      const dot = document.createElement('span');
      dot.className = 'legend-color';
      dot.style.backgroundColor = this.colorScale(key);
      
      const text = document.createElement('span');
      text.textContent = key;
      
      item.appendChild(dot);
      item.appendChild(text);
      legendContainer.appendChild(item);
    });
  }

  /**
   * Resizes coordinates and scales on screen adjust.
   */
  resize() {
    if (this.data) {
      // Re-map with internal parsing structure
      const { xKey, yKey, xScaleType } = this.config;
      const parsedData = this.data.map(d => {
        const parsedX = xScaleType === 'time' && typeof d[xKey] === 'string' ? new Date(d[xKey]) : +d[xKey];
        return { ...d, _x: parsedX, _y: +d[yKey] };
      });
      this.draw(parsedData);
    }
  }
}
