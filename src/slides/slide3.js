import * as d3 from 'd3';
import { LineChart } from '../components/line-chart.js';
import { MetricCards } from '../components/metric-cards.js';
import { animateNarrative } from '../utils/animate-narrative.js';

const _s3Metrics = new MetricCards({
  overallTotal: 'kpi-s3-1',
  peakValue: 'kpi-s3-2',
  activeCount: 'kpi-s3-3'
});

let _cycleInterval1 = null, _cycleInterval2 = null, _cycleInterval3 = null;
let _cycleTimeout2  = null, _cycleTimeout3  = null;
let _cycleMetrics   = null;
let _fossilByYear = [], _sourceBreakdown = [], _dcDemand = [];
let _cycleIdx1 = 0, _cycleIdx2 = 0, _cycleIdx3 = 0;

function _clearTimers() {
  [_cycleInterval1, _cycleInterval2, _cycleInterval3].forEach(t => t && clearInterval(t));
  [_cycleTimeout2,  _cycleTimeout3 ].forEach(t => t && clearTimeout(t));
  _cycleInterval1 = _cycleInterval2 = _cycleInterval3 = null;
  _cycleTimeout2  = _cycleTimeout3  = null;
}

function _tickFossil() {
  if (!_cycleMetrics || !_fossilByYear.length) return;
  const e = _fossilByYear[_cycleIdx1];
  _cycleMetrics.update({ overallTotal: { label: `Fossil Fuel (${e.year})`, value: e.pct, trend: e.trend, trendDirection: 'neutral', suffix: '%' } });
  _cycleIdx1 = (_cycleIdx1 + 1) % _fossilByYear.length;
}

function _tickSource() {
  if (!_cycleMetrics || !_sourceBreakdown.length) return;
  const e = _sourceBreakdown[_cycleIdx2];
  _cycleMetrics.update({ peakValue: { label: e.label, value: e.pct, trend: e.trend, trendDirection: e.dir, suffix: '%' } });
  _cycleIdx2 = (_cycleIdx2 + 1) % _sourceBreakdown.length;
}

function _tickDC() {
  if (!_cycleMetrics || !_dcDemand.length) return;
  const e = _dcDemand[_cycleIdx3];
  _cycleMetrics.update({ activeCount: { label: e.label, value: e.twh, trend: e.trend, trendDirection: 'up', raw: true } });
  _cycleIdx3 = (_cycleIdx3 + 1) % _dcDemand.length;
}

export const narrative = {
  lbl: "Exhibit 3: Grid Burden",
  title: "Energy Demands & Carbon Subsidies",
  body: `
    <p>Data center electricity demand is growing exponentially — while the grid it draws from has stayed relatively flat and remains heavily fossil-fueled.</p>
    <ul class="narrative-bullets">
      <li><strong>Catching Up Fast:</strong> U.S. grid output has hovered near 4,000 TWh/year for two decades. Data center demand, once negligible, could reach over 2,000 TWh/year by 2030 under full pipeline buildout — nearly half the current grid.</li>
      <li><strong>Still a Fossil Grid:</strong> The source breakdown shows coal declining, but natural gas remains the dominant fuel. Solar and wind are rising yet still a fraction — meaning most new data center load is served by fossil fuels today.</li>
      <li><strong>Baseload, Not Peaky:</strong> Unlike homes, data centers run 24/7 at constant draw. That steady baseload demand keeps gas plants running continuously and undermines the economics of intermittent renewables.</li>
    </ul>
  `,
  takeawayTitle: "Conclusive Takeaway: A Fossil-Fueled Surge",
  takeawayText: "Data centers aren't just growing — they're growing faster than the grid can decarbonize. Exponential demand layered on a still gas-heavy supply mix makes the AI infrastructure boom a direct accelerant of fossil fuel dependency."
};

function _totalGen(row) {
  return +row.Coal + +row.Gas + +row.Nuclear + +row.Hydro +
    +row.Solar + +row.Wind + +row.Oil + +row.Bioenergy + +(row['Other renewables'] || 0);
}

export function updateKPIs(metrics, { energyData, aterioYearlyMW }) {
  _clearTimers();

  // ── Card 1: fossil % across key years ──────────────────────────────────────
  _fossilByYear = ['2000', '2005', '2010', '2015', '2020', '2023'].map(yr => {
    const row = energyData?.find(d => d.Code === 'USA' && d.Year === yr);
    if (!row) return null;
    const total = _totalGen(row);
    const coalPct = ((+row.Coal / total) * 100).toFixed(0);
    const gasPct  = ((+row.Gas  / total) * 100).toFixed(0);
    return { year: yr, pct: +(((+row.Coal + +row.Gas) / total) * 100).toFixed(1), trend: `Coal ${coalPct}% · Gas ${gasPct}%` };
  }).filter(Boolean);

  // ── Card 2: clean source breakdown in 2023 ─────────────────────────────────
  const usa2023 = energyData?.find(d => d.Code === 'USA' && d.Year === '2023');
  const total23 = usa2023 ? _totalGen(usa2023) : 1;
  _sourceBreakdown = usa2023 ? [
    { label: 'Clean Green Ratio', pct: +(((+usa2023.Solar + +usa2023.Wind + +usa2023.Hydro) / total23) * 100).toFixed(1), trend: 'Solar + Wind + Hydro', dir: 'up' },
    { label: 'Solar Share',       pct: +((+usa2023.Solar / total23) * 100).toFixed(1), trend: 'Utility-scale + rooftop', dir: 'up' },
    { label: 'Wind Share',        pct: +((+usa2023.Wind  / total23) * 100).toFixed(1), trend: 'Onshore + offshore',      dir: 'up' },
    { label: 'Hydro Share',       pct: +((+usa2023.Hydro / total23) * 100).toFixed(1), trend: 'Conventional hydro',      dir: 'neutral' },
    { label: 'Nuclear Base',      pct: +((+usa2023.Nuclear / total23) * 100).toFixed(1), trend: 'Low-carbon baseload',   dir: 'up' },
  ] : [];

  // ── Card 3: DC demand growth by year ───────────────────────────────────────
  const dcYears = [
    { year: 2020, label: 'DC Demand 2020', trend: 'Actual · Aterio' },
    { year: 2023, label: 'DC Demand 2023', trend: 'Actual · Aterio' },
    { year: 2026, label: 'DC Pipeline 2026', trend: 'Projected · Aterio' },
    { year: 2030, label: 'DC Pipeline 2030', trend: 'Full buildout ceiling' },
  ];
  _dcDemand = aterioYearlyMW ? dcYears.map(({ year, label, trend }) => {
    const row = aterioYearlyMW.find(d => d.year === year);
    return row ? { label, twh: Math.round(row.mw * 8.76 / 1000), trend } : null;
  }).filter(Boolean) : [];

  // ── Initial display ─────────────────────────────────────────────────────────
  const initFossil  = _fossilByYear.find(d => d.year === '2023') || _fossilByYear.at(-1);
  const initSource  = _sourceBreakdown[0];
  const initDC      = _dcDemand.find(d => d.label.includes('2023')) || _dcDemand[0];

  const payload = {
    overallTotal: { label: `Fossil Fuel (${initFossil?.year})`, value: initFossil?.pct ?? 58, trend: initFossil?.trend ?? '', trendDirection: 'neutral', suffix: '%' },
    peakValue:    { label: initSource?.label ?? 'Clean Green Ratio', value: initSource?.pct ?? 22, trend: initSource?.trend ?? '', trendDirection: 'up', suffix: '%' },
    activeCount:  { label: initDC?.label ?? 'DC Demand 2023', value: initDC?.twh ?? 251, trend: initDC?.trend ?? '', trendDirection: 'up', raw: true }
  };
  metrics.update(payload);
  _s3Metrics.update(payload);

  // ── Start cycling ───────────────────────────────────────────────────────────
  _cycleMetrics = { update(p) { metrics.update(p); _s3Metrics.update(p); } };
  _cycleIdx1 = 0; _cycleIdx2 = 1; _cycleIdx3 = 1;

  _cycleInterval1 = setInterval(_tickFossil, 3000);
  _cycleTimeout2  = setTimeout(() => { _cycleInterval2 = setInterval(_tickSource, 3000); }, 1000);
  _cycleTimeout3  = setTimeout(() => { _cycleInterval3 = setInterval(_tickDC,     3000); }, 2000);
}

export function cleanup() {
  _clearTimers();
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
  animateNarrative(document.getElementById('s3-narrative-body'));
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
  let growthRate = cagr;
  for (let yr = last.year + 1; yr <= lastDCYear; yr++) {
    growthRate *= 1.002; // accelerating rate — grid under increasing pressure from DC demand
    projected *= growthRate;
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
    inlineLegend: true,
    seriesDelays: [0, 950, 160],
    seriesDurations: [950, 1500, 950]
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
