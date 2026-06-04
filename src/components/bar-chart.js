import * as d3 from 'd3';
import { getDimensions, tooltip, formatValue } from '../utils/helpers.js';

export class BarChart {
  /**
   * Constructs the Bar Chart.
   * @param {string} selector - Selector of the container DOM element
   * @param {Object} config - Config parameters
   */
  constructor(selector, config = {}) {
    this.container = document.querySelector(selector);
    if (!this.container) throw new Error(`Bar Container ${selector} not found`);

    this.config = {
      xKey: config.xKey || 'value',
      yKey: config.yKey || 'label',
      margin: config.margin || { top: 20, right: 30, bottom: 30, left: 110 },
      colors: config.colors || ['#00f2fe', '#4facfe', '#b100ff', '#ffb700', '#ff0844'],
      yLabel: config.yLabel || '',
      xTickFormat: config.xTickFormat || (d => `${d}%`),
      tooltipFormatter: config.tooltipFormatter || null,
      showValueLabels: config.showValueLabels || false,
      benchmarkLines: config.benchmarkLines || []
    };

    this.svg = null;
    this.g = null;
    this.data = null;

    this.init();
  }

  /**
   * Initializes visual SVG layout and registers structural elements.
   */
  init() {
    this.container.innerHTML = '';

    this.svg = d3.select(this.container)
      .append('svg')
      .attr('class', 'd3-chart');

    this.g = this.svg.append('g')
      .attr('transform', `translate(${this.config.margin.left}, ${this.config.margin.top})`);

    this.gridGroup = this.g.append('g').attr('class', 'd3-grid-lines');
    this.xAxisGroup = this.g.append('g').attr('class', 'd3-axis x-axis');
    this.yAxisGroup = this.g.append('g').attr('class', 'd3-axis y-axis');

    // Watch resize events
    if (this.container.__resizeObserver) {
      this.container.__resizeObserver.disconnect();
    }
    this.container.__resizeObserver = new ResizeObserver(() => this.resize());
    this.container.__resizeObserver.observe(this.container);
  }

  /**
   * Ingests, structures, and updates the data representation dynamically.
   * @param {Array} rawData - Array of data points
   */
  update(rawData) {
    if (!rawData || rawData.length === 0) return;
    this.data = rawData;
    this.draw();
  }

  /**
   * Draws axes, path line structures, nodes, and legends.
   */
  draw() {
    if (!this.data) return;

    const { margin, xKey, yKey, colors } = this.config;
    const { width, height, innerWidth, innerHeight } = getDimensions(this.container, margin);

    this.svg
      .attr('width', width)
      .attr('height', height);

    // Setup scales (Horizontal bar chart: Y is band scale, X is linear scale)
    const yScale = d3.scaleBand()
      .range([0, innerHeight])
      .domain(this.data.map(d => d[yKey]))
      .padding(0.25);

    const dataMax  = d3.max(this.data, d => +d[xKey]) || 100;
    const benchMax = this.config.benchmarkLines.reduce((m, l) => Math.max(m, l.value), 0);
    const xScale = d3.scaleLinear()
      .range([0, innerWidth])
      .domain([0, Math.max(dataMax, benchMax) * 1.1]);

    // Position axes
    this.xAxisGroup
      .attr('transform', `translate(0, ${innerHeight})`)
      .transition().duration(500)
      .call(d3.axisBottom(xScale).ticks(5).tickFormat(this.config.xTickFormat));

    this.yAxisGroup
      .transition().duration(500)
      .call(d3.axisLeft(yScale));

    // Handle multiline labels using \n
    this.yAxisGroup.selectAll('.tick text')
      .each(function(d) {
        if (typeof d === 'string' && d.includes('\n')) {
          const el = d3.select(this);
          const lines = d.split('\n');
          el.text('');
          lines.forEach((line, i) => {
            el.append('tspan')
              .attr('x', -10)
              .attr('dy', i === 0 ? '-0.3em' : '1.1em')
              .text(line);
          });
        }
      });

    // Render gridlines
    this.gridGroup.selectAll('line').remove();
    this.gridGroup.append('g')
      .attr('transform', `translate(0, ${innerHeight})`)
      .call(d3.axisBottom(xScale).tickSize(-innerHeight).tickFormat(''))
      .call(g => g.select('.domain').remove());

    // Color mapper
    const colorScale = d3.scaleOrdinal(colors)
      .domain(this.data.map(d => d[yKey]));

    // Draw bars
    const bars = this.g.selectAll('.chart-bar')
      .data(this.data, d => d[yKey]);

    // Enter
    const barsEnter = bars.enter().append('rect')
      .attr('class', 'chart-bar')
      .attr('y', d => yScale(d[yKey]))
      .attr('x', 0)
      .attr('height', yScale.bandwidth())
      .attr('width', 0)
      .style('fill', d => colorScale(d[yKey]))
      .style('rx', 4) // Rounded borders
      .style('ry', 4);

    // Merge
    const barsMerge = barsEnter.merge(bars);

    barsMerge
      .transition().duration(500)
      .attr('y', d => yScale(d[yKey]))
      .attr('height', yScale.bandwidth())
      .attr('width', d => xScale(+d[xKey]))
      .style('fill', d => colorScale(d[yKey]));

    // Tooltip bindings
    const self = this;
    barsMerge
      .on('mouseover', function(event, d) {
        d3.select(this)
          .transition().duration(150)
          .style('opacity', 0.85);

        let htmlContent;
        if (self.config.tooltipFormatter) {
          htmlContent = self.config.tooltipFormatter(d, colorScale(d[yKey]));
        } else {
          htmlContent = `
            <div class="d3-tooltip-title">U.S. Grid Electricity</div>
            <div class="d3-tooltip-row">
              <span>Generation Source:</span>
              <span class="d3-tooltip-val" style="color: ${colorScale(d[yKey])}">${d[yKey]}</span>
            </div>
            <div class="d3-tooltip-row">
              <span>Share of Total Grid:</span>
              <span class="d3-tooltip-val" style="color: #fff">${d[xKey]}%</span>
            </div>
          `;
        }
        tooltip.show(htmlContent, event);
      })
      .on('mousemove', function(event) {
        tooltip.move(event);
      })
      .on('mouseout', function() {
        d3.select(this)
          .transition().duration(150)
          .style('opacity', 1.0);
        tooltip.hide();
      });

    // Exit
    bars.exit()
      .transition().duration(300)
      .attr('width', 0)
      .remove();

    // Value labels at bar ends
    if (this.config.showValueLabels) {
      const valLabels = this.g.selectAll('.bar-val-label')
        .data(this.data, d => d[yKey]);

      valLabels.enter().append('text')
        .attr('class', 'bar-val-label')
        .attr('y', d => yScale(d[yKey]) + yScale.bandwidth() / 2)
        .attr('x', d => xScale(+d[xKey]))
        .attr('dy', '0.35em')
        .attr('opacity', 0)
        .merge(valLabels)
        .transition().duration(500).delay(280)
        .attr('y', d => yScale(d[yKey]) + yScale.bandwidth() / 2)
        .attr('x', d => xScale(+d[xKey]) + 7)
        .attr('opacity', 1)
        .attr('font-size', '10px')
        .attr('fill', 'var(--text-muted)');

      this.g.selectAll('.bar-val-label')
        .text(d => this.config.xTickFormat(+d[xKey]));

      valLabels.exit().remove();
    }

    // Benchmark reference lines
    this.g.selectAll('.bench-line-group').remove();
    this.config.benchmarkLines.forEach(({ value, label, color = 'var(--accent-success)' }) => {
      const bx = xScale(value);
      if (bx < 0 || bx > innerWidth) return;

      const bg = this.g.append('g').attr('class', 'bench-line-group');

      bg.append('line')
        .attr('x1', bx).attr('y1', 0)
        .attr('x2', bx).attr('y2', innerHeight)
        .attr('stroke', color)
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '5,3')
        .attr('stroke-opacity', 0.7);

      bg.append('text')
        .attr('x', bx - 5)
        .attr('y', -8)
        .attr('text-anchor', 'end')
        .attr('font-size', '9px')
        .attr('fill', color)
        .attr('font-weight', '600')
        .text(label);
    });
  }

  /**
   * Resizes coordinates and scales on screen adjust.
   */
  resize() {
    this.draw();
  }
}
