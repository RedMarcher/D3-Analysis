import * as d3 from 'd3';
import { BarChart } from '../components/bar-chart.js';
import { JobChart } from '../components/job-chart.js';

export const narrative = {
  lbl: "Exhibit 4: Rebuttals - The Jobs Myth",
  title: "GDP Illusions & Job Skew",
  body: `
    <p>Proponents claim data centers create local GDP and rich jobs. In reality, the labor force is highly skewed towards low-wage and temporary construction roles.</p>
    <ul class="narrative-bullets">
      <li><strong>Temporary Boom:</strong> 80% of jobs are temporary construction roles that disappear after 12–18 months.</li>
      <li><strong>Low-Wage Custodial:</strong> 15% are permanent but low-paying security and groundkeeper jobs averaging $38,000/yr.</li>
      <li><strong>Technician Disparity:</strong> Only 5% are skilled technician roles, and their wages are 55% lower than software engineering positions ($65k vs $145k).</li>
    </ul>
  `,
  takeawayTitle: "Conclusive Takeaway: A Local Net Economic Drain",
  takeawayText: "Data centers contribute to corporate GDP but represent a net local drain. They create few permanent, high-paying jobs, consume vast public resources, and do not enrich local labor workforces, debunking the economic benefit myth."
};

export function cleanup() {
  document.querySelector('.charts-grid').style.gridTemplateColumns = '';
  d3.select('#us-map-mode-badge').style('display', null).style('color', null).style('font-size', null);
  d3.select('#supporting-chart-mode-badge').style('display', null).style('color', null).style('font-size', null);
}

export function updateKPIs(metrics) {
  metrics.update({
    overallTotal: { label: "Temporary Work", value: 80.0, trend: "Vanish in 18 months", trendDirection: "down" },
    peakValue: { label: "Technician Jobs", value: 5.0, trend: "Only 75 per $1B spent", trendDirection: "down" },
    activeCount: { label: "Wage Disparity", value: 55.0, trend: "Lower than software eng.", trendDirection: "down" }
  });
}

export function render({ containerLeft, containerRight, slideData }) {
  document.querySelector('.charts-grid').style.gridTemplateColumns = '1fr 1fr';

  document.getElementById('us-map-title').textContent = "Data Center Tech vs. Broader Tech Industry Wages";
  d3.select('#us-map-mode-badge').text('Source: Unknown / Requires Verification').style('display', 'block').style('color', 'var(--accent-danger)').style('font-size', '0.75rem');

  const wageData = [
    { role: "Software\nEngineer", wage: 145000 },
    ...slideData.jobsBreakdown.map(d => {
      let role = d.category;
      if (role === "Temporary Construction") role = "Temporary\nConstruction";
      else if (role === "Low-wage Support") role = "Low-wage\nSupport";
      else if (role === "Skilled Technicians") role = "Skilled\nTechnicians";
      return { role, wage: d.salary };
    })
  ].sort((a, b) => b.wage - a.wage);

  const wageChart = new BarChart(containerLeft, {
    xKey: 'wage',
    yKey: 'role',
    margin: { top: 20, right: 30, bottom: 30, left: 150 },
    colors: ['var(--accent-success)', 'var(--accent-primary)', 'var(--accent-warning)', 'var(--accent-danger)'],
    xTickFormat: d => `$${d3.format(',.0f')(d)}`,
    tooltipFormatter: (d, color) => `
      <div class="d3-tooltip-title">Annual Wage Comparison</div>
      <div class="d3-tooltip-row">
        <span>Role:</span>
        <span class="d3-tooltip-val" style="color: ${color}">${d.role.replace('\n', ' ')}</span>
      </div>
      <div class="d3-tooltip-row">
        <span>Average Salary:</span>
        <span class="d3-tooltip-val" style="color: #fff">$${d.wage.toLocaleString()} / yr</span>
      </div>
    `
  });
  wageChart.update(wageData);

  document.getElementById('supporting-chart-title').textContent = "Workforce Composition & Demographics";
  d3.select('#supporting-chart-mode-badge').text('Source: Unknown / Requires Verification').style('display', 'block').style('color', 'var(--accent-danger)').style('font-size', '0.75rem');

  d3.select(containerRight).style('height', 'auto');
  const jobChart = new JobChart(containerRight);
  jobChart.update(slideData.jobsBreakdown);
}
