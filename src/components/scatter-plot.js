import * as d3 from 'd3';
import { getDimensions, tooltip, formatValue } from '../utils/helpers.js';

/**
 * Reusable, Data-Agnostic, Fully Responsive D3 Bubble/Scatter Plot with Hover Crosshairs.
 */
export class ScatterPlot {
  /**
   * Constructs the scatter plot.
   * @param {string} selector - Container DOM selector
   * @param {Object} config - Config mapping { xKey, yKey, sizeKey, groupKey, labelKey, xLabel, yLabel, colors }
   */
  constructor(selector, config = {}) {
    this.container = document.querySelector(selector);
    if (!this.container) throw new Error(`Container ${selector} not found`);

    this.config = {
      xKey: config.xKey || 'x',
      yKey: config.yKey || 'y',
      sizeKey: config.sizeKey || 'size',
      groupKey: config.groupKey || 'group',
      labelKey: config.labelKey || 'label',
      xLabel: config.xLabel || 'X Dimension',
      yLabel: config.yLabel || 'Y Dimension',
      margin: config.margin || { top: 30, right: 30, bottom: 50, left: 55 },
      colors: config.colors || d3.schemeSet2
    };

    this.svg = null;
    this.g = null;
    this.data = null;
    this.colorScale = null;

    this.init();
  }

  /**
   * Initializes SVG canvas elements and axis indicators.
   */
  init() {
    this.container.innerHTML = '';

    this.svg = d3.select(this.container)
      .append('svg')
      .attr('class', 'd3-chart');

    this.g = this.svg.append('g')
      .attr('transform', `translate(${this.config.margin.left}, ${this.config.margin.top})`);

    // structural groupings
    this.gridGroup = this.g.append('g').attr('class', 'd3-grid-lines');
    this.xAxisGroup = this.g.append('g').attr('class', 'd3-axis x-axis');
    this.yAxisGroup = this.g.append('g').attr('class', 'd3-axis y-axis');

    // Axes Labels
    this.xLabelText = this.svg.append('text')
      .attr('class', 'control-label')
      .attr('text-anchor', 'middle')
      .attr('font-size', '0.75rem')
      .attr('fill', 'var(--text-secondary)');

    this.yLabelText = this.svg.append('text')
      .attr('class', 'control-label')
      .attr('transform', 'rotate(-90)')
      .attr('text-anchor', 'middle')
      .attr('font-size', '0.75rem')
      .attr('fill', 'var(--text-secondary)');

    // Hover Alignment Guides (Crosshair)
    this.crosshair = this.g.append('g')
      .attr('class', 'd3-crosshair')
      .style('opacity', 0);

    this.crosshair.append('line')
      .attr('id', 'crosshair-x')
      .style('stroke', 'var(--accent-primary)')
      .style('stroke-width', '1.5px')
      .style('stroke-dasharray', '4,4');

    this.crosshair.append('line')
      .attr('id', 'crosshair-y')
      .style('stroke', 'var(--accent-primary)')
      .style('stroke-width', '1.5px')
      .style('stroke-dasharray', '4,4');

    this.bubblesContainer = this.g.append('g').attr('class', 'bubbles-group');

    this.colorScale = d3.scaleOrdinal(this.config.colors);

    // Watch resize events
    if (this.container.__resizeObserver) {
      this.container.__resizeObserver.disconnect();
    }
    this.container.__resizeObserver = new ResizeObserver(() => this.resize());
    this.container.__resizeObserver.observe(this.container);
  }

  /**
   * Ingests and renders data structures dynamically.
   * @param {Array} rawData - Scatter data points
   */
  update(rawData) {
    if (!rawData || rawData.length === 0) return;
    this.data = rawData;

    // Map colors to unique groups
    const uniqueGroups = Array.from(new Set(rawData.map(d => d[this.config.groupKey])));
    this.colorScale.domain(uniqueGroups);

    this.draw();
  }

  /**
   * Positions bubbles, crosshair coordinates, and axes grids.
   */
  draw() {
    if (!this.data) return;

    const { margin, xKey, yKey, sizeKey, groupKey, labelKey, xLabel, yLabel } = this.config;
    const { width, height, innerWidth, innerHeight } = getDimensions(this.container, margin);

    this.svg
      .attr('width', width)
      .attr('height', height);

    // Set linear scales
    const xScale = d3.scaleLinear()
      .domain([0, d3.max(this.data, d => +d[xKey]) * 1.1 || 100])
      .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(this.data, d => +d[yKey]) * 1.1 || 100])
      .range([innerHeight, 0]);

    // Bubble Size Map
    const sizeScale = d3.scaleSqrt()
      .domain(d3.extent(this.data, d => +d[sizeKey]))
      .range([5, innerWidth > 500 ? 25 : 12]);

    // Draw Axes
    this.xAxisGroup
      .attr('transform', `translate(0, ${innerHeight})`)
      .transition().duration(500)
      .call(d3.axisBottom(xScale).ticks(innerWidth > 500 ? 8 : 4));

    this.yAxisGroup
      .transition().duration(500)
      .call(d3.axisLeft(yScale).ticks(innerHeight > 300 ? 6 : 3).tickFormat(formatValue));

    // Place labels
    this.xLabelText
      .attr('x', innerWidth / 2 + margin.left)
      .attr('y', height - 5)
      .text(xLabel);

    this.yLabelText
      .attr('x', -innerHeight / 2 - margin.top)
      .attr('y', 15)
      .text(yLabel);

    // Gridlines
    this.gridGroup.selectAll('line').remove();
    this.gridGroup.append('g')
      .attr('transform', `translate(0, ${innerHeight})`)
      .call(d3.axisBottom(xScale).tickSize(-innerHeight).tickFormat(''))
      .call(g => g.select('.domain').remove());

    this.gridGroup.append('g')
      .call(d3.axisLeft(yScale).tickSize(-innerWidth).tickFormat(''))
      .call(g => g.select('.domain').remove());

    // Join data for Bubbles (Enter/Update/Exit)
    const bubbles = this.bubblesContainer.selectAll('.chart-node')
      .data(this.data, d => d[labelKey]);

    const bubblesEnter = bubbles.enter().append('circle')
      .attr('class', 'chart-node')
      .attr('cx', d => xScale(+d[xKey]))
      .attr('cy', d => yScale(+d[yKey]))
      .attr('r', 0)
      .style('fill', d => this.colorScale(d[groupKey]))
      .style('stroke', '#ffffff')
      .style('stroke-width', '1px')
      .style('fill-opacity', 0.65);

    const bubblesMerge = bubblesEnter.merge(bubbles);

    bubblesMerge.transition().duration(500)
      .attr('cx', d => xScale(+d[xKey]))
      .attr('cy', d => yScale(+d[yKey]))
      .attr('r', d => sizeScale(+d[sizeKey]))
      .style('fill', d => this.colorScale(d[groupKey]));

    bubbles.exit()
      .transition().duration(300)
      .attr('r', 0)
      .remove();

    // Rebind Events for Crosshair Guides & Tooltips
    const self = this;
    bubblesMerge
      .on('mouseover', function(event, d) {
        const cx = xScale(+d[xKey]);
        const cy = yScale(+d[yKey]);
        const r = sizeScale(+d[sizeKey]);

        // Elevate visual depth on hover
        d3.select(this)
          .transition().duration(150)
          .style('fill-opacity', 0.95)
          .attr('r', r + 4);

        // Highlight crosshair coordinates
        self.crosshair.style('opacity', 1);
        self.crosshair.select('#crosshair-x')
          .attr('x1', cx).attr('y1', cy)
          .attr('x2', cx).attr('y2', innerHeight);

        self.crosshair.select('#crosshair-y')
          .attr('x1', cx).attr('y1', cy)
          .attr('x2', 0).attr('y2', cy);

        // Render premium custom tooltip content
        const htmlContent = `
          <div class="d3-tooltip-title">${d[labelKey]}</div>
          <div class="d3-tooltip-row">
            <span>Group:</span>
            <span class="d3-tooltip-val" style="color: ${self.colorScale(d[groupKey])}">${d[groupKey]}</span>
          </div>
          <div class="d3-tooltip-row">
            <span>${xLabel}:</span>
            <span class="d3-tooltip-val">${formatValue(+d[xKey])}</span>
          </div>
          <div class="d3-tooltip-row">
            <span>${yLabel}:</span>
            <span class="d3-tooltip-val">${formatValue(+d[yKey])}</span>
          </div>
          <div class="d3-tooltip-row">
            <span>Scale/Size:</span>
            <span class="d3-tooltip-val">${formatValue(+d[sizeKey])}</span>
          </div>
        `;
        tooltip.show(htmlContent, event);
      })
      .on('mousemove', function(event) {
        tooltip.move(event);
      })
      .on('mouseout', function() {
        const r = sizeScale(+d3.select(this).datum()[sizeKey]);

        // Reset depth & size
        d3.select(this)
          .transition().duration(150)
          .style('fill-opacity', 0.65)
          .attr('r', r);

        // Hide alignments
        self.crosshair.style('opacity', 0);
        tooltip.hide();
      });

    // Populate standard legends
    this.drawLegend();
  }

  /**
   * Renders legends inside container
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
   * Resize updates
   */
  resize() {
    if (this.data) this.draw();
  }
}
