import * as d3 from 'd3';
import { getDimensions, tooltip, formatValue } from '../utils/helpers.js';

export class ScatterPlot {
  constructor(selector, config = {}) {
    this.container = document.querySelector(selector);
    if (!this.container) throw new Error(`Container ${selector} not found`);

    this.config = {
      xKey:        config.xKey        || 'x',
      yKey:        config.yKey        || 'y',
      sizeKey:     config.sizeKey     || 'size',
      groupKey:    config.groupKey    || 'group',
      groupLabel:  config.groupLabel  || 'Group',
      groupOrder:  config.groupOrder  || null,
      labelKey:    config.labelKey    || 'label',
      xLabel:      config.xLabel      || 'X Dimension',
      yLabel:      config.yLabel      || 'Y Dimension',
      xScaleType:  config.xScaleType  || 'log',
      margin:      config.margin      || { top: 30, right: 30, bottom: 50, left: 55 },
      colors:      config.colors      || d3.schemeSet2
    };

    this.svg          = null;
    this.g            = null;
    this.data         = null;
    this.colorScale   = null;
    this.xScaleBase   = null;
    this.yScaleBase   = null;
    this.sizeScale    = null;
    this.zoom         = null;
    this._innerWidth  = 0;
    this._innerHeight = 0;
    this.activeGroups = new Set();

    this.init();
  }

  init() {
    this.container.innerHTML = '';

    this.svg = d3.select(this.container)
      .append('svg')
      .attr('class', 'd3-chart');

    // Clip path so bubbles and gridlines don't overflow into the axes
    this.clipId = `scatter-clip-${Math.random().toString(36).slice(2)}`;
    this.svg.append('defs').append('clipPath')
      .attr('id', this.clipId)
      .append('rect')
      .attr('class', 'scatter-clip-rect');

    this.g = this.svg.append('g')
      .attr('transform', `translate(${this.config.margin.left}, ${this.config.margin.top})`);

    // Background rect behind everything — captures zoom events in empty space
    this.bgRect = this.g.append('rect')
      .attr('class', 'scatter-bg-rect')
      .style('fill', 'transparent')
      .style('pointer-events', 'all');

    this.gridGroup    = this.g.append('g').attr('class', 'd3-grid-lines')
                          .attr('clip-path', `url(#${this.clipId})`);
    this.xAxisGroup   = this.g.append('g').attr('class', 'd3-axis x-axis');
    this.yAxisGroup   = this.g.append('g').attr('class', 'd3-axis y-axis');

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

    this.crosshair = this.g.append('g').attr('class', 'd3-crosshair').style('opacity', 0);
    this.crosshair.append('line').attr('class', 'crosshair-x')
      .style('stroke', 'var(--accent-primary)').style('stroke-width', '1.5px').style('stroke-dasharray', '4,4');
    this.crosshair.append('line').attr('class', 'crosshair-y')
      .style('stroke', 'var(--accent-primary)').style('stroke-width', '1.5px').style('stroke-dasharray', '4,4');

    this.bubblesContainer = this.g.append('g').attr('class', 'bubbles-group')
      .attr('clip-path', `url(#${this.clipId})`);

    this.colorScale = d3.scaleOrdinal(this.config.colors);

    this.zoom = d3.zoom()
      .scaleExtent([1, 60])
      .on('zoom', (event) => this._onZoom(event))
      .on('start', () => this.g.style('cursor', 'grabbing'))
      .on('end',   () => this.g.style('cursor', 'grab'));

    if (this.container.__resizeObserver) this.container.__resizeObserver.disconnect();
    this.container.__resizeObserver = new ResizeObserver(() => this.resize());
    this.container.__resizeObserver.observe(this.container);
  }

  update(rawData) {
    if (!rawData || rawData.length === 0) return;
    this.data = rawData;
    const presentGroups = new Set(rawData.map(d => d[this.config.groupKey]));
    const uniqueGroups = this.config.groupOrder
      ? this.config.groupOrder.filter(g => presentGroups.has(g))
      : Array.from(presentGroups).sort();
    this.colorScale.domain(uniqueGroups);
    this.activeGroups = new Set(uniqueGroups);
    this.draw();
  }

  resetZoom() {
    this.g.transition().duration(400)
      .call(this.zoom.transform, d3.zoomIdentity);
  }

  draw() {
    if (!this.data) return;

    const { margin, xKey, yKey, sizeKey, xLabel, yLabel } = this.config;
    const { width, height, innerWidth, innerHeight } = getDimensions(this.container, margin);

    this._innerWidth  = innerWidth;
    this._innerHeight = innerHeight;

    this.svg.attr('width', width).attr('height', height);

    this.svg.select('.scatter-clip-rect')
      .attr('width', innerWidth).attr('height', innerHeight);

    this.bgRect.attr('width', innerWidth).attr('height', innerHeight);

    this.xScaleBase = this.config.xScaleType === 'time'
      ? d3.scaleTime().domain(d3.extent(this.data, d => d[xKey])).range([0, innerWidth])
      : d3.scaleLog().domain([d3.min(this.data, d => +d[xKey]) * 0.9 || 1, d3.max(this.data, d => +d[xKey]) * 1.1 || 100]).range([0, innerWidth]);

    this.yScaleBase = d3.scaleLog()
      .domain([d3.min(this.data, d => +d[yKey]) * 0.9 || 1, d3.max(this.data, d => +d[yKey]) * 1.1 || 100])
      .range([innerHeight, 0]);

    this.sizeScale = d3.scaleSqrt()
      .domain(d3.extent(this.data, d => +d[sizeKey]))
      .range([5, innerWidth > 500 ? 25 : 12]);

    this.zoom
      .translateExtent([[0, 0], [innerWidth, innerHeight]])
      .extent([[0, 0], [innerWidth, innerHeight]]);

    // Attach zoom to g — wheel events on bubbles bubble up and trigger zoom too
    this.g.call(this.zoom).call(this.zoom.transform, d3.zoomIdentity);
    this.g.style('cursor', 'grab');

    this._renderAxes(this.xScaleBase, this.yScaleBase);
    this._renderGrid(this.xScaleBase, this.yScaleBase);
    this._renderBubbles(this.xScaleBase, this.yScaleBase);

    this.xLabelText
      .attr('x', innerWidth / 2 + margin.left)
      .attr('y', height - 5)
      .text(xLabel);

    this.yLabelText
      .attr('x', -innerHeight / 2 - margin.top)
      .attr('y', 15)
      .text(yLabel);

    this.drawLegend();
  }

  _onZoom(event) {
    const xNew = event.transform.rescaleX(this.xScaleBase);
    const yNew = event.transform.rescaleY(this.yScaleBase);

    this._renderAxes(xNew, yNew);
    this._renderGrid(xNew, yNew);

    const xKey = this.config.xKey;
    this.bubblesContainer.selectAll('.chart-node')
      .attr('cx', d => xNew(d[xKey]))
      .attr('cy', d => yNew(+d[this.config.yKey]));

    this.crosshair.style('opacity', 0);
  }

  _renderAxes(xScale, yScale) {
    const xAxis = this.config.xScaleType === 'time'
      ? d3.axisBottom(xScale).ticks(d3.timeYear.every(1)).tickFormat(d3.timeFormat('%Y'))
      : d3.axisBottom(xScale).ticks(this._innerWidth > 500 ? 6 : 3, '~s');

    this.xAxisGroup
      .attr('transform', `translate(0, ${this._innerHeight})`)
      .call(xAxis);

    this.yAxisGroup
      .call(d3.axisLeft(yScale).ticks(this._innerHeight > 300 ? 5 : 3, '~s'));
  }

  _renderGrid(xScale, yScale) {
    this.gridGroup.selectAll('g').remove();

    this.gridGroup.append('g')
      .attr('transform', `translate(0, ${this._innerHeight})`)
      .call(d3.axisBottom(xScale).tickSize(-this._innerHeight).tickFormat(''))
      .call(g => g.select('.domain').remove());

    this.gridGroup.append('g')
      .call(d3.axisLeft(yScale).tickSize(-this._innerWidth).tickFormat(''))
      .call(g => g.select('.domain').remove());
  }

  _renderBubbles(xScale, yScale) {
    const { xKey, yKey, sizeKey, groupKey, groupLabel, labelKey, xLabel, yLabel, xScaleType } = this.config;
    const self = this;
    const xVal = d => xScaleType === 'time' ? d[xKey] : +d[xKey];

    const bubbles = this.bubblesContainer.selectAll('.chart-node')
      .data(this.data, d => d[labelKey] + String(d[xKey]));

    const bubblesEnter = bubbles.enter().append('circle')
      .attr('class', 'chart-node')
      .attr('cx', d => xScale(xVal(d)))
      .attr('cy', d => yScale(+d[yKey]))
      .attr('r', 0)
      .style('fill', d => this.colorScale(d[groupKey]))
      .style('stroke', '#ffffff')
      .style('stroke-width', '1px')
      .style('fill-opacity', 0.65);

    const bubblesMerge = bubblesEnter.merge(bubbles);

    bubblesMerge.transition().duration(500)
      .attr('cx', d => xScale(xVal(d)))
      .attr('cy', d => yScale(+d[yKey]))
      .attr('r',  d => this.sizeScale(+d[sizeKey]))
      .style('fill', d => this.colorScale(d[groupKey]));

    bubbles.exit().transition().duration(300).attr('r', 0).remove();

    bubblesMerge
      .on('mouseover', function(event, d) {
        const el = d3.select(this);
        const cx = +el.attr('cx');
        const cy = +el.attr('cy');
        const r  = +el.attr('r');
        el.attr('data-r', r);

        el.transition().duration(150)
          .style('fill-opacity', 0.95).attr('r', r * 1.35);

        self.crosshair.style('opacity', 1);
        self.crosshair.select('.crosshair-x')
          .attr('x1', cx).attr('y1', cy).attr('x2', cx).attr('y2', self._innerHeight);
        self.crosshair.select('.crosshair-y')
          .attr('x1', cx).attr('y1', cy).attr('x2', 0).attr('y2', cy);

        const xDisplay = xScaleType === 'time'
          ? d3.timeFormat('%b %Y')(d[xKey])
          : formatValue(+d[xKey]);

        const htmlContent = `
          <div class="d3-tooltip-title">${d[labelKey]}</div>
          <div class="d3-tooltip-row">
            <span>${groupLabel}:</span>
            <span class="d3-tooltip-val" style="color: ${self.colorScale(d[groupKey])}">${d[groupKey]}</span>
          </div>
          <div class="d3-tooltip-row">
            <span>${xLabel}:</span>
            <span class="d3-tooltip-val">${xDisplay}</span>
          </div>
          <div class="d3-tooltip-row">
            <span>${yLabel}:</span>
            <span class="d3-tooltip-val">${Math.round(+d[yKey]).toLocaleString()}</span>
          </div>
          <div class="d3-tooltip-row">
            <span>Funds raised:</span>
            <span class="d3-tooltip-val">$${formatValue(+d[sizeKey])}M</span>
          </div>
        `;
        tooltip.show(htmlContent, event);
      })
      .on('mousemove', function(event) { tooltip.move(event); })
      .on('mouseout', function() {
        const el = d3.select(this);
        const r  = +el.attr('data-r') || self.sizeScale(+el.datum()[sizeKey]);
        el.transition().duration(150).style('fill-opacity', 0.65).attr('r', r);
        self.crosshair.style('opacity', 0);
        tooltip.hide();
      });
  }

  drawLegend() {
    const legendContainer = document.getElementById(`legend-${this.container.id.replace('container-', '')}`);
    if (!legendContainer) return;

    legendContainer.innerHTML = '';
    this.colorScale.domain().forEach(key => {
      const item = document.createElement('div');
      item.className = 'legend-item legend-item-btn';
      item.dataset.group = key;
      item.title = this.activeGroups.size === this.colorScale.domain().length
        ? `Show only ${key}` : `Toggle ${key}`;

      const dot = document.createElement('span');
      dot.className = 'legend-color';
      dot.style.backgroundColor = this.colorScale(key);

      const text = document.createElement('span');
      text.textContent = key;

      item.appendChild(dot);
      item.appendChild(text);
      item.addEventListener('click', () => this._toggleGroup(key));
      legendContainer.appendChild(item);
    });

    this._updateLegendState();
  }

  _toggleGroup(key) {
    const allGroups = this.colorScale.domain();
    const allActive = this.activeGroups.size === allGroups.length;

    if (allActive) {
      // Isolate: show only the clicked group
      this.activeGroups = new Set([key]);
    } else if (this.activeGroups.has(key)) {
      // Deselect — if it's the last one, reset to all
      if (this.activeGroups.size === 1) {
        this.activeGroups = new Set(allGroups);
      } else {
        this.activeGroups.delete(key);
      }
    } else {
      // Add to selection
      this.activeGroups.add(key);
    }

    this._applyFilter();
    this._updateLegendState();
  }

  _applyFilter() {
    this.bubblesContainer.selectAll('.chart-node')
      .transition().duration(200)
      .style('opacity', d => this.activeGroups.has(d[this.config.groupKey]) ? 0.65 : 0)
      .style('pointer-events', d => this.activeGroups.has(d[this.config.groupKey]) ? 'all' : 'none');
  }

  _updateLegendState() {
    const legendContainer = document.getElementById(`legend-${this.container.id.replace('container-', '')}`);
    if (!legendContainer) return;
    legendContainer.querySelectorAll('.legend-item-btn').forEach(item => {
      const active = this.activeGroups.has(item.dataset.group);
      item.classList.toggle('legend-item-inactive', !active);
    });
  }

  resize() {
    if (this.data) this.draw();
  }
}
