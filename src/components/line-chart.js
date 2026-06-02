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
      isDualAxis: config.isDualAxis || false,
      dashedSeries: config.dashedSeries || [],
      noAreaSeries: config.noAreaSeries || [],
      xTickInterval: config.xTickInterval || null,
      inlineLegend: config.inlineLegend || false
    };

    this.svg = null;
    this.g = null;
    this.data = null;
    this.colorScale = null;
    this._animated = false;
    this._lastWidth = 0;
    this._lastHeight = 0;

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
    this.dotsContainer  = this.g.append('g').attr('class', 'dots-group');
    this.legendGroup    = this.g.append('g').attr('class', 'inline-legend-group');

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
    if (innerWidth <= 0 || innerHeight <= 0) return; // defer to ResizeObserver once layout is ready
    this._lastWidth  = width;
    this._lastHeight = height;

    // Update main container elements
    this.svg
      .attr('width', width)
      .attr('height', height);

    // Setup scale ranges
    const xScale = xScaleType === 'time' 
      ? d3.scaleTime().range([0, innerWidth]) 
      : d3.scaleLinear().range([0, innerWidth]);

    xScale.domain(d3.extent(parsedData, d => d._x));

    // Position X Axis — interval configurable, year labels only on Jan 1
    const xTickInterval = this.config.xTickInterval || d3.timeMonth.every(3);
    this.xAxisGroup
      .attr('transform', `translate(0, ${innerHeight})`)
      .transition().duration(500)
      .call(d3.axisBottom(xScale)
        .ticks(xTickInterval)
        .tickFormat(d => d.getMonth() === 0 ? d3.timeFormat('%Y')(d) : '')
        .tickSizeOuter(0));

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
        .defined(d => d.datacenterPower != null)
        .x(d => xScale(d._x))
        .y(d => yScaleRight(+d.datacenterPower))
        .curve(d3.curveMonotoneX);

      const areaPower = d3.area()
        .defined(d => d.datacenterPower != null)
        .x(d => xScale(d._x))
        .y0(innerHeight)
        .y1(d => yScaleRight(+d.datacenterPower))
        .curve(d3.curveMonotoneX);

      const enterDuration = this._animated ? 0 : 1100;
      const enterDelay    = this._animated ? 0 : 180;
      const enterEase     = d3.easeCubicOut;

      // Draw Curve 1: Tech Layoffs (Coral red)
      const layoffsGroup = this.linesContainer.append('g').attr('class', 'line-group');
      layoffsGroup.append('path')
        .attr('class', 'chart-area')
        .attr('d', areaLayoffs(parsedData))
        .style('fill', 'var(--accent-danger)')
        .style('opacity', this._animated ? 0.12 : 0)
        .transition().duration(enterDuration).ease(enterEase)
        .style('opacity', 0.12);
      const layoffsLinePath = layoffsGroup.append('path')
        .attr('class', 'chart-path')
        .attr('d', lineLayoffs(parsedData))
        .style('stroke', 'var(--accent-danger)');
      if (!this._animated) {
        const lLen = layoffsLinePath.node().getTotalLength();
        layoffsLinePath
          .attr('stroke-dasharray', `${lLen} ${lLen}`)
          .attr('stroke-dashoffset', lLen)
          .transition().duration(enterDuration).ease(d3.easeLinear)
          .attr('stroke-dashoffset', 0)
          .on('end', function() { d3.select(this).attr('stroke-dasharray', null).attr('stroke-dashoffset', null); });
      }

      // Draw Curve 2: Data Center Power GW (Cyber blue) — delayed slightly
      const powerGroup = this.linesContainer.append('g').attr('class', 'line-group');
      powerGroup.append('path')
        .attr('class', 'chart-area')
        .attr('d', areaPower(parsedData))
        .style('fill', 'var(--accent-primary)')
        .style('opacity', this._animated ? 0.12 : 0)
        .transition().delay(enterDelay).duration(enterDuration).ease(enterEase)
        .style('opacity', 0.12);
      const powerLinePath = powerGroup.append('path')
        .attr('class', 'chart-path')
        .attr('d', linePower(parsedData))
        .style('stroke', 'var(--accent-primary)');
      if (!this._animated) {
        const pLen = powerLinePath.node().getTotalLength();
        powerLinePath
          .attr('stroke-dasharray', `${pLen} ${pLen}`)
          .attr('stroke-dashoffset', pLen)
          .transition().delay(enterDelay).duration(enterDuration).ease(d3.easeLinear)
          .attr('stroke-dashoffset', 0)
          .on('end', function() { d3.select(this).attr('stroke-dasharray', null).attr('stroke-dashoffset', null); });
      }

      // Draw interactive dots
      const self = this;

      // Layoffs Dots — stagger left-to-right matching line draw speed
      const nLayoffs = parsedData.length;
      this.dotsContainer.selectAll('.chart-node-layoffs')
        .data(parsedData)
        .enter().append('circle')
        .attr('class', 'chart-node chart-node-layoffs')
        .attr('r', 0)
        .attr('cx', d => xScale(d._x))
        .attr('cy', d => yScaleLeft(+d.layoffs))
        .style('fill', 'var(--bg-base)')
        .style('stroke', 'var(--accent-danger)')
        .transition()
        .delay((d, i) => this._animated ? 0 : (i / Math.max(nLayoffs - 1, 1)) * enterDuration)
        .duration(250).ease(d3.easeCubicOut)
        .attr('r', 4.5);

      this.dotsContainer.selectAll('.chart-node-layoffs')
        .on('mouseover', function(event, d) {
          d3.select(this).transition().duration(150).attr('r', 7.5);
          const qNum = Math.ceil((d._x.getMonth() + 1) / 3);
          const htmlContent = `
            <div class="d3-tooltip-title">Tech Layoffs</div>
            <div class="d3-tooltip-row">
              <span>Period:</span>
              <span class="d3-tooltip-val" style="color: #fff">Q${qNum} ${d3.timeFormat('%Y')(d._x)}</span>
            </div>
            <div class="d3-tooltip-row">
              <span>Employees laid off:</span>
              <span class="d3-tooltip-val" style="color: var(--accent-danger)">${Math.round(d.layoffs).toLocaleString()}</span>
            </div>
          `;
          tooltip.show(htmlContent, event);
        })
        .on('mousemove', function(event) { tooltip.move(event); })
        .on('mouseout', function() {
          d3.select(this).transition().duration(150).attr('r', 4.5);
          tooltip.hide();
        });

      // Power Dots — yearly snapshots, staggered left-to-right after line delay
      const powerDotData = parsedData.filter(d => d.isYearStart && d.datacenterPower != null);
      const nPower = powerDotData.length;
      this.dotsContainer.selectAll('.chart-node-power')
        .data(powerDotData)
        .enter().append('circle')
        .attr('class', 'chart-node chart-node-power')
        .attr('r', 0)
        .attr('cx', d => xScale(d._x))
        .attr('cy', d => yScaleRight(+d.datacenterPower))
        .style('fill', 'var(--bg-base)')
        .style('stroke', 'var(--accent-primary)')
        .transition()
        .delay((d, i) => this._animated ? 0 : enterDelay + (i / Math.max(nPower - 1, 1)) * enterDuration)
        .duration(250).ease(d3.easeCubicOut)
        .attr('r', 4.5);

      this.dotsContainer.selectAll('.chart-node-power')
        .on('mouseover', function(event, d) {
          d3.select(this).transition().duration(150).attr('r', 7.5);
          const htmlContent = `
            <div class="d3-tooltip-title">DC Power Capacity</div>
            <div class="d3-tooltip-row">
              <span>Year:</span>
              <span class="d3-tooltip-val" style="color: #fff">${d3.timeFormat('%Y')(d._x)}</span>
            </div>
            <div class="d3-tooltip-row">
              <span>Active capacity:</span>
              <span class="d3-tooltip-val" style="color: var(--accent-primary)">${d.datacenterPower} GW</span>
            </div>
          `;
          tooltip.show(htmlContent, event);
        })
        .on('mousemove', function(event) { tooltip.move(event); })
        .on('mouseout', function() {
          d3.select(this).transition().duration(150).attr('r', 4.5);
          tooltip.hide();
        });

      this._animated = true;

      // Draw legends manually
      this.drawLegendDual();

    } else {
      // STANDARD SINGLE AXIS MODE
      const self = this;
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

      const enterDuration = this._animated ? 500 : 950;
      const seriesDelay   = (i) => this._animated ? 0 : i * 160;

      // Update Line Groups (Enter/Update/Exit)
      const lines = this.linesContainer.selectAll('.line-group')
        .data(this.nestedData, d => d.key);

      const linesEnter = lines.enter().append('g')
        .attr('class', 'line-group');

      // Fills — set actual shape immediately, fade in on first load
      linesEnter.append('path')
        .attr('class', 'chart-area')
        .style('fill', d => this.colorScale(d.key))
        .attr('d', d => areaGenerator(d.values))
        .style('opacity', this._animated ? null : 0);

      // Paths — set full path, then animate draw left-to-right via dashoffset on first load
      linesEnter.append('path')
        .attr('class', 'chart-path')
        .style('stroke', d => this.colorScale(d.key))
        .attr('d', d => lineGenerator(d.values));

      if (!this._animated) {
        linesEnter.select('.chart-path').each(function() {
          const len = this.getTotalLength();
          d3.select(this)
            .attr('stroke-dasharray', `${len} ${len}`)
            .attr('stroke-dashoffset', len);
        });
      } else {
        linesEnter.select('.chart-path')
          .attr('stroke-dasharray', d => self.config.dashedSeries.includes(d.key) ? '6 4' : null);
      }

      const linesMerge = linesEnter.merge(lines);

      // Transition Area fills — fade in staggered per series; update shape on resize
      linesMerge.select('.chart-area')
        .style('display', d => this.config.noAreaSeries.includes(d.key) ? 'none' : null)
        .transition()
        .delay((d, i) => seriesDelay(i))
        .duration(enterDuration)
        .ease(d3.easeCubicOut)
        .style('opacity', null)
        .attr('d', d => areaGenerator(d.values));

      // Transition Paths — draw left-to-right on first load, instant path update on resize
      if (!this._animated) {
        linesMerge.select('.chart-path')
          .transition()
          .delay((d, i) => seriesDelay(i))
          .duration(enterDuration)
          .ease(d3.easeLinear)
          .attr('stroke-dashoffset', 0)
          .on('end', function(event, d) {
            d3.select(this)
              .attr('stroke-dasharray', self.config.dashedSeries.includes(d.key) ? '6 4' : null)
              .attr('stroke-dashoffset', null);
          });
      } else {
        linesMerge.select('.chart-path')
          .attr('stroke-dasharray', d => this.config.dashedSeries.includes(d.key) ? '6 4' : null)
          .transition().duration(500)
          .attr('d', d => lineGenerator(d.values));
      }

      lines.exit().remove();

      // Node Interactive Dots — stagger left-to-right per series matching line draw
      const dotDelayMap = new Map();
      if (!this._animated) {
        this.nestedData.forEach((s, si) => {
          s.values.forEach((v, vi) => {
            dotDelayMap.set(`${v[this.config.groupKey]}-${+v._x}`,
              seriesDelay(si) + (vi / Math.max(s.values.length - 1, 1)) * enterDuration);
          });
        });
      }

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
        .transition()
        .delay(d => this._animated ? 0 : (dotDelayMap.get(`${d[this.config.groupKey]}-${+d._x}`) || 0))
        .duration(250).ease(d3.easeCubicOut)
        .attr('r', 4.5)
        .attr('cx', d => xScale(d._x))
        .attr('cy', d => yScale(d._y));

      dots.exit()
        .transition().duration(300)
        .attr('r', 0)
        .remove();

      this.dotsContainer.selectAll('.chart-node')
        .on('mouseover', function(event, d) {
          d3.select(this).transition().duration(150).attr('r', 7.5);
          self.linesContainer.selectAll('.line-group')
            .transition().duration(200)
            .style('opacity', g => g.key === d[self.config.groupKey] ? 1.0 : 0.2);

          const xString = self.config.xScaleType === 'time'
            ? d3.timeFormat('%B %Y')(d._x)
            : `${self.config.xKey}: ${d[self.config.xKey]}`;

          const xLabel = self.config.xScaleType === 'time' ? 'Year' : (self.config.xKey || 'X');
          const htmlContent = `
            <div class="d3-tooltip-title">${d[self.config.groupKey]}</div>
            <div class="d3-tooltip-row">
              <span>${xLabel}:</span>
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

      this._animated = true;

      if (this.config.inlineLegend) {
        this.drawInlineLegend(innerWidth);
      } else {
        this.drawLegend();
      }
    }
  }

  drawInlineLegend(innerWidth) {
    this.legendGroup.selectAll('*').remove();
    const keys = this.colorScale.domain();
    const lineW = 18;
    const rowH = 18;
    const pad = 10;
    const bgPad = 7;

    // Placeholder rect — sized after items are drawn
    const bg = this.legendGroup.append('rect')
      .attr('rx', 4)
      .style('fill', 'rgba(10, 12, 22, 0.78)')
      .style('stroke', 'rgba(255,255,255,0.07)')
      .style('stroke-width', 1);

    const itemsGroup = this.legendGroup.append('g')
      .attr('transform', `translate(${bgPad}, ${bgPad})`);

    keys.forEach((key, i) => {
      const row = itemsGroup.append('g')
        .attr('transform', `translate(0, ${i * rowH})`);

      row.append('line')
        .attr('x1', 0).attr('x2', lineW).attr('y1', 6).attr('y2', 6)
        .style('stroke', this.colorScale(key))
        .style('stroke-width', 2.5)
        .style('stroke-dasharray', this.config.dashedSeries.includes(key) ? '6 4' : null);

      row.append('text')
        .attr('x', lineW + 5).attr('y', 10)
        .attr('fill', 'var(--text-secondary)')
        .attr('font-size', '0.65rem')
        .attr('font-family', 'var(--font-family-body)')
        .text(key);
    });

    const bbox = itemsGroup.node().getBBox();
    const bw = bbox.width + bgPad * 2;
    const bh = bbox.height + bgPad * 2;
    bg.attr('width', bw).attr('height', bh);

    this.legendGroup.attr('transform',
      `translate(${pad}, ${pad})`);
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
    if (!this.data) return;
    const { width, height } = getDimensions(this.container, this.config.margin);
    if (width === this._lastWidth && height === this._lastHeight) return;
    const { xKey, yKey, xScaleType } = this.config;
    const parsedData = this.data.map(d => {
      const parsedX = xScaleType === 'time' && typeof d[xKey] === 'string' ? new Date(d[xKey]) : +d[xKey];
      return { ...d, _x: parsedX, _y: +d[yKey] };
    });
    this.draw(parsedData);
  }
}
