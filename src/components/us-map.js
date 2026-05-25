import * as d3 from 'd3';
import { getDimensions, tooltip, formatValue } from '../utils/helpers.js';

export class USMap {
  /**
   * Constructs the US Map component.
   * @param {string} selector - Selector of the container DOM element
   * @param {Object} geoJson - Preloaded GeoJSON features dataset
   * @param {Object} config - Config parameters
   */
  constructor(selector, geoJson, config = {}) {
    this.container = document.querySelector(selector);
    if (!this.container) throw new Error(`Map Container ${selector} not found`);

    this.geoJson = geoJson;
    this.config = {
      margin: config.margin || { top: 10, right: 10, bottom: 10, left: 10 },
      ...config
    };

    this.svg = null;
    this.g = null;
    this.dataMap = new Map();
    this.mode = 1; // 1: Growth, 2: Layoffs, 3: Power Grid

    this.init();
  }

  /**
   * Initializes SVG canvas and scales.
   */
  init() {
    this.container.innerHTML = '';

    this.svg = d3.select(this.container)
      .append('svg')
      .attr('class', 'd3-chart us-map-svg');

    this.g = this.svg.append('g')
      .attr('class', 'map-g');

    // Layer for states paths
    this.statesLayer = this.g.append('g').attr('class', 'states-layer');
    // Layer for planned overlay bubbles
    this.bubblesLayer = this.g.append('g').attr('class', 'bubbles-layer');

    // Resize observer for fully fluid layouts
    const resizeObserver = new ResizeObserver(() => this.resize());
    resizeObserver.observe(this.container);
  }

  /**
   * Updates state data and active projection variables.
   * @param {Array} rawStateData - State stats array
   * @param {number} mode - Active slide mode (1, 2, or 3)
   */
  update(rawStateData, mode = 1) {
    if (!rawStateData) return;
    
    this.mode = mode;
    this.dataMap.clear();
    rawStateData.forEach(d => {
      this.dataMap.set(d.id, d);
    });

    this.draw();
  }

  /**
   * Main D3 Drawing Engine. Calculates Albers USA projections, maps fills, and renders bubbles.
   */
  draw() {
    const { margin } = this.config;
    const { width, height, innerWidth, innerHeight } = getDimensions(this.container, margin);

    this.svg
      .attr('width', width)
      .attr('height', height);

    // D3 Albers USA Projection fits perfectly in our bounding box
    const projection = d3.geoAlbersUsa()
      .translate([width / 2, height / 2])
      .scale(Math.min(width * 1.15, height * 1.5) || 500);

    const pathGenerator = d3.geoPath().projection(projection);

    // Define color scales depending on active narrative slide
    let colorScale;
    const maxVal = d3.max(Array.from(this.dataMap.values()), d => {
      if (this.mode === 1) return d.dataCenters;
      if (this.mode === 2) return d.layoffs;
      return d.gridPercentage;
    }) || 100;

    if (this.mode === 1) {
      // Slides 1: Neon Cyan/Blue cyber concentration
      colorScale = d3.scaleLinear()
        .domain([0, maxVal])
        .range(['rgba(15, 17, 26, 0.8)', 'rgba(0, 242, 254, 0.8)']);
    } else if (this.mode === 2) {
      // Slide 2: Corporate profit vs job loss (Neon coral red scale)
      colorScale = d3.scaleLinear()
        .domain([0, maxVal])
        .range(['rgba(15, 17, 26, 0.8)', 'rgba(255, 8, 68, 0.8)']);
    } else {
      // Slide 3: Environmental energy draw (Golden Amber grid warning)
      colorScale = d3.scaleLinear()
        .domain([0, maxVal])
        .range(['rgba(15, 17, 26, 0.8)', 'rgba(255, 183, 0, 0.8)']);
    }

    // Render geographic state path shapes
    const states = this.statesLayer.selectAll('.us-state-path')
      .data(this.geoJson.features, d => d.id);

    const statesEnter = states.enter().append('path')
      .attr('class', 'us-state-path')
      .attr('d', pathGenerator);

    const self = this;
    const statesMerge = statesEnter.merge(states);

    statesMerge
      .attr('d', pathGenerator)
      .transition().duration(500)
      .style('fill', d => {
        const item = self.dataMap.get(d.id);
        if (!item) return 'rgba(15, 17, 26, 0.6)';
        
        const metric = self.mode === 1 ? item.dataCenters : (self.mode === 2 ? item.layoffs : item.gridPercentage);
        return colorScale(metric);
      });

    // Hover tooltip binders
    statesMerge
      .on('mouseover', function(event, d) {
        d3.select(this)
          .style('stroke', 'rgba(255, 255, 255, 0.5)')
          .style('stroke-width', '1.5px');

        const item = self.dataMap.get(d.id);
        const name = d.properties.name;
        
        let htmlContent = `<div class="d3-tooltip-title">${name}</div>`;
        if (item) {
          htmlContent += `
            <div class="d3-tooltip-row">
              <span>Active Facilities:</span>
              <span class="d3-tooltip-val" style="color: var(--accent-primary)">${item.dataCenters}</span>
            </div>
            <div class="d3-tooltip-row">
              <span>Planned Additions:</span>
              <span class="d3-tooltip-val" style="color: var(--accent-secondary)">+${item.plannedDataCenters}</span>
            </div>
            <div class="d3-tooltip-row">
              <span>Corporate Layoffs:</span>
              <span class="d3-tooltip-val" style="color: var(--accent-danger)">${formatValue(item.layoffs)} workers</span>
            </div>
            <div class="d3-tooltip-row">
              <span>Estimated Power Load:</span>
              <span class="d3-tooltip-val" style="color: var(--accent-warning)">${item.powerUsage} MW</span>
            </div>
            <div class="d3-tooltip-row">
              <span>Share of State Grid:</span>
              <span class="d3-tooltip-val" style="color: var(--accent-warning)">${item.gridPercentage}%</span>
            </div>
          `;
        } else {
          htmlContent += `<div class="d3-tooltip-row"><span>No data center footprint</span></div>`;
        }

        tooltip.show(htmlContent, event);
      })
      .on('mousemove', function(event) {
        tooltip.move(event);
      })
      .on('mouseout', function() {
        d3.select(this)
          .style('stroke', 'rgba(255, 255, 255, 0.08)')
          .style('stroke-width', '1px');
        tooltip.hide();
      });

    states.exit().remove();

    // Render planned overlay bubbles for Slide 1 (Growth & Concentration)
    this.bubblesLayer.selectAll('.planned-bubble-group').remove();

    if (this.mode === 1) {
      const bubbleData = Array.from(this.dataMap.values())
        .filter(d => d.plannedDataCenters > 0);

      // Scale bubble radius proportional to planned count
      const radiusScale = d3.scaleSqrt()
        .domain([0, d3.max(bubbleData, d => d.plannedDataCenters) || 10])
        .range([0, 16]);

      const bubbleGroups = this.bubblesLayer.selectAll('.planned-bubble-group')
        .data(bubbleData, d => d.id);

      const bubbleGroupsEnter = bubbleGroups.enter().append('g')
        .attr('class', 'planned-bubble-group')
        .attr('transform', d => {
          // Find matching state feature to project coordinates in center of state boundary
          const feature = self.geoJson.features.find(f => f.id === d.id);
          if (feature) {
            const centroid = pathGenerator.centroid(feature);
            if (centroid && !isNaN(centroid[0]) && !isNaN(centroid[1])) {
              return `translate(${centroid[0]}, ${centroid[1]})`;
            }
          }
          return null;
        });

      // Overlay pulsing outer bubble ring
      bubbleGroupsEnter.append('circle')
        .attr('class', 'us-map-bubble us-map-bubble-pulse')
        .attr('r', d => radiusScale(d.plannedDataCenters))
        .style('fill', 'none')
        .style('stroke', 'var(--accent-secondary)')
        .style('stroke-width', '1.5px');

      // Static inner bubble
      bubbleGroupsEnter.append('circle')
        .attr('class', 'us-map-bubble')
        .attr('r', d => Math.max(3, radiusScale(d.plannedDataCenters) * 0.45))
        .style('fill', 'var(--accent-secondary)')
        .style('fill-opacity', 0.8)
        .style('stroke', '#fff')
        .style('stroke-width', '0.5px');
    }
  }

  /**
   * Handles resizing and recalibrates projections on screen adjustment.
   */
  resize() {
    this.draw();
  }
}
