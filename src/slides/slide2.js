import * as d3 from 'd3';
import { LineChart } from '../components/line-chart.js';
import { ScatterPlot } from '../components/scatter-plot.js';

let _cycleInterval = null;
let _cycleMetrics  = null;
let _recentYears   = [];
let _cycleIdx      = 0;

function _tickYear() {
  if (!_cycleMetrics || !_recentYears.length) return;
  const entry = _recentYears[_cycleIdx];
  _cycleMetrics.update({
    peakValue: {
      label: `DC Power Capacity (${entry.year})`,
      value: entry.gw,
      trend: "Aterio baseline — GW active load",
      trendDirection: "up"
    }
  });
  _cycleIdx = (_cycleIdx + 1) % _recentYears.length;
}

export function cleanup() {
  if (_cycleInterval) { clearInterval(_cycleInterval); _cycleInterval = null; }
}

export const narrative = {
  lbl: "Exhibit 2: Core Argument - Tech Layoffs",
  title: "Corporate Gain vs. Stable Labor",
  body: `
    <p>Tech giants are investing billions in new data center physical assets, but are simultaneously conducting massive workforce cuts, shedding hundreds of thousands of jobs.</p>
    <ul class="narrative-bullets">
      <li><strong>Diverging trends:</strong> From 2020 to 2026, U.S. data center power capacity tripled from 19 GW to 59 GW — while tech layoffs surged past 655,000 cumulative cuts.</li>
      <li><strong>Automated over human:</strong> Capital expenditure is skewed towards high-margin computing assets rather than preserving stable human employment.</li>
      <li><strong>Concentrated impact:</strong> Companies in California and Washington show severe layoffs despite — and because of — active local data center expansion.</li>
    </ul>
  `,
  takeawayTitle: "Conclusive Takeaway: Automated Capital Gain",
  takeawayText: "Data centers represent automated, capital-heavy corporate expansion, not human labor security. Tech giants are expanding physical hardware assets while cutting human labor, showing data center booms provide zero job security."
};

function buildTimeseries(layoffsData, aterioYearlyMW) {
  const byYear = new Map();
  layoffsData.forEach(d => {
    if (d.country !== 'United States' || !d.total_laid_off) return;
    const raw  = d.date || '';
    const year = raw.includes('/') ? +raw.split('/')[2] : +raw.slice(0, 4);
    if (!year || isNaN(year)) return;
    byYear.set(year, (byYear.get(year) || 0) + (+d.total_laid_off));
  });

  return aterioYearlyMW
    .filter(d => d.year >= 2020 && d.year <= 2026)
    .map(d => ({
      date:             `${d.year}-01-01`,
      layoffs:          byYear.get(d.year) || 0,
      datacenterPower:  Math.round(d.mw / 1000 * 10) / 10  // convert MW → GW, 1dp
    }));
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

  const latest   = _recentYears.find(d => d.year === 2026) || { gw: 0 };
  const perGW    = latest.gw > 0 ? Math.round(totalLayoffs / latest.gw) : 0;

  _cycleMetrics = metrics;
  _cycleIdx     = 0;  // first tick goes to 2024, giving 2026 → 2024 → 2025 → repeat

  metrics.update({
    overallTotal: {
      label: "Total US Tech Layoffs", value: totalLayoffs,
      trend: "Verified cuts 2020–2026 · layoffs.fyi", trendDirection: "down", raw: true
    },
    peakValue: {
      label: "DC Power Capacity (2026)", value: latest.gw,
      trend: "Aterio baseline — GW active load", trendDirection: "up"
    },
    activeCount: {
      label: "Layoffs per GW", value: perGW,
      trend: "Workers cut per gigawatt of DC capacity", trendDirection: "down", raw: true
    }
  });

  _cycleInterval = setInterval(_tickYear, 3000);
}

export function render({ containerLeft, containerRight, layoffsData, aterioYearlyMW }) {
  document.querySelector('.charts-grid').style.gridTemplateColumns = '1fr 1fr';

  document.getElementById('us-map-title').textContent = "U.S. Tech Layoffs vs. Data Center Power Capacity";
  d3.select('#us-map-mode-badge').text('Dual-Axis · Aterio + layoffs.fyi').style('display', 'block');

  const timeseries = buildTimeseries(layoffsData, aterioYearlyMW);

  const lineChart = new LineChart(containerLeft, {
    xKey: 'date',
    yKey: 'layoffs',
    xScaleType: 'time',
    isDualAxis: true
  });
  lineChart.update(timeseries);

  document.getElementById('supporting-chart-title').textContent = "Layoff Events by Company & Funding Stage";
  d3.select('#supporting-chart-mode-badge').text('Scatter · layoffs.fyi').style('display', 'block');

  const STAGE_ORDER = ['Seed', 'Series A', 'Series B', 'Series C', 'Series D+', 'Private Equity', 'Post-IPO', 'Acquired'];
  const stageColors = STAGE_ORDER.map((_, i) => d3.interpolatePlasma(0.15 + (i / (STAGE_ORDER.length - 1)) * 0.8));

  const parseDate = d3.timeParse('%m/%d/%Y');

  function normalizeStage(s) {
    if (!s) return null;
    if (['Series D','Series E','Series F','Series G','Series H','Series I'].includes(s)) return 'Series D+';
    return STAGE_ORDER.includes(s) ? s : null;
  }

  const scatter = new ScatterPlot(containerRight, {
    xKey:       'date',
    yKey:       'total_laid_off',
    sizeKey:    'funds_raised',
    groupKey:   'stage',
    groupLabel: 'Stage',
    labelKey:   'company',
    xLabel:     'Date',
    yLabel:     'Employees Laid Off',
    xScaleType: 'time',
    groupOrder: STAGE_ORDER,
    colors:     stageColors
  });

  const formattedLayoffs = layoffsData.map(d => ({
    company:       d.company,
    stage:         normalizeStage(d.stage),
    total_laid_off: +d.total_laid_off,
    funds_raised:  Math.max(1, +d.funds_raised || 1),
    date:          parseDate(d.date)
  })).filter(d =>
    d.stage &&
    d.date !== null &&
    !isNaN(d.total_laid_off) && d.total_laid_off >= 200
  );

  scatter.update(formattedLayoffs);

  d3.select('#supporting-chart-controls').html(`
    <button id="btn-reset-scatter-zoom" class="btn-nav" style="padding: 0.25rem 0.625rem; font-size: 0.75rem;">Reset Zoom</button>
  `);
  d3.select('#btn-reset-scatter-zoom').on('click', () => scatter.resetZoom());
}
