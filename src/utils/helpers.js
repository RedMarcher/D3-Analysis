/**
 * Agnostic D3 Dashboard Utility Helpers
 */

/**
 * Calculates current bounding container dimensions for responsive redrawing.
 * @param {HTMLElement} element - The DOM element to measure
 * @param {Object} margin - Margins (top, right, bottom, left)
 * @returns {Object} Calculated dimensions { width, height, innerWidth, innerHeight }
 */
export function getDimensions(element, margin = { top: 20, right: 30, bottom: 40, left: 50 }) {
  const rect = element.getBoundingClientRect();
  const width = Math.max(100, rect.width);
  const height = Math.max(100, rect.height);
  
  return {
    width,
    height,
    innerWidth: Math.max(10, width - margin.left - margin.right),
    innerHeight: Math.max(10, height - margin.top - margin.bottom)
  };
}

/**
 * Automatically formats numeric metrics to be human-readable.
 * @param {number} num - The number to format
 * @returns {string} Formatted number (e.g., 1.5K, 4.2M)
 */
export function formatValue(num) {
  if (num === null || num === undefined || isNaN(num)) return '--';
  const absVal = Math.abs(num);
  
  if (absVal >= 1e9) {
    return `${(num / 1e9).toFixed(1).replace(/\.0$/, '')}B`;
  }
  if (absVal >= 1e6) {
    return `${(num / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (absVal >= 1e3) {
    return `${(num / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  }
  if (absVal < 0.1 && absVal > 0) {
    return num.toFixed(3);
  }
  return num.toFixed(1).replace(/\.0$/, '');
}

/**
 * Custom Floating HTML Tooltip Positioner and Toggle
 */
export const tooltip = {
  elementId: 'chart-tooltip',

  show(content, event) {
    const el = document.getElementById(this.elementId);
    if (!el) return;

    el.innerHTML = content;
    el.style.opacity = '1';
    this.move(event);
  },

  move(event) {
    const el = document.getElementById(this.elementId);
    if (!el || !event) return;

    const xOffset = 15;
    const yOffset = 15;
    const tooltipRect = el.getBoundingClientRect();
    
    let leftPos = event.pageX + xOffset;
    let topPos = event.pageY + yOffset;

    // Boundary check so tooltips don't clip off-screen
    if (leftPos + tooltipRect.width > window.innerWidth + window.scrollX) {
      leftPos = event.pageX - tooltipRect.width - xOffset;
    }
    if (topPos + tooltipRect.height > window.innerHeight + window.scrollY) {
      topPos = event.pageY - tooltipRect.height - yOffset;
    }

    el.style.left = `${leftPos}px`;
    el.style.top = `${topPos}px`;
  },

  hide() {
    const el = document.getElementById(this.elementId);
    if (!el) return;
    el.style.opacity = '0';
  }
};

/**
 * Normalizes startup funding stage names.
 * @param {string} s - The raw stage string
 * @returns {string|null} Remapped stage name or null
 */
export function normalizeStage(s) {
  if (!s) return null;
  const STAGE_ORDER = ['Seed', 'Series A', 'Series B', 'Series C', 'Series D+', 'Acquired', 'Private Equity', 'Post-IPO'];
  if (['Series D', 'Series E', 'Series F', 'Series G', 'Series H', 'Series I'].includes(s)) return 'Series D+';
  return STAGE_ORDER.includes(s) ? s : null;
}

/**
 * Calculates total electricity generation for a given energy row by summing all sources.
 * @param {Object} row - The CSV row containing energy source statistics
 * @returns {number} Sum of all energy generation sources
 */
export function calculateTotalGeneration(row) {
  return +row.Coal + +row.Gas + +row.Nuclear + +row.Hydro +
    +row.Solar + +row.Wind + +row.Oil + +row.Bioenergy + +(row['Other renewables'] || 0);
}

