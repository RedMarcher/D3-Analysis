import * as d3 from 'd3';
import { getDimensions, tooltip } from '../utils/helpers.js';
import { createSmoothZoom } from '../utils/smooth-zoom.js';

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

    this.svg              = null;
    this.g                = null;
    this.data             = null;
    this._keys            = null;
    this._pivoted         = null;
    this._layout          = null;
    this._xScaleBase      = null;
    this._displayTransform = d3.zoomIdentity;
    this._smoothZoom      = null;
    this._animated        = false;
    this._lastWidth       = 0;
    this._lastHeight      = 0;

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
    this.crosshairGroup = this.g.append('g').attr('class', 'crosshair-group').style('display', 'none').style('pointer-events', 'none');
    this.overlayRect  = this.g.append('rect').attr('class', 'stream-overlay').attr('fill', 'none').attr('pointer-events', 'all');

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
    this._xScaleBase = xScale;

    // Create zoom once; reset to identity on each draw so resize stays coherent
    if (!this._smoothZoom) {
      this._smoothZoom = createSmoothZoom(this.overlayRect, {
        scaleExtent: [1, 20],

        onUpdate: (displayT) => this._onZoomUpdate(displayT),
      });
    }
    this.overlayRect.call(this._smoothZoom.zoom.transform, d3.zoomIdentity);
    this._displayTransform = d3.zoomIdentity;

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

    // Remove per-band handlers — overlay rect takes over all hover logic
    streamsMerge.on('mouseover', null).on('mousemove', null).on('mouseout', null);

    // Crosshair: vertical line
    const crosshairLine = this.crosshairGroup.selectAll('.crosshair-line')
      .data([null]).join('line')
      .attr('class', 'crosshair-line')
      .attr('y1', 0).attr('y2', innerHeight)
      .attr('stroke', 'rgba(255,255,255,0.25)')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3,3');

    // Per-band percentage labels rendered inside each band
    const pctLabels = this.crosshairGroup.selectAll('.pct-label')
      .data(keys, k => k)
      .join('text')
      .attr('class', 'pct-label')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '10px')
      .attr('font-weight', '700')
      .attr('paint-order', 'stroke')
      .attr('stroke-linejoin', 'round')
      .attr('stroke-width', '3px')
      .attr('stroke', 'rgba(0,0,0,0.75)')
      .attr('fill', k => self.colorScale(k));

    // Overlay rect sits on top, captures all mouse events
    this.overlayRect.attr('width', innerWidth).attr('height', innerHeight)
      .on('mousemove', function(event) {
        const [mx, my] = d3.pointer(event, self.g.node());
        const dt   = self._displayTransform;
        const xCur = dt.rescaleX(self._xScaleBase);
        const date = xCur.invert(mx);
        const yr   = date.getFullYear();

        // Interpolate layout between the two surrounding data points so that
        // hover detection matches the smooth monotone curve exactly, not just
        // the nearest year's pixel position (critical for narrow bands).
        function interpAt(k) {
          const arr = self._layout[k];
          if (!arr || !arr.length) return null;
          const i1 = arr.findIndex(p => p.date >= date);
          if (i1 === 0)  return arr[0];
          if (i1 === -1) return arr[arr.length - 1];
          const p0 = arr[i1 - 1], p1 = arr[i1];
          const t  = (date - p0.date) / (p1.date - p0.date);
          return {
            py_top:    p0.py_top    + t * (p1.py_top    - p0.py_top),
            py_bottom: p0.py_bottom + t * (p1.py_bottom - p0.py_bottom),
            val:       p0.val       + t * (p1.val        - p0.val),
          };
        }

        const total = keys.reduce((sum, k) => sum + (interpAt(k)?.val || 0), 0);

        // Compare cursor against visually transformed, interpolated band extents
        const hoveredKey = keys.find(k => {
          const p = interpAt(k);
          if (!p) return false;
          return my >= dt.applyY(p.py_top) && my <= dt.applyY(p.py_bottom);
        }) || null;

        // Highlight hovered band
        self.streamsGroup.selectAll('.stream')
          .transition('hover').duration(120)
          .attr('opacity', d => hoveredKey ? (d.key === hoveredKey ? 1.0 : 0.12) : 0.85);

        // Move crosshair line
        self.crosshairGroup.style('display', null);
        crosshairLine.attr('x1', mx).attr('x2', mx);

        // Position & update each band label at interpolated, transformed y midpoint
        pctLabels.each(function(k) {
          const p   = interpAt(k);
          const rawPct = total > 0 ? (p.val / total * 100) : 0;
          const pctLabel = rawPct === 0 ? '0%' : rawPct < 1 ? '<1%' : `${Math.round(rawPct)}%`;
          d3.select(this)
            .attr('x', mx)
            .attr('y', (dt.applyY(p.py_top) + dt.applyY(p.py_bottom)) / 2)
            .style('display', p.val > 0 ? null : 'none')
            .text(pctLabel);
        });

        // Tooltip for hovered band
        if (hoveredKey) {
          const p      = interpAt(hoveredKey);
          const rawPct = total > 0 ? (p.val / total) * 100 : 0;
          const pct    = rawPct < 0.1 ? '<0.1%' : `${rawPct.toFixed(1)}%`;
          tooltip.show(`
            <div class="d3-tooltip-title" style="color:${self.colorScale(hoveredKey)}">${hoveredKey}</div>
            <div class="d3-tooltip-row"><span>Year:</span><span class="d3-tooltip-val">${yr}</span></div>
            <div class="d3-tooltip-row"><span>Generation:</span><span class="d3-tooltip-val">${Math.round(p.val).toLocaleString()} TWh</span></div>
            <div class="d3-tooltip-row"><span>Share:</span><span class="d3-tooltip-val" style="color:${self.colorScale(hoveredKey)}">${pct}</span></div>
          `, event);
        } else {
          tooltip.hide();
        }
      })
      .on('mouseout', function() {
        self.crosshairGroup.style('display', 'none');
        self.streamsGroup.selectAll('.stream')
          .transition('hover').duration(180).attr('opacity', 0.85);
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

  _onZoomUpdate(displayT) {
    this._displayTransform = displayT;
    if (!this._xScaleBase || !this._layout || !this._keys) return;

    const xNew = displayT.rescaleX(this._xScaleBase);

    // Re-render stream paths with new x mapping and y positions scaled by displayT
    const areaFn = d3.area()
      .x(d => xNew(d.date))
      .y0(d => displayT.applyY(d.py_bottom))
      .y1(d => displayT.applyY(d.py_top))
      .curve(d3.curveMonotoneX);

    this.streamsGroup.selectAll('.stream')
      .attr('d', d => areaFn(this._layout[d.key]));

    // Fix gradient alignment: the gradients were built with x1=0, x2=innerWidth
    // in the original coordinate space. Apply the same zoom transform to the
    // gradient coordinate system so stops stay aligned with the zoomed paths.
    this._defs.selectAll('linearGradient')
      .attr('gradientTransform', `translate(${displayT.x},0) scale(${displayT.k},1)`);

    // Update x axis to show zoomed tick labels
    const { xTickInterval } = this.config;
    const tickInterval = xTickInterval || d3.timeYear.every(5);
    this.xAxisGroup.call(
      d3.axisBottom(xNew)
        .ticks(tickInterval)
        .tickFormat(d => d3.timeFormat('%Y')(d))
        .tickSizeOuter(0)
    );
  }

  zoomIn()    { this._smoothZoom?.zoomIn(); }
  zoomOut()   { this._smoothZoom?.zoomOut(); }
  resetZoom() { this._smoothZoom?.resetZoom(); }

  resize() {
    if (!this._pivoted) return;
    const { width, height } = getDimensions(this.container, this.config.margin);
    if (width === this._lastWidth && height === this._lastHeight) return;
    this.draw();
  }
}
