import * as d3 from 'd3';
import { USMap } from '../components/us-map.js';
import { DonutChart } from '../components/donut-chart.js';

export const narrative = {
  lbl: "Case Study 1: Real-World Distribution",
  title: "The Massive Infrastructure Footprint",
  body: `
    <p>The U.S. data center footprint is expanding exponentially, driven by AI and cloud infrastructure demands. This first slide illustrates where the physical infrastructure is being built.</p>
    <ul class="narrative-bullets">
      <li><strong>Virginia, California, and Texas</strong> hold the highest operational densities in the world.</li>
      <li><strong>Planned additions</strong> show that growth is accelerated, with an estimated 39% capacity increase nationwide in active development.</li>
      <li><strong>Highly Concentrated:</strong> Virginia alone hosts over 450 active gigawatt-scale data centers, acting as the global hub.</li>
    </ul>
  `,
  takeawayTitle: "Conclusive Takeaway: The Illusion of Scale",
  takeawayText: "While the physical footprint is massive, this growth is highly localized. Corporations select sites based on tax breaks and low energy rates, forcing local economies to bear the structural burden of corporate computing expansion."
};

export function updateKPIs(metrics, { slideData, atlasData, showFacilitiesOverlay }) {
  const totalPlanned = d3.sum(slideData.stateData, d => d.plannedDataCenters);
  const activeCount = atlasData ? atlasData.length : 1481;

  let hubLabel = "Virginia Share";
  let hubVal = 450;
  let hubTrend = "Highest Global Capital";

  if (showFacilitiesOverlay && atlasData) {
    const vaCount = atlasData.filter(d => d.state_abb === 'VA').length;
    const vaPct = ((vaCount / atlasData.length) * 100).toFixed(1);
    hubLabel = "Virginia Footprint";
    hubVal = vaCount;
    hubTrend = `${vaPct}% of U.S. total`;
  }

  metrics.update({
    overallTotal: { label: "Nationwide Active", value: activeCount, trend: "Atlas verified facilities", trendDirection: "up" },
    peakValue: { label: "Planned Additions", value: totalPlanned, trend: "+39% Nationwide boost", trendDirection: "up" },
    activeCount: { label: hubLabel, value: hubVal, trend: hubTrend, trendDirection: "up" }
  });
}

export function render({ containerLeft, containerRight, geoJson, slideData, atlasData, showFacilitiesOverlay, onOverlayToggle }) {
  document.querySelector('.charts-grid').style.gridTemplateColumns = '1.2fr 0.8fr';

  document.getElementById('us-map-title').textContent = "U.S. Data Center Hubs & Planned Growth";
  d3.select('#us-map-mode-badge').text('Albers USA').style('display', 'block');

  d3.select('#us-map-controls').html(`
    <label class="toggle-control">
      <input type="checkbox" id="chk-show-facilities" ${showFacilitiesOverlay ? 'checked' : ''}>
      Overlay 1,480+ Real Facilities
    </label>
  `);

  const usMap = new USMap(containerLeft, geoJson);
  usMap.update(slideData.stateData, 1, atlasData, showFacilitiesOverlay);

  d3.select('#chk-show-facilities').on('change', function() {
    onOverlayToggle(this.checked, usMap);
  });

  document.getElementById('supporting-chart-title').textContent = "Nationwide Active vs Planned Capacity Share";
  d3.select('#supporting-chart-mode-badge').text('D3 Donut').style('display', 'block');

  const donut = new DonutChart(containerRight, {
    categoryKey: 'label',
    valueKey: 'value',
    innerRadiusRatio: 0.62,
    colors: ['var(--accent-primary)', 'var(--accent-secondary)']
  });

  const totalActive = d3.sum(slideData.stateData, d => d.dataCenters);
  const totalPlanned = d3.sum(slideData.stateData, d => d.plannedDataCenters);
  donut.update([
    { label: 'Active Nationwide', value: totalActive },
    { label: 'Planned Nationwide', value: totalPlanned }
  ]);
}
