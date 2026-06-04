import * as d3 from 'd3';
import { BarChart } from '../components/bar-chart.js';
import { MetricCards } from '../components/metric-cards.js';
import { animateNarrative } from '../utils/animate-narrative.js';
import { tooltip } from '../utils/helpers.js';

export const narrative = {
  lbl: "Exhibit 4: Rebuttal — The Jobs Myth",
  title: "GDP Illusions & Job Skew",
  body: `
    <p>When lobbying for tax subsidies, proponents promise an economic boom of high-paying tech jobs. BLS 2025 data shows what actually gets created.</p>
    <ul class="narrative-bullets">
      <li><strong>Temporary Roles · 80%:</strong> Electricians, HVAC mechanics, and temp laborers earn $36–62k and leave after 12–18 months. The build is local. The workforce is not.</li>
      <li><strong>Low-Wage Permanent · 15%:</strong> Security guards at $37,350/yr make up the bulk of lasting local employment — not the tech salaries cited in lobbying pitches.</li>
      <li><strong>Skilled Permanent · 5%:</strong> Only IT admins resemble the promised tech roles — at $99k, still 27% below the software developer median.</li>
    </ul>
  `,
  takeawayTitle: "Conclusive Takeaway: A Local Net Economic Drain",
  takeawayText: "The average data center job pays $49k. The jobs that stay pay $53k. Neither figure resembles the $136k software developer economy communities were lobbied with."
};

// ── KPI cycling state ──────────────────────────────────────────────────────────
const _s4Metrics = new MetricCards({
  overallTotal: 'kpi-s4-1',
  peakValue:    'kpi-s4-2',
  activeCount:  'kpi-s4-3'
});

let _cycleInterval2 = null;
let _cycleTimeout2  = null;
let _cycleMetrics   = null;
let _workforceObserver   = null;
let _workforceBlinkTimer = null;
let _splitCards = [];
let _cycleIdx2 = 0;

function _clearTimers() {
  if (_cycleInterval2) clearInterval(_cycleInterval2);
  if (_cycleTimeout2)  clearTimeout(_cycleTimeout2);
  _cycleInterval2 = null;
  _cycleTimeout2  = null;
}

function _tickSplit() {
  if (!_cycleMetrics || !_splitCards.length) return;
  const e = _splitCards[_cycleIdx2];
  _cycleMetrics.update({ peakValue: { label: e.label, value: e.pct, trend: e.trend, trendDirection: 'down', suffix: '%' } });
  _cycleIdx2 = (_cycleIdx2 + 1) % _splitCards.length;
}

// ── exports ────────────────────────────────────────────────────────────────────
export function cleanup() {
  _clearTimers();
  if (_workforceObserver)   { _workforceObserver.disconnect(); _workforceObserver = null; }
  if (_workforceBlinkTimer) { clearTimeout(_workforceBlinkTimer); _workforceBlinkTimer = null; }
  const s4 = document.getElementById('slide-4-layout');
  const dg = document.querySelector('.dashboard-grid');
  if (s4) s4.style.display = 'none';
  if (dg) dg.style.display = '';
}

export function updateKPIs(metrics, { blsWages }) {
  _clearTimers();
  if (!blsWages) return;

  const nonBenchmark = blsWages.filter(d => d.category !== 'benchmark');

  // Card 1 — weighted average wage across ALL jobs created (static)
  const avgWage = Math.round(
    nonBenchmark.reduce((sum, d) => sum + (d.pct / 100) * d.wage, 0)
  );

  // Card 2 — workforce composition split (cycling)
  _splitCards = [
    { label: 'Temporary Roles',    pct: 80, trend: 'Vanish in 12–18 months' },
    { label: 'Low-Wage Permanent', pct: 15, trend: 'Security & custodial' },
    { label: 'Skilled Permanent',  pct: 5,  trend: 'IT admins & systems' },
  ];

  // Card 3 — weighted average wage of permanent roles only (static)
  const permRoles   = nonBenchmark.filter(d => d.duration === 'permanent');
  const permPctSum  = permRoles.reduce((s, d) => s + d.pct, 0);
  const permAvgWage = Math.round(
    permRoles.reduce((sum, d) => sum + (d.pct / permPctSum) * d.wage, 0)
  );

  const initSplit = _splitCards[0];

  const payload = {
    overallTotal: { label: 'Avg. Wage of Jobs Created', value: avgWage,    trend: 'Weighted across all roles & workforce shares', trendDirection: 'down', prefix: '$', raw: true },
    peakValue:    { label: initSplit.label,              value: initSplit.pct, trend: initSplit.trend, trendDirection: 'down', suffix: '%' },
    activeCount:  { label: 'Avg. Permanent Wage',        value: permAvgWage, trend: 'After construction clears in 18 months',    trendDirection: 'down', prefix: '$', raw: true },
  };
  metrics.update(payload);
  _s4Metrics.update(payload);

  _cycleMetrics = { update(p) { metrics.update(p); _s4Metrics.update(p); } };
  _cycleIdx2 = 1;

  _cycleTimeout2 = setTimeout(() => { _cycleInterval2 = setInterval(_tickSplit, 3000); }, 1000);
}

export function render({ blsWages }) {
  const s4 = document.getElementById('slide-4-layout');
  const dg = document.querySelector('.dashboard-grid');
  if (dg) dg.style.display = 'none';
  if (s4) s4.style.display = 'grid';

  // Narrative
  document.getElementById('s4-narrative-lbl').textContent   = narrative.lbl;
  document.getElementById('s4-narrative-title').textContent = narrative.title;
  document.getElementById('s4-narrative-body').innerHTML    = narrative.body;
  animateNarrative(document.getElementById('s4-narrative-body'));
  document.getElementById('s4-takeaway-title').textContent  = narrative.takeawayTitle;
  document.getElementById('s4-takeaway-text').textContent   = narrative.takeawayText;

  if (!blsWages) return;

  // ── Workforce unit chart (responsive) ─────────────────────────────────────
  const _wfContainer = document.getElementById('s4-container-slope');
  _drawWorkforceChart(_wfContainer, blsWages);
  if (_workforceObserver) _workforceObserver.disconnect();
  _workforceObserver = new ResizeObserver(() => _drawWorkforceChart(_wfContainer, blsWages));
  _workforceObserver.observe(_wfContainer);

  // ── Wage bar chart ─────────────────────────────────────────────────────────
  const softDev = blsWages.find(d => d.category === 'benchmark');

  const wageData = [...blsWages]
    .filter(d => d.category !== 'benchmark')
    .sort((a, b) => b.wage - a.wage)
    .map(d => ({ role: d.role, wage: d.wage, category: d.category }));

  const catColor = {
    skilled:      'var(--accent-primary)',
    construction: 'var(--accent-warning)',
    operations:   'var(--accent-danger)'
  };

  const wageChart = new BarChart('#s4-container-wages', {
    xKey: 'wage',
    yKey: 'role',
    margin: { top: 28, right: 30, bottom: 40, left: 135 },
    colors: wageData.map(d => catColor[d.category] || 'var(--accent-primary)'),
    showValueLabels: true,
    benchmarkLines: softDev ? [{
      value: softDev.wage,
      label: `Software Dev — the promise ($${Math.round(softDev.wage / 1000)}k)`,
      color: '#05ffc8'
    }] : [],
    xTickFormat: d => `$${d3.format('~s')(d)}`,
    tooltipFormatter: (d, color) => `
      <div class="d3-tooltip-title">${d.role}</div>
      <div class="d3-tooltip-row">
        <span>Median annual:</span>
        <span class="d3-tooltip-val" style="color:${color}">$${d.wage.toLocaleString()}</span>
      </div>
      ${softDev ? `
      <div class="d3-tooltip-row">
        <span>vs. promise:</span>
        <span class="d3-tooltip-val" style="color:var(--accent-danger)">
          –$${(softDev.wage - d.wage).toLocaleString()} (${Math.round((1 - d.wage / softDev.wage) * 100)}% less)
        </span>
      </div>` : ''}
      <div class="d3-tooltip-row">
        <span>Source:</span>
        <span class="d3-tooltip-val" style="color:var(--text-secondary); font-size:0.75rem">BLS OEWS May 2025</span>
      </div>
    `
  });
  wageChart.update(wageData);
}

// ── Workforce unit chart ───────────────────────────────────────────────────────
const _UNIT_COLORS = {
  construction: { 'Temp Laborer': '#ff8c42', 'Electrician': '#ffb347', 'HVAC Mechanic': '#ffd06a' },
  operations:   { default: '#ff4d6d' },
  skilled:      { default: '#4facfe' },
};

function _drawWorkforceChart(container, blsWages) {
  if (!container) return;
  if (_workforceBlinkTimer) { clearTimeout(_workforceBlinkTimer); _workforceBlinkTimer = null; }
  container.innerHTML = '';

  const W = container.clientWidth  || 520;
  const H = container.clientHeight || 320;

  // Build 500 unit array ordered: construction → operations → skilled (each pct × 5)
  const SCALE = 5;
  const order = ['construction', 'operations', 'skilled'];
  const roles = order.flatMap(cat =>
    blsWages
      .filter(d => d.category === cat && d.pct > 0)
      .sort((a, b) => b.pct - a.pct)
  );

  const units = [];
  roles.forEach(r => {
    const roleColors = _UNIT_COLORS[r.category];
    const color = roleColors[r.role] || roleColors.default;
    for (let i = 0; i < r.pct * SCALE; i++) {
      units.push({ ...r, color });
    }
  });

  // Grid: 50 cols × 10 rows = 500 units
  const COLS = 50, ROWS = 10;
  const LEGEND_H = 76;
  const availH   = H - LEGEND_H - 8;
  const cellSize  = Math.min(Math.floor(W / COLS), Math.floor(availH / ROWS));
  const dotR      = cellSize * 0.36;
  const gridW     = COLS * cellSize;
  const gridH     = ROWS * cellSize;
  const ox        = (W - gridW) / 2;
  const oy        = Math.max(4, (H - gridH - LEGEND_H) / 2);

  const svg = d3.select(container).append('svg')
    .attr('width', W).attr('height', H).attr('class', 'd3-chart');

  const unitData = units.map((u, i) => ({
    ...u,
    cx: ox + (i % COLS) * cellSize + cellSize / 2,
    cy: oy + Math.floor(i / COLS) * cellSize + cellSize / 2,
  }));

  const dots = svg.selectAll('circle.unit-dot')
    .data(unitData)
    .join('circle')
    .attr('class', 'unit-dot')
    .attr('cx', d => d.cx)
    .attr('cy', d => d.cy)
    .attr('r', 0)
    .attr('fill', d => d.color)
    .attr('stroke', 'rgba(0,0,0,0.15)')
    .attr('stroke-width', 0.5)
    .style('cursor', 'pointer');

  dots
    .on('mouseover', function(event, d) {
      d3.select(this).transition().duration(110).attr('r', dotR * 1.45);
      tooltip.show(`
        <div class="d3-tooltip-title" style="color:${d.color}">${d.role}</div>
        <div class="d3-tooltip-row"><span>Workforce share:</span><span class="d3-tooltip-val">${d.pct}% of jobs created</span></div>
        <div class="d3-tooltip-row"><span>Median wage:</span><span class="d3-tooltip-val">$${d.wage.toLocaleString()}/yr</span></div>
        <div class="d3-tooltip-row"><span>Duration:</span><span class="d3-tooltip-val" style="color:${d.duration === 'temporary' ? 'var(--accent-warning)' : 'var(--text-secondary)'}">
          ${d.duration === 'temporary' ? 'Temporary — leaves in 12–18 mo' : 'Permanent'}
        </span></div>
      `, event);
    })
    .on('mousemove', event => tooltip.move(event))
    .on('mouseout', function() {
      d3.select(this).transition().duration(110).attr('r', dotR);
      tooltip.hide();
    });

  // Staggered entry animation
  dots.transition()
    .delay((_, i) => i * 2)
    .duration(100)
    .ease(d3.easeCubicOut)
    .attr('r', dotR);

  // After entry finishes, blink temporary dots
  const entryEnd = (units.length - 1) * 2 + 100 + 120;
  _workforceBlinkTimer = setTimeout(() => {
    svg.selectAll('circle.unit-dot')
      .filter(d => d.duration === 'temporary')
      .classed('unit-dot-temp', true);
  }, entryEnd);

  // Legend — grouped by category, role dots beneath each subtitle
  const legendGroups = [
    {
      label: 'Construction · 80%',
      color: '#ffb347',
      roles: [
        { role: 'Temp Laborer',  color: '#ff8c42' },
        { role: 'Electrician',   color: '#ffb347' },
        { role: 'HVAC Mechanic', color: '#ffd06a' },
      ],
    },
    {
      label: 'Security · 15%',
      color: '#ff4d6d',
      roles: [{ role: 'Security Guard',     color: '#ff4d6d' }],
    },
    {
      label: 'Skilled IT · 5%',
      color: '#4facfe',
      roles: [{ role: 'IT / Systems Admin', color: '#4facfe' }],
    },
  ];

  const legendY = oy + gridH + 26;
  const colW    = W / legendGroups.length;

  legendGroups.forEach((grp, gi) => {
    const gx = gi * colW + 10;

    // Category subtitle
    svg.append('text')
      .attr('x', gx).attr('y', legendY)
      .attr('font-size', '9px').attr('font-weight', '700')
      .attr('letter-spacing', '0.6px')
      .attr('fill', grp.color)
      .text(grp.label.toUpperCase());

    // Role dots + labels
    grp.roles.forEach((role, ri) => {
      const ry = legendY + 14 + ri * 16;

      svg.append('circle')
        .attr('cx', gx + 4).attr('cy', ry + 3)
        .attr('r', 4)
        .attr('fill', role.color)
        .attr('stroke', 'rgba(0,0,0,0.15)').attr('stroke-width', 0.5);

      svg.append('text')
        .attr('x', gx + 13).attr('y', ry + 3)
        .attr('dy', '0.35em')
        .attr('font-size', '9px')
        .attr('fill', 'var(--text-secondary)')
        .text(role.role);
    });
  });
}
