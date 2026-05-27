import * as d3 from 'd3';
import { LineChart } from '../components/line-chart.js';
import { ScatterPlot } from '../components/scatter-plot.js';

export const narrative = {
  lbl: "Case Study 2: Core Argument - Tech Layoffs",
  title: "Corporate Gain vs. Stable Labor",
  body: `
    <p>Tech giants are investing billions in new data center physical assets, but are simultaneously conducting massive work cuts, shedding hundreds of thousands of jobs.</p>
    <ul class="narrative-bullets">
      <li><strong>Dual-Trend Demise:</strong> From 2019 to 2026, cumulative data center power capacity surged from 4.2GW to 22GW while tech layoffs spiked to 462,000.</li>
      <li><strong>Automated Over Human:</strong> Capital expenditure is heavily skewed towards high-margin computing assets rather than preserving stable human employment.</li>
      <li><strong>Concentrated Impact:</strong> Massive tech centers in California and Washington show severe layoffs despite active local data center builds.</li>
    </ul>
  `,
  takeawayTitle: "Conclusive Takeaway: Automated Capital Gain",
  takeawayText: "Data centers represent automated, capital-heavy corporate expansion, not human labor security. Tech giants are expanding physical hardware assets while cutting human labor, showing data center booms provide zero job security."
};

export function updateKPIs(metrics, { slideData, layoffsData }) {
  let layoffsVal = 462000;
  let layoffsTrend = "Estimated cumulative cuts";

  if (layoffsData) {
    const usLayoffs = d3.sum(layoffsData.filter(d => d.country === 'United States'), d => +d.total_laid_off || 0);
    layoffsVal = usLayoffs;
    layoffsTrend = "US Tech cuts since 2019";
  }

  const latestTimeseries = slideData.layoffTimeseries[slideData.layoffTimeseries.length - 1];
  const maxPower = latestTimeseries ? latestTimeseries.datacenterPower : 22.0;

  metrics.update({
    overallTotal: { label: "Tech Cuts Spiked", value: layoffsVal, trend: layoffsTrend, trendDirection: "down" },
    peakValue: { label: "Compute Capacity", value: maxPower, trend: "Surging to 22 GW load", trendDirection: "up" },
    activeCount: { label: "Layoffs per GW", value: Math.round(layoffsVal / maxPower), trend: "Workers cut per GW", trendDirection: "down" }
  });
}

export function render({ containerLeft, containerRight, slideData, layoffsData }) {
  document.querySelector('.charts-grid').style.gridTemplateColumns = '1fr 1fr';

  document.getElementById('us-map-title').textContent = "Tech Layoffs Spike vs Cumulative Compute Growth";
  d3.select('#us-map-mode-badge').text('D3 Dual-Axis Line').style('display', 'block');

  const lineChart = new LineChart(containerLeft, {
    xKey: 'date',
    yKey: 'layoffs',
    xScaleType: 'time',
    isDualAxis: true
  });
  lineChart.update(slideData.layoffTimeseries);

  document.getElementById('supporting-chart-title').textContent = "Tech Layoffs Corporate Spread";
  d3.select('#supporting-chart-mode-badge').text('D3 Scatter Plot').style('display', 'block');

  const scatter = new ScatterPlot(containerRight, {
    xKey: 'funds_raised',
    yKey: 'total_laid_off',
    sizeKey: 'percentage_laid_off_pct',
    groupKey: 'industry',
    labelKey: 'company',
    xLabel: 'Total Funds Raised ($ Millions)',
    yLabel: 'Total Employees Laid Off',
    colors: d3.schemeTableau10
  });

  const formattedLayoffs = layoffsData.map(d => ({
    company: d.company,
    industry: d.industry || 'Other',
    total_laid_off: +d.total_laid_off,
    funds_raised: +d.funds_raised,
    percentage_laid_off_pct: (+d.percentage_laid_off || 0) * 100
  })).filter(d =>
    !isNaN(d.total_laid_off) && d.total_laid_off >= 400 &&
    !isNaN(d.funds_raised) && d.funds_raised > 0 &&
    !isNaN(d.percentage_laid_off_pct) && d.percentage_laid_off_pct > 0
  );

  scatter.update(formattedLayoffs);
}
