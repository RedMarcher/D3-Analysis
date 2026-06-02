import * as d3 from 'd3';
import { LineChart } from '../components/line-chart.js';
import { MetricCards } from '../components/metric-cards.js';

const _s3Metrics = new MetricCards({
  overallTotal: 'kpi-s3-1',
  peakValue: 'kpi-s3-2',
  activeCount: 'kpi-s3-3'
});

export const narrative = {
  lbl: "Exhibit 3: Grid Burden",
  title: "Energy Demands & Carbon Subsidies",
  body: `
    <p>Data center electricity demand is growing exponentially — while the grid it draws from has stayed relatively flat and remains heavily fossil-fueled.</p>
    <ul class="narrative-bullets">
      <li><strong>Catching Up Fast:</strong> U.S. grid output has hovered near 4,000 TWh/year for two decades. Data center demand, once negligible, is now on a trajectory to consume over 2,000 TWh/year by 2030 — nearly half the current grid.</li>
      <li><strong>Still a Fossil Grid:</strong> The source breakdown shows coal declining, but natural gas remains the dominant fuel. Solar and wind are rising yet still a fraction — meaning most new data center load is served by fossil fuels today.</li>
      <li><strong>Baseload, Not Peaky:</strong> Unlike homes, data centers run 24/7 at constant draw. That steady baseload demand keeps gas plants running continuously and undermines the economics of intermittent renewables.</li>
    </ul>
  `,
  takeawayTitle: "Conclusive Takeaway: A Fossil-Fueled Surge",
  takeawayText: "Data centers aren't just growing — they're growing faster than the grid can decarbonize. Exponential demand layered on a still gas-heavy supply mix makes the AI infrastructure boom a direct accelerant of fossil fuel dependency."
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

  const payload = {
    overallTotal: { label: "Fossil Fuel Draw", value: fossilPct, trend: trendTxt, trendDirection: "neutral" },
    peakValue: { label: "Clean Green Ratio", value: renewablePct, trend: "Solar, wind & hydro share", trendDirection: "up" },
    activeCount: { label: "U.S. Grid Size", value: totalUSGen, trend: "TWh Total generation", trendDirection: "neutral" }
  };

  metrics.update(payload);
  _s3Metrics.update(payload);
}

export function cleanup() {
  const s3 = document.getElementById('slide-3-layout');
  const dg = document.querySelector('.dashboard-grid');
  if (s3) s3.style.display = 'none';
  if (dg) dg.style.display = '';
}

export function render({ energyData, aterioYearlyMW }) {
  // Switch to slide 3 layout
  const s3 = document.getElementById('slide-3-layout');
  const dg = document.querySelector('.dashboard-grid');
  if (dg) dg.style.display = 'none';
  if (s3) s3.style.display = 'grid';

  // Populate narrative
  document.getElementById('s3-narrative-lbl').textContent = narrative.lbl;
  document.getElementById('s3-narrative-title').textContent = narrative.title;
  document.getElementById('s3-narrative-body').innerHTML = narrative.body;
  document.getElementById('s3-takeaway-title').textContent = narrative.takeawayTitle;
  document.getElementById('s3-takeaway-text').textContent = narrative.takeawayText;

  // ── Left: US Grid Total vs Data Center Demand ──────────────────────────────
  const gridRows = energyData.filter(d => d.Code === 'USA' && +d.Year >= 2000);
  const comparisonData = [];

  const realTotals = [];
  gridRows.forEach(row => {
    const total = +row.Coal + +row.Gas + +row.Nuclear + +row.Hydro +
      +row.Solar + +row.Wind + +row.Oil + +row.Bioenergy + +(row['Other renewables'] || 0);
    if (!isNaN(total) && total > 0) {
      comparisonData.push({ date: `${row.Year}/01/01`, value: Math.round(total), series: 'US Grid Total' });
      realTotals.push({ year: +row.Year, total });
    }
  });

  // 5-year CAGR for a stable projection
  const sorted = realTotals.sort((a, b) => a.year - b.year);
  const windowSize = Math.min(5, sorted.length - 1);
  const base = sorted[sorted.length - 1 - windowSize];
  const last = sorted[sorted.length - 1];
  const cagr = base && base.total > 0 ? Math.pow(last.total / base.total, 1 / windowSize) : 1.005;

  const lastDCYear = Math.max(...aterioYearlyMW.map(d => d.year));
  // Start projected from the last real point so the lines visually connect
  comparisonData.push({ date: `${last.year}/01/01`, value: Math.round(last.total), series: 'US Grid (Projected)' });
  let projected = last.total;
  for (let yr = last.year + 1; yr <= lastDCYear; yr++) {
    projected *= cagr;
    comparisonData.push({ date: `${yr}/01/01`, value: Math.round(projected), series: 'US Grid (Projected)' });
  }

  // DC demand: MW → TWh/year (×8.76/1000, ~100% utilization)
  aterioYearlyMW.forEach(d => {
    comparisonData.push({
      date: `${d.year}/01/01`,
      value: Math.round(d.mw * 8.76 / 1000),
      series: 'Data Centers'
    });
  });

  const leftChart = new LineChart('#s3-container-left', {
    xKey: 'date',
    yKey: 'value',
    groupKey: 'series',
    xScaleType: 'time',
    yLabel: 'Annual Energy (TWh)',
    colors: ['#4facfe', '#a8d8f8', '#ff4d6d'],
    dashedSeries: ['US Grid (Projected)'],
    noAreaSeries: ['US Grid (Projected)'],
    xTickInterval: d3.timeYear.every(5),
    inlineLegend: true
  });
  leftChart.update(comparisonData);

  // ── Right: Energy sources breakdown ────────────────────────────────────────
  const energySourcesToTrack = ['Coal', 'Gas', 'Nuclear', 'Hydro', 'Solar', 'Wind'];
  const sourcesData = [];

  energyData.filter(d => d.Code === 'USA' && +d.Year >= 2000).forEach(row => {
    energySourcesToTrack.forEach(source => {
      const val = +row[source];
      if (!isNaN(val))
        sourcesData.push({ date: `${row.Year}/01/01`, value: val, series: source });
    });
  });

  const rightChart = new LineChart('#s3-container-right', {
    xKey: 'date',
    yKey: 'value',
    groupKey: 'series',
    xScaleType: 'time',
    yLabel: 'Electricity Generation (TWh)',
    colors: ['#6b7280', '#4facfe', '#b100ff', '#05ffc8', '#ffb700', '#ff0844'],
    xTickInterval: d3.timeYear.every(5),
    inlineLegend: true
  });
  rightChart.update(sourcesData);
}
