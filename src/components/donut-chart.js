import * as d3 from 'd3';
import { getDimensions, tooltip, formatValue } from '../utils/helpers.js';

/**
 * Reusable, Data-Agnostic, Fully Responsive D3 Donut Chart with Arc Expansion Tweens.
 */
export class DonutChart {
  /**
   * Constructs the donut chart.
   * @param {string} selector - Container selector
   * @param {Object} config - Config mapping { categoryKey, valueKey, colors, innerRadiusRatio }
   */
  constructor(selector, config = {}) {
    this.container = document.querySelector(selector);
    if (!this.container) throw new Error(`Container ${selector} not found`);

    this.config = {
      categoryKey: config.categoryKey || 'label',
      valueKey: config.valueKey || 'value',
      innerRadiusRatio: config.innerRadiusRatio !== undefined ? config.innerRadiusRatio : 0.6,
      margin: config.margin || { top: 20, right: 20, bottom: 20, left: 20 },
      colors: config.colors || d3.schemeSpectral[8]
    };

    this.svg = null;
    this.g = null;
    this.data = null;
    this.colorScale = null;

    this.init();
  }

  /**
   * Sets up base SVG and canvas centers.
   */
  init() {
    this.container.innerHTML = '';

    this.svg = d3.select(this.container)
      .append('svg')
      .attr('class', 'd3-chart');

    // Group centered in the SVG
    this.g = this.svg.append('g');

    // Central Label group inside the donut hole
    this.centerTextGroup = this.g.append('g')
      .attr('class', 'donut-center-label')
      .style('pointer-events', 'none');

    this.centerValue = this.centerTextGroup.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.2em')
      .attr('font-size', '1.75rem')
      .attr('font-weight', '700')
      .attr('fill', 'var(--text-primary)')
      .attr('font-family', 'var(--font-family-title)')
      .text('--');

    this.centerLabel = this.centerTextGroup.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '1.2em')
      .attr('font-size', '0.75rem')
      .attr('font-weight', '600')
      .attr('text-transform', 'uppercase')
      .attr('letter-spacing', '1px')
      .attr('fill', 'var(--text-muted)')
      .attr('font-family', 'var(--font-family-body)')
      .text('Total Ratio');

    this.colorScale = d3.scaleOrdinal(this.config.colors);

    // Resize observer
    const resizeObserver = new ResizeObserver(() => this.resize());
    resizeObserver.observe(this.container);
  }

  /**
   * Binds data values and updates colors.
   * @param {Array} rawData - Categorical breakdown points
   */
  update(rawData) {
    if (!rawData || rawData.length === 0) return;
    this.data = rawData;

    // Sync categories
    const categories = rawData.map(d => d[this.config.categoryKey]);
    this.colorScale.domain(categories);

    this.draw();
  }

  /**
   * Computes pie layout partitions and draws arcs.
   */
  draw() {
    if (!this.data) return;

    const { margin, categoryKey, valueKey, innerRadiusRatio } = this.config;
    const { width, height } = getDimensions(this.container, margin);

    this.svg
      .attr('width', width)
      .attr('height', height);

    const radius = Math.min(width - margin.left - margin.right, height - margin.top - margin.bottom) / 2;
    const innerRadius = radius * innerRadiusRatio;

    // Shift center coordinate
    this.g.attr('transform', `translate(${width / 2}, ${height / 2})`);

    // Standard D3 Pie mapping
    const pie = d3.pie()
      .value(d => +d[valueKey])
      .sort(null);

    // Arc Builders
    const arc = d3.arc()
      .innerRadius(innerRadius)
      .outerRadius(radius);

    const arcHover = d3.arc()
      .innerRadius(innerRadius)
      .outerRadius(radius + 8); // Outward expansion on hover

    const pieData = pie(this.data);

    // Compute Total Value in center
    const totalVal = d3.sum(this.data, d => +d[valueKey]);
    this.centerValue.text(formatValue(totalVal));
    this.centerLabel.text('Total Value');

    // Join Arc Slices
    const slices = this.g.selectAll('.donut-slice')
      .data(pieData, d => d.data[categoryKey]);

    // Enter selection
    const slicesEnter = slices.enter().append('path')
      .attr('class', 'donut-slice')
      .style('fill', d => this.colorScale(d.data[categoryKey]))
      .attr('d', arc)
      .each(function(d) { this._current = d; }); // Store current angles for tween transitions

    const slicesMerge = slicesEnter.merge(slices);

    // Transition slices using custom Arc Tween interpolator
    slicesMerge.transition().duration(500)
      .attrTween('d', function(d) {
        const interpolate = d3.interpolate(this._current, d);
        this._current = interpolate(0);
        return function(t) {
          return arc(interpolate(t));
        };
      })
      .style('fill', d => this.colorScale(d.data[categoryKey]));

    slices.exit()
      .transition().duration(300)
      .attrTween('d', function(d) {
        // Shrink slice to start angle on exit
        const interpolate = d3.interpolate(d, { startAngle: d.startAngle, endAngle: d.startAngle });
        return function(t) {
          return arc(interpolate(t));
        };
      })
      .remove();

    // Rebind Events for Arc Expansion & Center Labels
    const self = this;
    slicesMerge
      .on('mouseover', function(event, d) {
        // Expand slice path
        d3.select(this)
          .transition().duration(200)
          .attr('d', arcHover);

        // Update central values to hover details
        self.centerValue
          .text(formatValue(+d.data[valueKey]))
          .attr('fill', self.colorScale(d.data[categoryKey]));
        self.centerLabel.text(d.data[categoryKey]);

        // Floating HTML tooltip
        const percent = ((d.endAngle - d.startAngle) / (2 * Math.PI) * 100).toFixed(1);
        const htmlContent = `
          <div class="d3-tooltip-title">${d.data[categoryKey]}</div>
          <div class="d3-tooltip-row">
            <span>Share Value:</span>
            <span class="d3-tooltip-val">${formatValue(+d.data[valueKey])}</span>
          </div>
          <div class="d3-tooltip-row">
            <span>Proportion:</span>
            <span class="d3-tooltip-val">${percent}%</span>
          </div>
        `;
        tooltip.show(htmlContent, event);
      })
      .on('mousemove', function(event) {
        tooltip.move(event);
      })
      .on('mouseout', function() {
        // Restore slice path size
        d3.select(this)
          .transition().duration(200)
          .attr('d', arc);

        // Restore central totals
        self.centerValue
          .text(formatValue(totalVal))
          .attr('fill', 'var(--text-primary)');
        self.centerLabel.text('Total Value');

        tooltip.hide();
      });

    // Legends
    this.drawLegend();
  }

  /**
   * Draws dynamic colors legend items
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
   * Resizes donut arc dimensions dynamically
   */
  resize() {
    if (this.data) this.draw();
  }
}
