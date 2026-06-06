import * as d3 from 'd3';
import { getDimensions, tooltip } from '../utils/helpers.js';

export class StreamChart {
  constructor(selector, config = {}) {
    this.container = document.querySelector(selector);
    if (!this.container) throw new Error(`Container ${selector} not found`);

    this.config = {
      xKey:          config.xKey          || 'date',
      yKey:          config.yKey          || 'value',
      groupKey:      config.groupKey      || 'series',
      xScaleType:    config.xScaleType    || 'time',
      yLabel:        config.yLabel        || 'Value',
      margin:        config.margin        || { top: 20, right: 20, bottom: 36, left: 10 },
      colors:        config.colors        || d3.schemeTableau10,
      xTickInterval: config.xTickInterval || null,
      bandGap:       config.bandGap       || 4,
    };

    this.svg        = null;
    this.g          = null;
    this.data       = null;
    this._keys      = null;
    this._pivoted   = null;
    this._layout    = null;
    this._animated  = false;
    this._lastWidth = 0;
    this._lastHeight = 0;

    this.init();
  }

  init() {
    this.container.innerHTML = '';
    const { margin } = this.config;

    this.svg = d3.select(this.container)
      .append('svg')
      .attr('class', 'd3-chart');

    // <defs> for per-band year-segment gradients
    this._defs = this.svg.append('defs');
    this._gradientPrefix = 'sg-' + Math.random().toString(36).slice(2, 8);

    this.g = this.svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    this.xAxisGroup   = this.g.append('g').attr('class', 'd3-axis x-axis');
    this.streamsGroup = this.g.append('g').attr('class', 'streams-group');
    this.legendGroup  = this.g.append('g').attr('class', 'inline-legend-group');

    this.colorScale = d3.scaleOrdinal(this.config.colors);

    if (this.container.__resizeObserver) {
      this.container.__resizeObserver.disconnect();
    }
    this.container.__resizeObserver = new ResizeObserver(() => this.resize());
    this.container.__resizeObserver.observe(this.container);
  }

  update(rawData) {
    if (!rawData || rawData.length === 0) return;
    this.data = rawData;

    const { xKey, yKey, groupKey, xScaleType } = this.config;

    const parseX = xScaleType === 'time'
      ? str => new Date(str)
      : str => +str;

    const keys = Array.from(new Set(rawData.map(d => d[groupKey])));
    const dateStrings = Array.from(new Set(rawData.map(d => d[xKey]))).sort();

    const pivoted = dateStrings.map(dateStr => {
      const row = { date: parseX(dateStr) };
      keys.forEach(k => {
        const match = rawData.find(d => d[xKey] === dateStr && d[groupKey] === k);
        row[k] = match ? +match[yKey] : 0;
      });
      return row;
    });

    this.colorScale.domain(keys);
    this._keys   = keys;
    this._pivoted = pivoted;

    this.draw();
  }

  _computeLayout(innerHeight) {
    const { bandGap } = this.config;
    const keys   = this._keys;
    const pivoted = this._pivoted;
    const n = keys.length;

    const maxTotal = d3.max(pivoted, row => d3.sum(keys, k => row[k]));
    const usableH  = innerHeight - bandGap * (n - 1);
    const scale    = usableH / maxTotal;

    const pixelLayout = {};
    keys.forEach(k => pixelLayout[k] = []);

    pivoted.forEach(row => {
      const sorted = [...keys].sort((a, b) => row[b] - row[a]);
      const localTotal = d3.sum(sorted, k => row[k]);
      const stackH = localTotal * scale + bandGap * (n - 1);
      let cumY = (innerHeight - stackH) / 2;

      sorted.forEach(k => {
        const barH = Math.max(row[k] * scale, 1);
        pixelLayout[k].push({ date: row.date, py_top: cumY, py_bottom: cumY + barH, val: row[k] });
        cumY += barH + bandGap;
      });
    });

    return pixelLayout;
  }

  // Build one linearGradient per band with dark→light stops at each year boundary.
  // gradientUnits="userSpaceOnUse" so stop offsets map directly to xScale pixel values.
  _buildGradients(keys, pivoted, xScale, innerWidth) {
    this._defs.selectAll('linearGradient').remove();

    const gradientIds = {};
    keys.forEach((k, i) => {
      const id = `${this._gradientPrefix}-${i}`;
      gradientIds[k] = id;

      const base = d3.color(this.colorScale(k));
      const darkColor  = base.darker(0.2).formatHex();
      const lightColor = base.brighter(0.2).formatHex();

      const grad = this._defs.append('linearGradient')
        .attr('id', id)
        .attr('gradientUnits', 'userSpaceOnUse')
        .attr('x1', 0).attr('x2', innerWidth)
        .attr('y1', 0).attr('y2', 0);

      // At each year boundary: end previous segment light, start next segment dark.
      // Two stops at the same offset create the sharp dark reset.
      const last = pivoted.length - 1;
      pivoted.forEach((row, j) => {
        const offset = xScale(row.date) / innerWidth; // must be 0–1
        if (j === 0) {
          grad.append('stop').attr('offset', offset).attr('stop-color', darkColor);
        } else if (j === last) {
          grad.append('stop').attr('offset', offset).attr('stop-color', lightColor);
        } else {
          grad.append('stop').attr('offset', offset).attr('stop-color', lightColor);
          grad.append('stop').attr('offset', offset).attr('stop-color', darkColor);
        }
      });
    });

    return gradientIds;
  }

  draw() {
    if (!this._pivoted) return;

    const { margin, xTickInterval } = this.config;
    const { width, height, innerWidth, innerHeight } = getDimensions(this.container, margin);
    if (innerWidth <= 0 || innerHeight <= 0) return;
    this._lastWidth  = width;
    this._lastHeight = height;

    this.svg.attr('width', width).attr('height', height);

    const pivoted = this._pivoted;
    const keys    = this._keys;

    const layout = this._computeLayout(innerHeight);
    this._layout = layout;

    const xScale = d3.scaleTime()
      .domain(d3.extent(pivoted, d => d.date))
      .range([0, innerWidth]);

    const tickInterval = xTickInterval || d3.timeYear.every(5);
    this.xAxisGroup
      .attr('transform', `translate(0, ${innerHeight})`)
      .transition().duration(500)
      .call(d3.axisBottom(xScale)
        .ticks(tickInterval)
        .tickFormat(d => d3.timeFormat('%Y')(d))
        .tickSizeOuter(0));

    // Rebuild gradients every draw (positions change on resize)
    const gradientIds = this._buildGradients(keys, pivoted, xScale, innerWidth);

    const areaFn = d3.area()
      .x(d => xScale(d.date))
      .y0(d => d.py_bottom)
      .y1(d => d.py_top)
      .curve(d3.curveMonotoneX);

    const seriesData = keys.map(k => ({ key: k }));
    const self = this;

    const streams = this.streamsGroup.selectAll('.stream')
      .data(seriesData, d => d.key);

    const streamsEnter = streams.enter()
      .append('path')
      .attr('class', 'stream')
      .attr('fill', d => `url(#${gradientIds[d.key]})`)
      .attr('opacity', 0.85)
      .attr('d', d => {
        const flat = layout[d.key].map(p => {
          const mid = (p.py_top + p.py_bottom) / 2;
          return { ...p, py_top: mid, py_bottom: mid };
        });
        return areaFn(flat);
      });

    const streamsMerge = streamsEnter.merge(streams);

    // Keep gradient fill up to date on resize (gradient IDs are stable, but re-assert)
    streamsMerge.attr('fill', d => `url(#${gradientIds[d.key]})`);

    streamsMerge
      .on('mouseover', function(event, d) {
        self.streamsGroup.selectAll('.stream')
          .transition('hover').duration(180)
          .attr('opacity', g => g.key === d.key ? 1.0 : 0.12);
      })
      .on('mousemove', function(event, d) {
        const [mx] = d3.pointer(event, self.g.node());
        const yr = xScale.invert(mx).getFullYear();
        const pts = self._layout[d.key];
        const pt = pts.find(p => p.date.getFullYear() === yr) || pts[pts.length - 1];
        tooltip.show(`
          <div class="d3-tooltip-title" style="color:${self.colorScale(d.key)}">${d.key}</div>
          <div class="d3-tooltip-row">
            <span>Year:</span>
            <span class="d3-tooltip-val">${pt.date.getFullYear()}</span>
          </div>
          <div class="d3-tooltip-row">
            <span>Generation:</span>
            <span class="d3-tooltip-val">${Math.round(pt.val).toLocaleString()} TWh</span>
          </div>
        `, event);
        tooltip.move(event);
      })
      .on('mouseout', function() {
        self.streamsGroup.selectAll('.stream')
          .transition('hover').duration(180)
          .attr('opacity', 0.85);
        tooltip.hide();
      });

    streams.exit().remove();

    if (!this._animated) {
      streamsMerge
        .transition('enter')
        .delay((d, i) => i * 120)
        .duration(1600)
        .ease(d3.easeLinear)
        .attrTween('d', function(d) {
          const fullPts = layout[d.key];
          const n = fullPts.length;
          const staggerSpread = 0.5;
          return t => {
            const interpPts = fullPts.map((full, j) => {
              const offset = (j / Math.max(n - 1, 1)) * staggerSpread;
              const localT = d3.easeCubicOut(Math.max(0, Math.min(1, (t - offset) / (1 - staggerSpread))));
              const mid = (full.py_top + full.py_bottom) / 2;
              return {
                ...full,
                py_top:    mid * (1 - localT) + full.py_top    * localT,
                py_bottom: mid * (1 - localT) + full.py_bottom * localT,
              };
            });
            return areaFn(interpPts);
          };
        });
    } else {
      streamsMerge
        .transition().duration(400)
        .attr('d', d => areaFn(layout[d.key]))
        .attr('opacity', 0.85);
    }

    this._animated = true;
    this._drawLegend();
  }

  _drawLegend() {
    this.legendGroup.selectAll('*').remove();
    const keys = this._keys;
    if (!keys) return;

    const rowH  = 18;
    const bgPad = 7;

    const bg = this.legendGroup.append('rect')
      .attr('rx', 4)
      .style('fill', 'rgba(10, 12, 22, 0.82)')
      .style('stroke', 'rgba(255,255,255,0.07)')
      .style('stroke-width', 1);

    const itemsGroup = this.legendGroup.append('g')
      .attr('transform', `translate(${bgPad}, ${bgPad})`);

    keys.forEach((key, i) => {
      const row = itemsGroup.append('g')
        .attr('transform', `translate(0, ${i * rowH})`);

      row.append('rect')
        .attr('x', 0).attr('y', 1)
        .attr('width', 16).attr('height', 9)
        .attr('rx', 2)
        .attr('fill', this.colorScale(key))
        .attr('opacity', 0.85);

      row.append('text')
        .attr('x', 22).attr('y', 8)
        .attr('fill', 'var(--text-secondary)')
        .attr('font-size', '0.65rem')
        .attr('font-family', 'var(--font-family-body)')
        .text(key);
    });

    const bbox = itemsGroup.node().getBBox();
    bg.attr('width', bbox.width + bgPad * 2)
      .attr('height', bbox.height + bgPad * 2);
    this.legendGroup.attr('transform', `translate(10, 10)`);
  }

  resize() {
    if (!this._pivoted) return;
    const { width, height } = getDimensions(this.container, this.config.margin);
    if (width === this._lastWidth && height === this._lastHeight) return;
    this.draw();
  }
}
