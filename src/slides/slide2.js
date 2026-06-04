import * as d3 from 'd3';
import { LineChart } from '../components/line-chart.js';
import { ScatterPlot } from '../components/scatter-plot.js';
import { MetricCards } from '../components/metric-cards.js';
import { animateNarrative } from '../utils/animate-narrative.js';
import { normalizeStage } from '../utils/helpers.js';

export const narrative = {
  lbl: "Exhibit 2: - Tech Layoffs",
  title: "Corporate Gain vs. Stable Labor",
  body: `
    <p>Tech giants are investing billions in new data center physical assets, but are simultaneously conducting workforce cuts, shedding hundreds of thousands of jobs.</p>
    <ul class="narrative-bullets">
      <li><strong>Diverging trends:</strong> From 2020 to 2026, U.S. data center power capacity tripled from 19 GW to 59 GW — while tech layoffs surged past 655,000 cumulative cuts.</li>
      <li><strong>Automated over human:</strong> Capital expenditure is skewed towards high-margin computing assets rather than preserving stable human employment.</li>
      <li><strong>Core tech leads recent cuts:</strong> The scatter plot showcases core tech sectors — AI, Hardware, Infrastructure, Security, Data, Crypto, and Product. The largest events are dominated by giants: Intel (22K, Hardware), Dell (11K, Hardware), and Cisco (4K, Infrastructure), alongside major cybersecurity and AI firms. These profitable companies are expanding physical hardware assets while reducing stable human labor.</li>
    </ul>
  `,
  takeawayTitle: "Conclusive Takeaway: Automated Capital Gain",
  takeawayText: "Data centers represent automated, capital-heavy corporate expansion, not human labor security. Tech giants are expanding physical hardware assets while cutting human labor, showing data center booms provide zero job security."
};

let _cycleInterval = null;
let _cycleMetrics = null;
let _recentYears = [];
let _cycleIdx = 0;

const _s2Metrics = new MetricCards({
  overallTotal: 'kpi-s2-1',
  peakValue: 'kpi-s2-2',
  activeCount: 'kpi-s2-3'
});

function _tickYear() {
  if (!_cycleMetrics || !_recentYears.length) return;
  const entry = _recentYears[_cycleIdx];
  _cycleMetrics.update({
    peakValue: {
      label: `DC Power Capacity (${entry.year})`,
      value: entry.gw,
      trend: "Aterio baseline — GW active load",
      trendDirection: "up",
      suffix: ' GW'
    }
  });
  _cycleIdx = (_cycleIdx + 1) % _recentYears.length;
}

function buildTimeseries(layoffsData, aterioYearlyMW) {
  // Aggregate layoffs by quarter (exact dates available in layoffs.fyi data)
  const byQuarter = new Map();
  layoffsData.forEach(d => {
    if (d.country !== 'United States' || !d.total_laid_off) return;
    const raw = d.date || '';
    let year, month;
    if (raw.includes('/')) {
      const p = raw.split('/');
      month = +p[0]; year = +p[2];
    } else {
      year = +raw.slice(0, 4); month = 1;
    }
    if (!year || isNaN(year)) return;
    const key = `${year}-${Math.ceil(month / 3)}`;
    byQuarter.set(key, (byQuarter.get(key) || 0) + (+d.total_laid_off));
  });

  // Yearly power lookup — include one year beyond range for end interpolation
  const yearPower = new Map(
    aterioYearlyMW
      .filter(d => d.year >= 2019 && d.year <= 2027)
      .map(d => [d.year, Math.round(d.mw / 1000 * 10) / 10])
  );

  // One point per quarter, 2020 Q1 → 2026 Q4
  // DC power linearly interpolated between yearly snapshots
  const rows = [];
  let cumulativeLayoffs = 0;
  for (let year = 2020; year <= 2026; year++) {
    for (let q = 1; q <= 4; q++) {
      const p0 = yearPower.get(year) || 0;
      const p1 = yearPower.get(year + 1) || p0;
      const gw = Math.round((p0 + ((q - 1) / 4) * (p1 - p0)) * 10) / 10;
      const qLayoffs = byQuarter.get(`${year}-${q}`) || 0;
      cumulativeLayoffs += qLayoffs;
      // Slash format → parsed as local midnight (avoids UTC timezone off-by-one)
      rows.push({
        date: `${year}/${String((q - 1) * 3 + 1).padStart(2, '0')}/01`,
        layoffs: cumulativeLayoffs,
        datacenterPower: gw,
        isYearStart: q === 1,
        _newLayoffs: qLayoffs,
      });
    }
  }

  // Drop trailing quarters where layoffs data doesn't exist yet
  while (rows.length > 1 && rows[rows.length - 1]._newLayoffs === 0) rows.pop();

  // DC power data ends at the last Q1 (yearly snapshot) — null out any
  // partial quarter beyond it so the power line stops at the "year" tick
  if (rows.length > 0 && !rows[rows.length - 1].isYearStart) {
    rows[rows.length - 1].datacenterPower = null;
  }

  return rows;
}

export function updateKPIs(metrics, { layoffsData, aterioYearlyMW }) {
  cleanup();

  const totalLayoffs = d3.sum(
    layoffsData.filter(d => d.country === 'United States'),
    d => +d.total_laid_off || 0
  );

  _recentYears = aterioYearlyMW
    ? [2024, 2025, 2026].map(y => {
      const mw = aterioYearlyMW.find(d => d.year === y)?.mw || 0;
      return { year: y, gw: Math.round(mw / 100) / 10 };
    })
    : [];

  const latest = _recentYears.find(d => d.year === 2026) || { gw: 0 };
  const perGW = latest.gw > 0 ? Math.round(totalLayoffs / latest.gw) : 0;

  const payload = {
    overallTotal: {
      label: "Total US Tech Layoffs", value: totalLayoffs,
      trend: "Verified cuts 2020–2026 · layoffs.fyi", trendDirection: "down", raw: true
    },
    peakValue: {
      label: "DC Power Capacity (2026)", value: latest.gw,
      trend: "Aterio verified capacity", trendDirection: "up", suffix: ' GW'
    },
    activeCount: {
      label: "Layoffs per GW", value: perGW,
      trend: "Workers cut per gigawatt of DC capacity", trendDirection: "down", raw: true
    }
  };

  metrics.update(payload);
  _s2Metrics.update(payload);

  _cycleMetrics = {
    update(p) { metrics.update(p); _s2Metrics.update(p); }
  };
  _cycleIdx = 0;

  _cycleInterval = setInterval(_tickYear, 3000);
}

export function render({ layoffsData, aterioYearlyMW }) {
  // Switch layouts
  const s2 = document.getElementById('slide-2-layout');
  const dg = document.querySelector('.dashboard-grid');
  if (dg) dg.style.display = 'none';
  if (s2) s2.style.display = 'grid';

  // Populate narrative panel
  document.getElementById('s2-narrative-lbl').textContent = narrative.lbl;
  document.getElementById('s2-narrative-title').textContent = narrative.title;
  document.getElementById('s2-narrative-body').innerHTML = narrative.body;
  animateNarrative(document.getElementById('s2-narrative-body'));
  document.getElementById('s2-takeaway-title').textContent = narrative.takeawayTitle;
  document.getElementById('s2-takeaway-text').textContent = narrative.takeawayText;

  // Line chart — deferred one frame so flex layout resolves before getTotalLength()
  const timeseries = buildTimeseries(layoffsData, aterioYearlyMW);
  requestAnimationFrame(() => {
    const lineChart = new LineChart('#s2-container-line', {
      xKey: 'date',
      yKey: 'layoffs',
      xScaleType: 'time',
      isDualAxis: true
    });
    lineChart.update(timeseries);
  });

  // Scatter plot
  const TECH_INDUSTRIES = ['AI', 'Crypto', 'Data', 'Hardware', 'Infrastructure', 'Security', 'Product'];
  const techColors = [
    '#ff4757', // AI - Coral Red
    '#ffa502', // Crypto - Orange
    '#2ed573', // Data - Emerald Green
    '#00f2fe', // Hardware - Cyan
    '#1e90ff', // Infrastructure - Dodger Blue
    '#9b5de5', // Security - Purple
    '#f15bb5'  // Product - Hot Pink
  ];
  const parseDate = d3.timeParse('%m/%d/%Y');

  // Parse all layoffs data focusing on US core Tech sectors only
  const processedLayoffs = layoffsData.map((d, index) => ({
    id: `layoff-${index}`,
    company: d.company,
    stage: normalizeStage(d.stage),
    total_laid_off: d.total_laid_off ? +d.total_laid_off : null,
    percentage_laid_off: d.percentage_laid_off ? (+d.percentage_laid_off * 100) : null,
    industry: d.industry ? d.industry.trim() : null,
    funds_raised: Math.max(1, +d.funds_raised || 1),
    date: parseDate(d.date),
    country: d.country
  })).filter(d =>
    d.stage &&
    d.date !== null &&
    d.country === 'United States' &&
    !isNaN(d.total_laid_off) && d.total_laid_off >= 200 &&
    TECH_INDUSTRIES.includes(d.industry)
  );

  // Keep track of active configuration states
  let activeX = 'date';
  let activeY = 'total_laid_off';

  const scatter = new ScatterPlot('#s2-container-scatter', {
    xKey: activeX,
    yKey: activeY,
    sizeKey: 'funds_raised',
    groupKey: 'industry',
    groupLabel: 'Industry',
    labelKey: 'company',
    xLabel: 'Date',
    yLabel: 'Employees Laid Off',
    xScaleType: 'time',
    groupOrder: TECH_INDUSTRIES,
    colors: techColors
  });

  scatter.update(processedLayoffs);

  // Set default title
  const initialTitle = document.querySelector('#slide-2-layout .s2-chart-card:last-child .glass-card-title span');
  if (initialTitle) {
    initialTitle.textContent = 'Layoff Events by Date, Employees & Industry';
  }

  // Render Zoom Controls
  d3.select('#s2-scatter-controls').html(`
    <div style="display: flex; align-items: center; gap: 0.25rem;">
      <span style="font-size: 0.75rem; color: var(--text-secondary); margin-right: 0.5rem; opacity: 0.7;">(Scroll to zoom, click and drag to pan)</span>
      <button id="btn-scatter-zoom-in" class="btn-nav" style="padding: 0.25rem 0.5rem; font-size: 0.85rem; font-weight: bold; line-height: 1;" title="Zoom In">+</button>
      <button id="btn-scatter-zoom-out" class="btn-nav" style="padding: 0.25rem 0.5rem; font-size: 0.85rem; font-weight: bold; line-height: 1;" title="Zoom Out">−</button>
      <button id="btn-reset-scatter-zoom" class="btn-nav" style="padding: 0.25rem 0.625rem; font-size: 0.75rem; margin-left: 0.25rem;">Reset</button>
    </div>
  `);
  d3.select('#btn-scatter-zoom-in').on('click', () => scatter.zoomIn());
  d3.select('#btn-scatter-zoom-out').on('click', () => scatter.zoomOut());
  d3.select('#btn-reset-scatter-zoom').on('click', () => scatter.resetZoom());

  // Reset active classes on static toggles to match initial JS state
  d3.selectAll('#group-toggle-x button').classed('active', false);
  d3.select('#group-toggle-x button[data-val="date"]').classed('active', true);
  d3.selectAll('#group-toggle-y button').classed('active', false);
  d3.select('#group-toggle-y button[data-val="total_laid_off"]').classed('active', true);

  function updateScatterConfig() {
    let xLabel = 'Date';
    let xScaleType = 'time';
    let xFormat = null;
    if (activeX === 'funds_raised') {
      xLabel = 'Total Funds Raised';
      xScaleType = 'log';
      xFormat = d => {
        if (d >= 1000) return `$${(d / 1000).toFixed(0)}B`;
        return `$${d}M`;
      };
    }

    let yLabel = 'Employees Laid Off';
    let yScaleType = 'log';
    let yFormat = null;
    if (activeY === 'percentage_laid_off') {
      yLabel = 'Workforce Laid Off';
      yScaleType = 'linear';
      yFormat = d => `${Math.round(d)}%`;
    }

    const groupKey = 'industry';
    const groupLabel = 'Industry';
    const groupOrder = TECH_INDUSTRIES;
    const colors = techColors;

    // Update visual title based on states
    const cardTitle = document.querySelector('#slide-2-layout .s2-chart-card:last-child .glass-card-title span');
    if (cardTitle) {
      const xText = activeX === 'date' ? 'Date' : 'Funds Raised';
      const yText = activeY === 'total_laid_off' ? 'Employees' : '% Laid Off';
      cardTitle.textContent = `Layoff Events by ${xText}, ${yText} & Industry`;
    }

    scatter.update(processedLayoffs, {
      xKey: activeX,
      yKey: activeY,
      xLabel,
      yLabel,
      xScaleType,
      yScaleType,
      xFormat,
      yFormat,
      groupKey,
      groupLabel,
      groupOrder,
      colors
    });
  }

  // Wire up button handlers
  d3.selectAll('#group-toggle-x button').on('click', function() {
    d3.selectAll('#group-toggle-x button').classed('active', false);
    d3.select(this).classed('active', true);
    activeX = d3.select(this).attr('data-val');
    updateScatterConfig();
  });

  d3.selectAll('#group-toggle-y button').on('click', function() {
    d3.selectAll('#group-toggle-y button').classed('active', false);
    d3.select(this).classed('active', true);
    activeY = d3.select(this).attr('data-val');
    updateScatterConfig();
  });
}

export function cleanup() {
  if (_cycleInterval) { clearInterval(_cycleInterval); _cycleInterval = null; }
  const s2 = document.getElementById('slide-2-layout');
  const dg = document.querySelector('.dashboard-grid');
  if (s2) s2.style.display = 'none';
  if (dg) dg.style.display = '';
}
