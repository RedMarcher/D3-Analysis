import * as d3 from 'd3';
import { USMap } from '../components/us-map.js';

export const narrative = {
  lbl: "Exhibit 1: The True Scale",
  title: "The Massive Infrastructure Footprint",
  body: `
    <p>The U.S. data center footprint is expanding rapidly, driven by AI and cloud infrastructure demands. This exhibit illustrates where the physical infrastructure is concentrated, and where future facilities are planned.</p>
    <ul class="narrative-bullets">
      <li><strong>Leading States:</strong> Virginia, Texas, and California lead in active facilities, with Virginia having more than double the next state.</li>
      <li><strong>Exponential Expansion:</strong> 4,138 facilities are planned or under construction — more than double the 1,963 currently active.</li>
      <li><strong>Corporate Dominance:</strong> Amazon and Microsoft dominate the landscape, controlling the majority of capacity in every major hub state. Data centers require massive capital investment, and do not have small or medium sized competitors.</li>
    </ul>
  `,
  takeawayTitle: "Conclusive Takeaway: Unavoidability",
  takeawayText: "Data centers exist in every single US state. They exist in rural, suburban, and urban settings. They are typically not located to avoid population centers. Most facilities are operated directly by corporations, rather than by local businesses or franchises."
};

let _cycleInterval = null;
let _cycleInterval2 = null;
let _cycleTimeout2 = null;
let _cycleMetrics = null;
let _top3States = [];
let _top3Ops = [];
let _cycleIdx = 0;
let _cycleIdx2 = 0;
let _activeCount = 0;

function _tickTopState() {
  if (!_cycleMetrics || !_top3States.length) return;
  const entry = _top3States[_cycleIdx];
  const rank = ['#1', '#2', '#3'][_cycleIdx];
  const pct = ((entry.active / _activeCount) * 100).toFixed(1);
  _cycleMetrics.update({
    activeCount: {
      label: `${rank} State (${entry.state_name})`,
      value: entry.active,
      trend: `${pct}% of U.S. total · Aterio`,
      trendDirection: 'up',
      raw: true
    }
  });
  _cycleIdx = (_cycleIdx + 1) % _top3States.length;
}

function _tickOperator() {
  if (!_cycleMetrics || !_top3Ops.length) return;
  const entry = _top3Ops[_cycleIdx2];
  const rank = ['#1', '#2', '#3'][_cycleIdx2];
  _cycleMetrics.update({
    peakValue: {
      label: `${rank} Operator`,
      value: entry.count,
      trend: `${entry.name} · ${entry.pct}% of active`,
      trendDirection: 'up',
      raw: true
    }
  });
  _cycleIdx2 = (_cycleIdx2 + 1) % _top3Ops.length;
}

function _clearTimers() {
  if (_cycleInterval) { clearInterval(_cycleInterval); _cycleInterval = null; }
  if (_cycleInterval2) { clearInterval(_cycleInterval2); _cycleInterval2 = null; }
  if (_cycleTimeout2) { clearTimeout(_cycleTimeout2); _cycleTimeout2 = null; }
}

export function cleanup() {
  _clearTimers();
  const grid = document.querySelector('.charts-grid');
  grid.classList.remove('shrink-rows', 's1-mode');
  document.getElementById('supporting-chart-card').classList.remove('hidden');
  document.getElementById('map-detail-panel').classList.remove('active');
  const badge = document.getElementById('map-overlay-source');
  if (badge) badge.classList.remove('visible');
}

export function updateKPIs(metrics, { aterioStates }) {
  _clearTimers();
  if (!aterioStates) return;

  _activeCount = d3.sum(aterioStates, d => d.active);
  _cycleMetrics = metrics;

  _top3States = [...aterioStates].sort((a, b) => b.active - a.active).slice(0, 3);

  // Aggregate dominant operators across all states
  const opMap = new Map();
  aterioStates.forEach(s => {
    if (!s.dominant_operator) return;
    opMap.set(s.dominant_operator, (opMap.get(s.dominant_operator) || 0) + s.active);
  });
  _top3Ops = Array.from(opMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => ({ name, count, pct: ((count / _activeCount) * 100).toFixed(1) }));

  _cycleIdx = 1;
  _cycleIdx2 = 1;

  const firstState = _top3States[0];
  const firstOp = _top3Ops[0];

  metrics.update({
    overallTotal: {
      label: "Nationwide Active", value: _activeCount,
      trend: "Aterio verified facilities", trendDirection: "up", raw: true
    },
    peakValue: {
      label: "#1 Operator", value: firstOp.count,
      trend: `${firstOp.name} · ${firstOp.pct}% of active`,
      trendDirection: "up", raw: true
    },
    activeCount: {
      label: `#1 State (${firstState.state_name})`, value: firstState.active,
      trend: `${((firstState.active / _activeCount) * 100).toFixed(1)}% of U.S. total · Aterio`,
      trendDirection: "up", raw: true
    }
  });

  _cycleInterval = setInterval(_tickTopState, 3000);
  _cycleTimeout2 = setTimeout(() => {
    _cycleInterval2 = setInterval(_tickOperator, 3000);
  }, 1500);
}

let panelLocked = false;

function updateDetailPanel({ type, name, item }) {
  const placeholder = document.querySelector('.map-detail-placeholder');
  const content = document.querySelector('.map-detail-content');
  if (!placeholder || !content) return;

  placeholder.style.display = 'none';
  content.style.display = 'block';

  if (type === 'facility') {
    const sqft = +item.sqft;
    document.getElementById('detail-state-name').textContent = item.name || 'Data Center';
    document.getElementById('detail-rows').innerHTML = `
      <div class="map-detail-row">
        <span class="map-detail-row-label">Operator</span>
        <span class="map-detail-row-value" style="color: var(--accent-primary); font-size: 0.8rem">${item.operator || 'Independent'}</span>
      </div>
      <div class="map-detail-row">
        <span class="map-detail-row-label">Location</span>
        <span class="map-detail-row-value" style="font-size: 0.8rem">${item.county}, ${item.state}</span>
      </div>
      <div class="map-detail-row">
        <span class="map-detail-row-label">Building Size</span>
        <span class="map-detail-row-value" style="color: var(--accent-secondary)">${sqft > 0 ? sqft.toLocaleString() + ' sqft' : '—'}</span>
      </div>
      <div class="map-detail-row" style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--border-color)">
        <span class="map-detail-row-label" style="opacity:0.5">Source: IM3 Atlas</span>
      </div>
    `;
    return;
  }

  if (!item) {
    placeholder.style.display = 'flex';
    content.style.display = 'none';
    return;
  }

  const mwStr = item.active_mw > 0 ? item.active_mw.toLocaleString() + ' MW' : '—';
  const sqftStr = item.active_sqft > 0 ? (item.active_sqft / 1e6).toFixed(1) + 'M sqft' : '—';

  document.getElementById('detail-state-name').textContent = name;
  document.getElementById('detail-rows').innerHTML = `
    <div class="map-detail-row">
      <span class="map-detail-row-label">Active Facilities</span>
      <span class="map-detail-row-value" style="color: var(--accent-primary)">${item.active.toLocaleString()}</span>
    </div>
    <div class="map-detail-row">
      <span class="map-detail-row-label">Planned / Pipeline</span>
      <span class="map-detail-row-value" style="color: var(--accent-secondary)">+${item.planned.toLocaleString()}</span>
    </div>
    <div class="map-detail-row">
      <span class="map-detail-row-label">Active Power</span>
      <span class="map-detail-row-value" style="color: var(--accent-warning)">${mwStr}</span>
    </div>
    <div class="map-detail-row">
      <span class="map-detail-row-label">#1 Operator</span>
      <span class="map-detail-row-value" style="color: var(--text-primary); font-size: 0.78rem">
        ${item.dominant_operator || '—'}${item.dominant_operator ? `<span style="color: var(--accent-warning); margin-left: 0.3rem">(${((item.dominant_operator_n / item.active) * 100).toFixed(0)}%)</span>` : ''}
      </span>
    </div>
    <div class="map-detail-row" style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--border-color)">
      <span class="map-detail-row-label" style="opacity:0.5">Source: Aterio · May 2026</span>
    </div>
  `;
}

function resetDetailPanel() {
  if (panelLocked) return;
  const placeholder = document.querySelector('.map-detail-placeholder');
  const content = document.querySelector('.map-detail-content');
  if (placeholder) placeholder.style.display = 'flex';
  if (content) content.style.display = 'none';
}

function setSourceBadge(isOverlay) {
  const badge = document.getElementById('map-overlay-source');
  if (!badge) return;
  if (isOverlay) {
    badge.textContent = 'Source: IM3 Atlas v2026 + Aterio';
    badge.title = 'Dots from IM3 (1,479 coords, no AK/HI). Bubble sizes from Aterio (1,963 active + 4,138 pipeline).';
    badge.style.color = '';
  } else {
    badge.textContent = 'Source: Aterio US Data Centers · May 2026';
    badge.title = 'Per-state active and pipeline counts from Aterio (aterio.io)';
    badge.style.color = '';
  }
}

export function render({ containerLeft, geoJson, atlasData, aterioStates, showFacilitiesOverlay, onOverlayToggle }) {
  panelLocked = false;

  const grid = document.querySelector('.charts-grid');
  grid.classList.add('s1-mode', 'shrink-rows');
  document.getElementById('supporting-chart-card').classList.add('hidden');
  document.getElementById('map-detail-panel').classList.add('active');

  document.getElementById('us-map-title').textContent = "U.S. Data Center Geographic Concentration";

  const titleDiv = document.querySelector('#us-map-mode-badge').parentElement;
  if (!document.getElementById('map-overlay-source')) {
    const sourceBadge = document.createElement('span');
    sourceBadge.id = 'map-overlay-source';
    sourceBadge.className = 'map-source-badge';
    titleDiv.appendChild(sourceBadge);
  }
  document.getElementById('map-overlay-source').classList.add('visible');
  setSourceBadge(showFacilitiesOverlay);

  d3.select('#us-map-controls').html(`
    <label class="toggle-control">
      <input type="checkbox" id="chk-show-facilities" ${showFacilitiesOverlay ? 'checked' : ''}>
      Overlay 1,479 Real Facilities (IM3)
    </label>
    <div style="display: flex; align-items: center; gap: 0.25rem;">
      <span style="font-size: 0.75rem; color: var(--text-secondary); margin-right: 0.5rem; opacity: 0.7;">(Scroll to zoom, click and drag to pan)</span>
      <button id="btn-zoom-in" class="btn-nav" style="padding: 0.25rem 0.5rem; font-size: 0.85rem; font-weight: bold; line-height: 1;" title="Zoom In">+</button>
      <button id="btn-zoom-out" class="btn-nav" style="padding: 0.25rem 0.5rem; font-size: 0.85rem; font-weight: bold; line-height: 1;" title="Zoom Out">−</button>
      <button id="btn-reset-zoom" class="btn-nav" style="padding: 0.25rem 0.625rem; font-size: 0.75rem; margin-left: 0.25rem;">Reset</button>
    </div>
  `);

  const usMap = new USMap(containerLeft, geoJson, {
    onStateHover: (payload) => { if (!panelLocked) updateDetailPanel(payload); },
    onStateOut: () => { if (!panelLocked) resetDetailPanel(); },
    onStateClick: (payload) => { panelLocked = true; updateDetailPanel(payload); },
    onStateDeselect: () => { panelLocked = false; resetDetailPanel(); }
  });
  usMap.update(aterioStates, 1, atlasData, showFacilitiesOverlay);

  d3.select('#chk-show-facilities').on('change', function () {
    setSourceBadge(this.checked);
    onOverlayToggle(this.checked, usMap);
  });

  d3.select('#btn-zoom-in').on('click', () => usMap.zoomIn());
  d3.select('#btn-zoom-out').on('click', () => usMap.zoomOut());
  d3.select('#btn-reset-zoom').on('click', () => usMap.resetZoom());
}
