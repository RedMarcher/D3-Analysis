import * as d3 from 'd3';
import { getDimensions, tooltip, formatValue } from '../utils/helpers.js';

const STATE_FILL         = 'rgba(20, 24, 38, 0.85)';
const STATE_STROKE       = 'rgba(255, 255, 255, 0.08)';
const HOVER_FILL         = 'rgba(255, 255, 255, 0.06)';
const HOVER_STROKE       = 'rgba(255, 255, 255, 0.28)';
const SELECTED_FILL      = 'rgba(0, 242, 254, 0.08)';
const SELECTED_STROKE    = 'rgba(0, 242, 254, 0.45)';

export class USMap {
  constructor(selector, geoJson, config = {}) {
    this.container = document.querySelector(selector);
    if (!this.container) throw new Error(`USMap container ${selector} not found`);

    this.geoJson = geoJson;
    this.config = {
      margin: config.margin || { top: 10, right: 10, bottom: 10, left: 10 },
      onStateHover:    config.onStateHover    || null,
      onStateOut:      config.onStateOut      || null,
      onStateClick:    config.onStateClick    || null,
      onStateDeselect: config.onStateDeselect || null,
    };

    this.dataMap = new Map();
    this.mode = 1;
    this.facilitiesData = null;
    this.showFacilities = false;
    this.selectedStateId = null;
    this.currentTransform = d3.zoomIdentity;
    this.zoom = null;
    this._animated  = false;
    this._lastWidth  = 0;
    this._lastHeight = 0;

    this._init();
  }

  _init() {
    this.container.innerHTML = '';

    this.svg = d3.select(this.container)
      .append('svg')
      .attr('class', 'd3-chart us-map-svg')
      .style('cursor', 'grab');

    this.g = this.svg.append('g').attr('class', 'map-g');
    this.statesLayer  = this.g.append('g').attr('class', 'states-layer');
    this.bubblesLayer = this.g.append('g').attr('class', 'bubbles-layer');
    // Overlay layer sits outside g — not affected by zoom transform
    this.overlayLayer = this.svg.append('g').attr('class', 'overlay-layer');

    this.zoom = d3.zoom()
      .scaleExtent([1, 64])
      .on('zoom', (event) => {
        this.currentTransform = event.transform;
        this.g.attr('transform', event.transform);
        this._repositionFacilityDots(event.transform);
        this._repositionBubbles(event.transform);
        this.svg.style('cursor', event.transform.k > 1 ? 'grabbing' : 'grab');
      });

    this.svg.call(this.zoom);

    // Click on SVG background to deselect
    this.svg.on('click', (event) => {
      if (event.target === this.svg.node()) this._deselect();
    });

    if (this.container.__resizeObserver) this.container.__resizeObserver.disconnect();
    this.container.__resizeObserver = new ResizeObserver(() => this.resize());
    this.container.__resizeObserver.observe(this.container);
  }

  update(rawStateData, mode = 1, facilitiesData = null, showFacilities = false) {
    if (!rawStateData) return;
    this._animated = false;
    this.mode = mode;
    this.facilitiesData = facilitiesData;
    this.showFacilities = showFacilities;
    this.dataMap.clear();
    rawStateData.forEach(d => this.dataMap.set(d.id, d));
    this.draw();
  }

  draw() {
    const { margin } = this.config;
    const { width, height } = getDimensions(this.container, margin);
    const self = this;

    this._lastWidth  = width;
    this._lastHeight = height;
    const isFirstDraw = !this._animated;
    this._animated = true;

    this.svg.attr('width', width).attr('height', height);

    const projection = d3.geoAlbersUsa().fitSize([width, height], this.geoJson);
    const pathGen = d3.geoPath().projection(projection);

    // --- States ---
    const states = this.statesLayer.selectAll('.us-state-path')
      .data(this.geoJson.features, d => d.id);

    const statesEnter = states.enter().append('path')
      .attr('class', 'us-state-path')
      .style('cursor', 'pointer')
      .style('opacity', isFirstDraw ? 0 : 1);

    const statesMerge = statesEnter.merge(states);

    statesMerge
      .attr('d', pathGen)
      .style('fill',         d => d.id === self.selectedStateId ? SELECTED_FILL   : STATE_FILL)
      .style('stroke',       d => d.id === self.selectedStateId ? SELECTED_STROKE : STATE_STROKE)
      .style('stroke-width', d => d.id === self.selectedStateId ? '1.5px'         : '1px')
      .classed('us-state-selected-pulse', d => d.id === self.selectedStateId);

    if (isFirstDraw) {
      statesMerge.each(function(d) {
        const c = pathGen.centroid(d);
        if (!c || isNaN(c[0])) return;
        const [cx, cy] = c;
        const xNorm = cx / width;
        const delay = xNorm * 480 + Math.random() * 100;
        // Start scaled to 10% around centroid
        d3.select(this)
          .attr('transform', `translate(${cx},${cy}) scale(0.1) translate(${-cx},${-cy})`);
        d3.select(this).transition().delay(delay).duration(450).ease(d3.easeCubicOut)
          .style('opacity', 1)
          .attr('transform', `translate(${cx},${cy}) scale(1) translate(${-cx},${-cy})`)
          .on('end', function() { d3.select(this).attr('transform', null); });
      });
    }

    statesMerge
      .on('mouseover', function(event, d) {
        if (d.id === self.selectedStateId) return;
        d3.select(this).style('fill', HOVER_FILL).style('stroke', HOVER_STROKE);
        const item = self.dataMap.get(d.id);
        if (self.config.onStateHover) {
          self.config.onStateHover({ type: 'state', name: d.properties.name, item });
        } else {
          tooltip.show(self._stateTooltipHTML(d.properties.name, item), event);
        }
      })
      .on('mousemove', function(event) {
        if (!self.config.onStateHover) tooltip.move(event);
      })
      .on('mouseout', function(event, d) {
        if (d.id === self.selectedStateId) return;
        d3.select(this).style('fill', STATE_FILL).style('stroke', STATE_STROKE).style('stroke-width', '1px');
        if (self.config.onStateHover) self.config.onStateOut?.();
        else tooltip.hide();
      })
      .on('click', function(event, d) {
        event.stopPropagation();
        const wasSelected = d.id === self.selectedStateId;

        // Clear previous selection visually
        if (self.selectedStateId) {
          self.statesLayer.selectAll('.us-state-path')
            .filter(f => f.id === self.selectedStateId)
            .style('fill', STATE_FILL).style('stroke', STATE_STROKE).style('stroke-width', '1px')
            .classed('us-state-selected-pulse', false);
        }

        if (wasSelected) {
          self.selectedStateId = null;
          d3.select(this).style('fill', HOVER_FILL).style('stroke', HOVER_STROKE)
            .classed('us-state-selected-pulse', false);
          self.config.onStateDeselect?.();
        } else {
          self.selectedStateId = d.id;
          d3.select(this).style('fill', SELECTED_FILL).style('stroke', SELECTED_STROKE).style('stroke-width', '1.5px')
            .classed('us-state-selected-pulse', true);
          const item = self.dataMap.get(d.id);
          self.config.onStateClick?.({ type: 'state', name: d.properties.name, item });
        }
      });

    states.exit().remove();

    // --- Bubbles / Overlay ---
    this.overlayLayer.selectAll('.planned-bubble-group').remove();
    this.overlayLayer.selectAll('.facility-dot').remove();

    if (this.mode === 1) {
      if (this.showFacilities && this.facilitiesData) {
        this._drawFacilityDots(projection, isFirstDraw, width);
      } else {
        this._drawBubbles(pathGen, isFirstDraw, width);
      }
    }

    // Reapply zoom transform so redraw doesn't reset position
    this.g.attr('transform', this.currentTransform);
  }

  _drawBubbles(pathGen, isFirstDraw, mapWidth) {
    const self = this;
    const bubbleData = Array.from(this.dataMap.values())
      .filter(d => (d.active || 0) + (d.planned || 0) > 0);
    if (!bubbleData.length) return;

    const maxTotal    = d3.max(bubbleData, d => d.active + d.planned) || 10;
    const radiusScale = d3.scaleSqrt().domain([0, maxTotal]).range([0, 22]);

    const maxPlanned     = d3.max(bubbleData, d => d.planned) || 10;
    const ringWidthScale = d3.scaleSqrt().domain([0, maxPlanned]).range([0, 7]);

    const t = this.currentTransform;

    const groups = this.overlayLayer.selectAll('.planned-bubble-group')
      .data(bubbleData, d => d.id)
      .enter().append('g')
      .attr('class', 'planned-bubble-group')
      .each(function(d) {
        const feature = self.geoJson.features.find(f => f.id === d.id);
        if (!feature) return;
        const c = pathGen.centroid(feature);
        if (c && !isNaN(c[0])) {
          d._centroid = c;
          d3.select(this).attr('transform', `translate(${t.applyX(c[0])},${t.applyY(c[1])})`);
        }
      });

    // Pulse ring
    groups.append('circle')
      .attr('class', 'us-map-bubble us-map-bubble-pulse')
      .each(function(d) {
        const baseR = Math.max(4, radiusScale(d.active + d.planned));
        d3.select(this).attr('data-base-r', baseR).attr('r', isFirstDraw ? 0 : baseR);
      });

    // Outer circle — total footprint (active + planned), accent-secondary
    groups.append('circle')
      .attr('class', 'us-map-bubble')
      .style('fill', 'var(--accent-secondary)').style('fill-opacity', 0.2)
      .style('stroke', 'var(--accent-secondary)').style('stroke-width', '1.5px')
      .each(function(d) {
        const baseR = Math.max(4, radiusScale(d.active + d.planned));
        d3.select(this).attr('data-base-r', baseR).attr('r', isFirstDraw ? 0 : baseR);
      });

    // Inner circle — active only, accent-primary
    groups.append('circle')
      .attr('class', 'us-map-bubble')
      .style('fill', 'var(--accent-primary)').style('fill-opacity', 0.65)
      .style('stroke', 'var(--accent-primary)').style('stroke-width', '1.5px')
      .each(function(d) {
        const outerBase = Math.max(4, radiusScale(d.active + d.planned));
        const ringW     = ringWidthScale(d.planned);
        const baseR     = Math.max(2, outerBase - ringW);
        d3.select(this).attr('data-base-r', baseR).attr('r', isFirstDraw ? 0 : baseR);
      });

    // Staggered entrance: grow each state's circles after state fade-in
    if (isFirstDraw) {
      groups.each(function(d) {
        if (!d._centroid) return;
        const xNorm = d._centroid[0] / (mapWidth || 1);
        const delay = 380 + xNorm * 480 + Math.random() * 120;
        d3.select(this).selectAll('circle')
          .transition().delay(delay).duration(400).ease(d3.easeCubicOut)
          .attr('r', function() { return +d3.select(this).attr('data-base-r'); });
      });
    }
  }

  _drawFacilityDots(projection, isFirstDraw, mapWidth) {
    const self = this;
    const t = this.currentTransform;

    const projected = this.facilitiesData.map(d => {
      const coords = projection([+d.lon, +d.lat]);
      return { ...d, _mapCoords: coords };
    }).filter(d => d._mapCoords && !isNaN(d._mapCoords[0]));

    const xMin  = d3.min(projected, d => d._mapCoords[0]);
    const xSpan = (d3.max(projected, d => d._mapCoords[0]) - xMin) || 1;

    const DOT_R = 3;

    this.overlayLayer.selectAll('.facility-dot')
      .data(projected, d => d.id)
      .enter().append('circle')
      .attr('class', 'facility-dot')
      .attr('cx', d => t.applyX(d._mapCoords[0]))
      .attr('cy', d => t.applyY(d._mapCoords[1]))
      .attr('r', isFirstDraw ? 0 : DOT_R)
      .style('fill', 'var(--accent-primary)')
      .style('fill-opacity', 0.7)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        d3.select(this).transition().duration(100)
          .attr('r', DOT_R + 2)
          .style('fill', 'var(--accent-secondary)')
          .style('fill-opacity', 1);
        tooltip.show(self._facilityTooltipHTML(d), event);
      })
      .on('mousemove', function(event) {
        tooltip.move(event);
      })
      .on('mouseout', function() {
        d3.select(this).transition().duration(100)
          .attr('r', DOT_R)
          .style('fill', 'var(--accent-primary)')
          .style('fill-opacity', 0.7);
        tooltip.hide();
      });

    if (isFirstDraw) {
      this.overlayLayer.selectAll('.facility-dot')
        .each(function(d) {
          const xNorm = (d._mapCoords[0] - xMin) / xSpan;
          const delay = 350 + xNorm * 500 + Math.random() * 120;
          d3.select(this).transition().delay(delay).duration(350).ease(d3.easeCubicOut)
            .attr('r', DOT_R);
        });
    }
  }

  _repositionFacilityDots(transform) {
    this.overlayLayer.selectAll('.facility-dot')
      .attr('cx', d => transform.applyX(d._mapCoords[0]))
      .attr('cy', d => transform.applyY(d._mapCoords[1]));
  }

  _repositionBubbles(transform) {
    this.overlayLayer.selectAll('.planned-bubble-group')
      .filter(d => d._centroid)
      .attr('transform', d => `translate(${transform.applyX(d._centroid[0])},${transform.applyY(d._centroid[1])})`);
  }

  _deselect() {
    if (this.selectedStateId) {
      this.statesLayer.selectAll('.us-state-path')
        .filter(d => d.id === this.selectedStateId)
        .style('fill', STATE_FILL).style('stroke', STATE_STROKE).style('stroke-width', '1px')
        .classed('us-state-selected-pulse', false);
      this.selectedStateId = null;
    }
    this.config.onStateDeselect?.();
  }

  _stateTooltipHTML(name, item) {
    let html = `<div class="d3-tooltip-title">${name}</div>`;
    if (item) {
      html += `
        <div class="d3-tooltip-row"><span>Active:</span><span class="d3-tooltip-val" style="color:var(--accent-primary)">${item.active}</span></div>
        <div class="d3-tooltip-row"><span>Pipeline:</span><span class="d3-tooltip-val" style="color:var(--accent-secondary)">+${item.planned}</span></div>
        <div class="d3-tooltip-row"><span>Active Power:</span><span class="d3-tooltip-val" style="color:var(--accent-warning)">${item.active_mw} MW</span></div>
        <div class="d3-tooltip-row"><span>Dominant Operator:</span><span class="d3-tooltip-val">${item.dominant_operator || '—'}</span></div>
      `;
    } else {
      html += `<div class="d3-tooltip-row"><span>No data available</span></div>`;
    }
    return html;
  }

  _facilityTooltipHTML(d) {
    return `
      <div class="d3-tooltip-title">${d.name || 'U.S. Data Center'}</div>
      <div class="d3-tooltip-row"><span>Operator:</span><span class="d3-tooltip-val" style="color:var(--accent-primary)">${d.operator || 'Independent'}</span></div>
      <div class="d3-tooltip-row"><span>Location:</span><span class="d3-tooltip-val">${d.county}, ${d.state}</span></div>
      <div class="d3-tooltip-row"><span>Size:</span><span class="d3-tooltip-val" style="color:var(--accent-secondary)">${+d.sqft > 0 ? formatValue(+d.sqft) + ' sqft' : 'Unknown'}</span></div>
    `;
  }

  zoomIn() {
    this.svg.transition().duration(300).call(this.zoom.scaleBy, 1.5);
  }

  zoomOut() {
    this.svg.transition().duration(300).call(this.zoom.scaleBy, 1 / 1.5);
  }

  resetZoom() {
    this.svg.transition().duration(500).call(this.zoom.transform, d3.zoomIdentity);
  }

  resize() {
    const { margin } = this.config;
    const { width, height } = getDimensions(this.container, margin);
    if (width === this._lastWidth && height === this._lastHeight) return;
    this.draw();
  }
}
