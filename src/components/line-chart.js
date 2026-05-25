import * as d3 from 'd3';
import { getDimensions, tooltip, formatValue } from '../utils/helpers.js';

/**
 * Reusable, Data-Agnostic, Fully Responsive D3 Multi-Line and Area Chart.
 * Extended to support dynamic dual-axis trend mapping.
 */
export class LineChart {
  /**
   * Constructs the line chart.
   * @param {string} selector - Selector of the container DOM element
   * @param {Object} config - Config mapping { xKey, yKey, groupKey, xScaleType, yLabel, colors, isDualAxis }
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
      margin: config.margin || { top: 30, right: 65, bottom: 40, left: 55 },
      colors: config.colors || d3.schemeTableau10,
      isDualAxis: config.isDualAxis || false
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
    this.yAxisRightGroup = this.g.append('g').attr('class', 'd3-axis y-axis-right');
    
    // Label for Y-Axis (Left)
    this.yLabelText = this.svg.append('text')
      .attr('class', 'control-label left-y-label')
      .attr('transform', 'rotate(-90)')
      .attr('text-anchor', 'middle')
      .attr('font-size', '0.7rem')
      .attr('fill', 'var(--text-secondary)');

    // Label for Y-Axis (Right) - only used in dual-axis
    this.yLabelRightText = this.svg.append('text')
      .attr('class', 'control-label right-y-label')
      .attr('transform', 'rotate(90)')
      .attr('text-anchor', 'middle')
      .attr('font-size', '0.7rem')
      .attr('fill', 'var(--text-secondary)')
      .style('opacity', 0);

    this.linesContainer = this.g.append('g').attr('class', 'lines-group');
    this.dotsContainer = this.g.append('g').attr('class', 'dots-group');

    // Dynamic color setup
    this.colorScale = d3.scaleOrdinal(this.config.colors);

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

    const { xKey, yKey, groupKey, xScaleType, isDualAxis } = this.config;

    // Standardize parsing for chronological schemas
    const parsedData = rawData.map(d => {
      const parsedX = xScaleType === 'time' && typeof d[xKey] === 'string' ? new Date(d[xKey]) : +d[xKey];
      return {
        ...d,
        _x: parsedX,
        _y: +d[yKey]
      };
    });

    if (!isDualAxis) {
      // Group items by series key
      this.nestedData = Array.from(
        d3.group(parsedData, d => d[groupKey]),
        ([key, values]) => ({ key, values: values.sort((a, b) => a._x - b._x) })
      );

      // Sync colors for key groups
      const uniqueKeys = this.nestedData.map(d => d.key);
      this.colorScale.domain(uniqueKeys);
    }

    this.draw(parsedData);
  }

  /**
   * Draws axes, path line structures, nodes, and legends.
   */
  draw(parsedData) {
    if (!this.data) return;

    // Get current dimensions
    const { margin, xScaleType, yLabel, isDualAxis } = this.config;
    const { width, height, innerWidth, innerHeight } = getDimensions(this.container, margin);

    // Update main container elements
    this.svg
      .attr('width', width)
      .attr('height', height);

    // Setup scale ranges
    const xScale = xScaleType === 'time' 
      ? d3.scaleTime().range([0, innerWidth]) 
      : d3.scaleLinear().range([0, innerWidth]);

    xScale.domain(d3.extent(parsedData, d => d._x));

    // Position X Axis
    this.xAxisGroup
      .attr('transform', `translate(0, ${innerHeight})`)
      .transition().duration(500)
      .call(d3.axisBottom(xScale).ticks(innerWidth > 500 ? 8 : 4).tickFormat(d3.timeFormat('%Y')));

    // Clear nodes
    this.linesContainer.selectAll('*').remove();
    this.dotsContainer.selectAll('*').remove();

    if (isDualAxis) {
      // DUAL AXIS MODE
      const yScaleLeft = d3.scaleLinear().range([innerHeight, 0])
        .domain([0, d3.max(parsedData, d => +d.layoffs) * 1.1 || 100]);

      const yScaleRight = d3.scaleLinear().range([innerHeight, 0])
        .domain([0, d3.max(parsedData, d => +d.datacenterPower) * 1.1 || 10]);

      // Call Left Axis (Tech Layoffs)
      this.yAxisGroup
        .transition().duration(500)
        .call(d3.axisLeft(yScaleLeft).ticks(innerHeight > 300 ? 6 : 3).tickFormat(formatValue));

      // Call Right Axis (DC Power capacity)
      this.yAxisRightGroup
        .attr('transform', `translate(${innerWidth}, 0)`)
        .style('opacity', 1)
        .transition().duration(500)
        .call(d3.axisRight(yScaleRight).ticks(innerHeight > 300 ? 6 : 3).tickFormat(d => `${d} GW`));

      // Position Left Label
      this.yLabelText
        .attr('x', -innerHeight / 2)
        .attr('y', 15)
        .text('Tech Employees Laid Off')
        .style('opacity', 1);

      // Position Right Label
      this.yLabelRightText
        .attr('x', innerHeight / 2)
        .attr('y', -width + 10)
        .text('Cumulative Data Center Power (GW)')
        .style('opacity', 1);

      // Render gridlines mapped to Left axis
      this.gridGroup.selectAll('line').remove();
      this.gridGroup.append('g')
        .attr('transform', `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale).tickSize(-innerHeight).tickFormat(''))
        .call(g => g.select('.domain').remove());

      this.gridGroup.append('g')
        .call(d3.axisLeft(yScaleLeft).tickSize(-innerWidth).tickFormat(''))
        .call(g => g.select('.domain').remove());

      // Line generators
      const lineLayoffs = d3.line()
        .x(d => xScale(d._x))
        .y(d => yScaleLeft(+d.layoffs))
        .curve(d3.curveMonotoneX);

      const areaLayoffs = d3.area()
        .x(d => xScale(d._x))
        .y0(innerHeight)
        .y1(d => yScaleLeft(+d.layoffs))
        .curve(d3.curveMonotoneX);

      const linePower = d3.line()
        .x(d => xScale(d._x))
        .y(d => yScaleRight(+d.datacenterPower))
        .curve(d3.curveMonotoneX);

      const areaPower = d3.area()
        .x(d => xScale(d._x))
        .y0(innerHeight)
        .y1(d => yScaleRight(+d.datacenterPower))
        .curve(d3.curveMonotoneX);

      // Draw Curve 1: Tech Layoffs (Coral red)
      const layoffsGroup = this.linesContainer.append('g').attr('class', 'line-group');
      layoffsGroup.append('path')
        .attr('class', 'chart-area')
        .attr('d', areaLayoffs(parsedData))
        .style('fill', 'var(--accent-danger)')
        .style('opacity', 0.12);
      layoffsGroup.append('path')
        .attr('class', 'chart-path')
        .attr('d', lineLayoffs(parsedData))
        .style('stroke', 'var(--accent-danger)');

      // Draw Curve 2: Data Center Power GW (Cyber blue)
      const powerGroup = this.linesContainer.append('g').attr('class', 'line-group');
      powerGroup.append('path')
        .attr('class', 'chart-area')
        .attr('d', areaPower(parsedData))
        .style('fill', 'var(--accent-primary)')
        .style('opacity', 0.12);
      powerGroup.append('path')
        .attr('class', 'chart-path')
        .attr('d', linePower(parsedData))
        .style('stroke', 'var(--accent-primary)');

      // Draw interactive dots
      const self = this;
      
      // Layoffs Dots
      this.dotsContainer.selectAll('.chart-node-layoffs')
        .data(parsedData)
        .enter().append('circle')
        .attr('class', 'chart-node chart-node-layoffs')
        .attr('r', 4.5)
        .attr('cx', d => xScale(d._x))
        .attr('cy', d => yScaleLeft(+d.layoffs))
        .style('fill', 'var(--bg-base)')
        .style('stroke', 'var(--accent-danger)')
        .on('mouseover', function(event, d) {
          d3.select(this).transition().duration(150).attr('r', 7.5);
          const htmlContent = `
            <div class="d3-tooltip-title">Tech Job Cuts Spikes</div>
            <div class="d3-tooltip-row">
              <span>Timeline:</span>
              <span class="d3-tooltip-val" style="color: #fff">${d3.timeFormat('%B %Y')(d._x)}</span>
            </div>
            <div class="d3-tooltip-row">
              <span>Cumulative Layoffs:</span>
              <span class="d3-tooltip-val" style="color: var(--accent-danger)">${formatValue(d.layoffs)} employees</span>
            </div>
            <div class="d3-tooltip-row">
              <span>Connotation:</span>
              <span class="d3-tooltip-val" style="color: var(--accent-warning); font-size:0.7rem">Infrastructure growth does not secure labor</span>
            </div>
          `;
          tooltip.show(htmlContent, event);
        })
        .on('mousemove', function(event) { tooltip.move(event); })
        .on('mouseout', function() {
          d3.select(this).transition().duration(150).attr('r', 4.5);
          tooltip.hide();
        });

      // Power Dots
      this.dotsContainer.selectAll('.chart-node-power')
        .data(parsedData)
        .enter().append('circle')
        .attr('class', 'chart-node chart-node-power')
        .attr('r', 4.5)
        .attr('cx', d => xScale(d._x))
        .attr('cy', d => yScaleRight(+d.datacenterPower))
        .style('fill', 'var(--bg-base)')
        .style('stroke', 'var(--accent-primary)')
        .on('mouseover', function(event, d) {
          d3.select(this).transition().duration(150).attr('r', 7.5);
          const htmlContent = `
            <div class="d3-tooltip-title">Corporate Infrastructure Boom</div>
            <div class="d3-tooltip-row">
              <span>Timeline:</span>
              <span class="d3-tooltip-val" style="color: #fff">${d3.timeFormat('%B %Y')(d._x)}</span>
            </div>
            <div class="d3-tooltip-row">
              <span>Data Center Capacity:</span>
              <span class="d3-tooltip-val" style="color: var(--accent-primary)">${d.datacenterPower} GW</span>
            </div>
            <div class="d3-tooltip-row">
              <span>Connotation:</span>
              <span class="d3-tooltip-val" style="color: var(--accent-secondary); font-size:0.7rem">Capital gain surges independently of jobs</span>
            </div>
          `;
          tooltip.show(htmlContent, event);
        })
        .on('mousemove', function(event) { tooltip.move(event); })
        .on('mouseout', function() {
          d3.select(this).transition().duration(150).attr('r', 4.5);
          tooltip.hide();
        });

      // Draw legends manually
      this.drawLegendDual();

    } else {
      // STANDARD SINGLE AXIS MODE
      this.yAxisRightGroup.style('opacity', 0);
      this.yLabelRightText.style('opacity', 0);

      const yScale = d3.scaleLinear().range([innerHeight, 0])
        .domain([0, d3.max(parsedData, d => d._y) * 1.1 || 10]);

      this.yAxisGroup
        .transition().duration(500)
        .call(d3.axisLeft(yScale).ticks(innerHeight > 300 ? 6 : 3).tickFormat(formatValue));

      this.yLabelText
        .attr('x', -innerHeight / 2 - margin.top)
        .attr('y', 15)
        .text(yLabel)
        .style('opacity', 1);

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

      // Fills
      linesEnter.append('path')
        .attr('class', 'chart-area')
        .style('fill', d => this.colorScale(d.key));

      // Paths
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
      const dots = this.dotsContainer.selectAll('.chart-node')
        .data(parsedData, (d, i) => `${d[this.config.groupKey]}-${d._x}`);

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

      const self = this;
      this.dotsContainer.selectAll('.chart-node')
        .on('mouseover', function(event, d) {
          d3.select(this).transition().duration(150).attr('r', 7.5);
          self.linesContainer.selectAll('.line-group')
            .transition().duration(200)
            .style('opacity', g => g.key === d[self.config.groupKey] ? 1.0 : 0.2);

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
        .on('mousemove', function(event) { tooltip.move(event); })
        .on('mouseout', function() {
          d3.select(this).transition().duration(150).attr('r', 4.5);
          self.linesContainer.selectAll('.line-group').transition().duration(200).style('opacity', 1.0);
          tooltip.hide();
        });

      this.drawLegend();
    }
  }

  /**
   * Appends external HTML indicators.
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
   * Draw dual axis legends manually.
   */
  drawLegendDual() {
    const legendContainer = document.getElementById(`legend-${this.container.id.replace('container-', '')}`);
    if (!legendContainer) return;

    legendContainer.innerHTML = '';
    const legendData = [
      { key: 'Cumulative Tech Layoffs', color: 'var(--accent-danger)' },
      { key: 'Data Center Power Capacity (GW)', color: 'var(--accent-primary)' }
    ];

    legendData.forEach(d => {
      const item = document.createElement('div');
      item.className = 'legend-item';
      
      const dot = document.createElement('span');
      dot.className = 'legend-color';
      dot.style.backgroundColor = d.color;
      
      const text = document.createElement('span');
      text.textContent = d.key;
      
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
      const { xKey, yKey, xScaleType } = this.config;
      const parsedData = this.data.map(d => {
        const parsedX = xScaleType === 'time' && typeof d[xKey] === 'string' ? new Date(d[xKey]) : +d[xKey];
        return { ...d, _x: parsedX, _y: +d[yKey] };
      });
      this.draw(parsedData);
    }
  }
}
