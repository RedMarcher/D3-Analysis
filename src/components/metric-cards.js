import * as d3 from 'd3';
import { formatValue } from '../utils/helpers.js';

/**
 * Reusable dynamic counter and trend card component using D3 interpolation.
 */
export class MetricCards {
  /**
   * Initializes target cards.
   * @param {Object} selectors - Map of keys to DOM selectors
   */
  constructor(selectors = {}) {
    this.selectors = selectors;
  }

  /**
   * Updates metric cards with values and animations.
   * @param {Object} data - Key-value pair of metric data { total: 100, max: 200, trendUp: true, etc. }
   */
  update(data = {}) {
    Object.entries(this.selectors).forEach(([key, elementId]) => {
      const card = document.getElementById(elementId);
      if (!card || !data[key]) return;

      const metric = data[key];
      const valEl = card.querySelector('.metric-value');
      const labelEl = card.querySelector('.metric-label');
      const trendEl = card.querySelector('.metric-trend');

      // Update Label
      if (metric.label && labelEl) {
        labelEl.textContent = metric.label;
      }

      // Animate Numeric Count-Up using D3 Transitions
      if (valEl && typeof metric.value === 'number') {
        const startVal = parseFloat(valEl.dataset.currentValue) || 0;
        const endVal = metric.value;
        valEl.dataset.currentValue = endVal;

        d3.select(valEl)
          .transition()
          .duration(800)
          .tween('text', function() {
            const interpolator = d3.interpolate(startVal, endVal);
            return function(t) {
              const v = interpolator(t);
              valEl.textContent = (metric.raw ? Math.round(v).toLocaleString() : formatValue(v)) + (metric.suffix || '');
            };
          });
      } else if (valEl && metric.value !== undefined) {
        valEl.textContent = metric.value;
      }

      // Update Trend indicators
      if (trendEl && metric.trend !== undefined) {
        const trendSpan = trendEl.querySelector('span');
        if (trendSpan) {
          trendSpan.textContent = metric.trend;
        }

        // Adjust trend styling dynamically
        trendEl.classList.remove('up', 'down');
        if (metric.trendDirection === 'up') {
          trendEl.classList.add('up');
          trendEl.style.display = 'flex';
        } else if (metric.trendDirection === 'down') {
          trendEl.classList.add('down');
          trendEl.style.display = 'flex';
        } else if (metric.trendDirection === 'neutral') {
          trendEl.style.display = 'flex';
        } else {
          trendEl.style.display = 'none';
        }
      }
    });
  }
}
