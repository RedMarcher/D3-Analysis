import * as d3 from 'd3';
import { BarChart } from '../components/bar-chart.js';
import { LineChart } from '../components/line-chart.js';

export const narrative = {
  lbl: "Exhibit 3: Grid Burden",
  title: "Energy Demands & Carbon Subsidies",
  body: `
    <p>A single modern data center draws as much electricity as a medium-sized city, siphoning immense public energy grids and stalling clean transitions.</p>
    <ul class="narrative-bullets">
      <li><strong>Grid Strain:</strong> In Virginia, data centers consume a staggering 24.5% of total grid capacity, raising local residential utility rates.</li>
      <li><strong>Fossil Fuel Draw:</strong> Since over 58% of the U.S. power grid is fueled by natural gas (39%) and coal (19%), these facilities directly drive up high-carbon emissions.</li>
      <li><strong>Continuous Draw:</strong> Unlike residential loads, data centers demand continuous 24/7 baseload power, keeping dirty coal plants operational.</li>
    </ul>
  `,
  takeawayTitle: "Conclusive Takeaway: Environmental Subsidies",
  takeawayText: "Data centers consume enormous amounts of public utility grid capacity, delaying clean energy transitions. This constitutes an environmental tax on local residents to directly subsidize corporate compute power."
};

export function updateKPIs(metrics, { energyData }) {
  let fossilPct = 58.0;
  let renewablePct = 22.0;
  let totalUSGen = 4249;
  let trendTxt = "Gas (39%) + Coal (19%)";

  if (energyData) {
    const usa2023 = energyData.find(d => d.Code === 'USA' && d.Year === '2023');
    if (usa2023) {
      const total = +usa2023.Coal + +usa2023.Gas + +usa2023.Nuclear + +usa2023.Hydro +
        +usa2023.Solar + +usa2023.Wind + +usa2023.Oil + +usa2023.Bioenergy +
        +usa2023['Other renewables'];
      fossilPct = +(((+usa2023.Coal + +usa2023.Gas) / total) * 100).toFixed(1);
      renewablePct = +(((+usa2023.Solar + +usa2023.Wind + +usa2023.Hydro) / total) * 100).toFixed(1);
      totalUSGen = Math.round(total);
      trendTxt = `Coal (${((+usa2023.Coal / total) * 100).toFixed(0)}%) & Gas (${((+usa2023.Gas / total) * 100).toFixed(0)}%)`;
    }
  }

  metrics.update({
    overallTotal: { label: "Fossil Fuel Draw", value: fossilPct, trend: trendTxt, trendDirection: "neutral" },
    peakValue: { label: "Clean Green Ratio", value: renewablePct, trend: "Solar, wind & hydro share", trendDirection: "up" },
    activeCount: { label: "U.S. Grid Size", value: totalUSGen, trend: "TWh Total generation", trendDirection: "neutral" }
  });
}

export function render({ containerLeft, containerRight, slideData, energyData }) {
  document.querySelector('.charts-grid').style.gridTemplateColumns = '1fr 1fr';

  document.getElementById('us-map-title').textContent = "U.S. Electricity Production Energy Sources";
  d3.select('#us-map-mode-badge').text('Source: Our World in Data / BP').style('display', 'block').style('color', 'var(--text-secondary)').style('font-size', '0.75rem');

  const barChart = new BarChart(containerLeft, {
    xKey: 'percentage',
    yKey: 'source',
    colors: ['#4facfe', '#6b7280', '#b100ff', '#05ffc8', '#ffb700', '#ff0844', '#f3f4f6']
  });

  let dynamicEnergySources = slideData.powerGridData.energySources;
  if (energyData) {
    const usa2023 = energyData.find(d => d.Code === 'USA' && d.Year === '2023');
    if (usa2023) {
      const total = +usa2023.Coal + +usa2023.Gas + +usa2023.Nuclear + +usa2023.Hydro +
        +usa2023.Solar + +usa2023.Wind + +usa2023.Oil + +usa2023.Bioenergy +
        +usa2023['Other renewables'];
      
      dynamicEnergySources = [
        { source: 'Natural Gas', percentage: +((+usa2023.Gas / total) * 100).toFixed(1) },
        { source: 'Coal', percentage: +((+usa2023.Coal / total) * 100).toFixed(1) },
        { source: 'Nuclear', percentage: +((+usa2023.Nuclear / total) * 100).toFixed(1) },
        { source: 'Wind', percentage: +((+usa2023.Wind / total) * 100).toFixed(1) },
        { source: 'Hydro', percentage: +((+usa2023.Hydro / total) * 100).toFixed(1) },
        { source: 'Solar', percentage: +((+usa2023.Solar / total) * 100).toFixed(1) },
        { source: 'Others', percentage: +(((total - +usa2023.Gas - +usa2023.Coal - +usa2023.Nuclear - +usa2023.Wind - +usa2023.Hydro - +usa2023.Solar) / total) * 100).toFixed(1) }
      ].sort((a, b) => b.percentage - a.percentage);
    }
  }

  barChart.update(dynamicEnergySources);

  document.getElementById('supporting-chart-title').textContent = "U.S. Grid History (2000 - Present)";
  d3.select('#supporting-chart-mode-badge').text('Source: Our World in Data / BP').style('display', 'block').style('color', 'var(--text-secondary)').style('font-size', '0.75rem');

  const lineChart = new LineChart(containerRight, {
    xKey: 'date',
    yKey: 'value',
    groupKey: 'series',
    xScaleType: 'time',
    yLabel: 'Electricity Generation (TWh)',
    colors: ['#6b7280', '#4facfe', '#b100ff', '#05ffc8', '#ffb700', '#ff0844']
  });

  const energySourcesToTrack = ['Coal', 'Gas', 'Nuclear', 'Hydro', 'Solar', 'Wind'];
  const structuredData = [];

  energyData.filter(d => d.Code === 'USA' && +d.Year >= 2000)
    .forEach(row => {
      energySourcesToTrack.forEach(source => {
        const val = +row[source];
        if (!isNaN(val)) {
          structuredData.push({ date: `${row.Year}-01-01`, value: val, series: source });
        }
      });
    });

  lineChart.update(structuredData);
}
