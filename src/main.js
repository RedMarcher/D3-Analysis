import * as d3 from 'd3';
import { MetricCards } from './components/metric-cards.js';
import { LineChart } from './components/line-chart.js';
import { ScatterPlot } from './components/scatter-plot.js';
import { DonutChart } from './components/donut-chart.js';

/**
 * Main Controller: Loads data, sets up filter controls, orchestrates chart classes.
 */
document.addEventListener('DOMContentLoaded', () => {
  // Configured target elements
  const kpiSelectors = {
    overallTotal: 'kpi-card-1',
    peakValue: 'kpi-card-2',
    activeCount: 'kpi-card-3'
  };

  // State Management
  let originalData = null;
  let currentGroupFilter = 'ALL';
  let currentMaxYear = 2025;
  let currentYMetric = 'value';

  // Instantiate Reusable Charts
  const metrics = new MetricCards(kpiSelectors);

  const lineChart = new LineChart('#container-line-chart', {
    xKey: 'date',
    yKey: 'value',
    groupKey: 'series',
    xScaleType: 'time',
    yLabel: 'Agnostic Metric Level',
    colors: ['#00f2fe', '#4facfe', '#b100ff']
  });

  const scatterPlot = new ScatterPlot('#container-scatter-plot', {
    xKey: 'x',
    yKey: 'y',
    sizeKey: 'size',
    groupKey: 'group',
    labelKey: 'label',
    xLabel: 'Dimension X (Performance)',
    yLabel: 'Dimension Y (Efficiency)',
    colors: ['#00f2fe', '#b100ff', '#ffb700']
  });

  const donutChart = new DonutChart('#container-donut-chart', {
    categoryKey: 'label',
    valueKey: 'value',
    innerRadiusRatio: 0.65,
    colors: ['#00f2fe', '#4facfe', '#b100ff', '#ffb700', '#ff0844']
  });

  // Fetch Agnostic Dataset
  d3.json('/data/sample_dataset.json')
    .then(data => {
      originalData = data;

      // Initialize UI controls using data schemas
      populateGroupFilter(data.timeseries);
      initializeYearSlider(data.timeseries);
      setupEventListeners();

      // Trigger initial rendering
      filterAndRefresh();

      // Smoothly hide skeleton loading screens
      d3.selectAll('.skeleton-loader')
        .transition()
        .duration(800)
        .style('opacity', 0)
        .style('pointer-events', 'none')
        .on('end', function() {
          d3.select(this).style('display', 'none');
        });
    })
    .catch(err => {
      console.error('Error fetching dashboard dataset:', err);
      // Update loading status with error
      d3.selectAll('.skeleton-loader span')
        .text('Failed to load dataset. Please verify server.');
      d3.selectAll('.skeleton-spinner')
        .style('border-top-color', 'var(--accent-danger)')
        .style('animation-iteration-count', '1');
    });

  /**
   * Discovers group domains and appends them to selector dropdown.
   */
  function populateGroupFilter(timeseriesData) {
    const select = document.getElementById('select-group-filter');
    if (!select) return;

    // Read unique series names
    const groups = Array.from(new Set(timeseriesData.map(d => d.series)));
    
    // Clear dynamic options
    while (select.options.length > 1) {
      select.remove(1);
    }

    groups.sort().forEach(g => {
      const opt = document.createElement('option');
      opt.value = g;
      opt.textContent = g;
      select.appendChild(opt);
    });
  }

  /**
   * Identifies date ranges and maps bounds to slider controls.
   */
  function initializeYearSlider(timeseriesData) {
    const slider = document.getElementById('input-range-filter');
    const rangeVal = document.getElementById('slider-range-val');
    if (!slider || !timeseriesData.length) return;

    const years = timeseriesData.map(d => new Date(d.date).getFullYear());
    const minYear = d3.min(years);
    const maxYear = d3.max(years);

    slider.min = minYear;
    slider.max = maxYear;
    slider.value = maxYear;
    currentMaxYear = maxYear;

    if (rangeVal) {
      rangeVal.textContent = `${minYear} - ${maxYear}`;
    }
  }

  /**
   * Sets up interactive Event Listeners.
   */
  function setupEventListeners() {
    // Dropdown highlight
    d3.select('#select-group-filter').on('change', function() {
      currentGroupFilter = this.value;
      filterAndRefresh();
    });

    // Slider controls
    d3.select('#input-range-filter').on('input', function() {
      currentMaxYear = +this.value;
      const slider = document.getElementById('input-range-filter');
      const rangeVal = document.getElementById('slider-range-val');
      if (rangeVal && slider) {
        rangeVal.textContent = `${slider.min} - ${currentMaxYear}`;
      }
      filterAndRefresh();
    });

    // Y metric selection
    d3.select('#select-y-metric').on('change', function() {
      currentYMetric = this.value;
      lineChart.config.yKey = currentYMetric;
      filterAndRefresh();
    });

    // Reset button click
    d3.select('#btn-reset-filters').on('click', () => {
      const slider = document.getElementById('input-range-filter');
      const groupSelect = document.getElementById('select-group-filter');
      
      if (slider) {
        slider.value = slider.max;
        currentMaxYear = +slider.max;
        const rangeVal = document.getElementById('slider-range-val');
        if (rangeVal) {
          rangeVal.textContent = `${slider.min} - ${slider.max}`;
        }
      }

      if (groupSelect) {
        groupSelect.value = 'ALL';
        currentGroupFilter = 'ALL';
      }

      filterAndRefresh();
    });
  }

  /**
   * Filters the master datasets and refreshes metric counts and D3 components.
   */
  function filterAndRefresh() {
    if (!originalData) return;

    // --- 1. Filter Timeseries Data ---
    let filteredTimeseries = originalData.timeseries.filter(d => {
      const year = new Date(d.date).getFullYear();
      return year <= currentMaxYear;
    });

    if (currentGroupFilter !== 'ALL') {
      filteredTimeseries = filteredTimeseries.filter(d => d.series === currentGroupFilter);
    }

    // --- 2. Filter Scatter Plot Data ---
    // Agnostic mapping: Group highlights dim non-matching bubbles or filters them.
    // To show clean interactions, we will filter scatter nodes based on the group highlights.
    let filteredScatter = originalData.scatter;
    if (currentGroupFilter !== 'ALL') {
      // Map Cluster A to Alpha, Cluster B to Beta, Cluster C to Gamma for matching demonstrations
      const clusterMap = {
        'Alpha': 'Cluster A',
        'Beta': 'Cluster B',
        'Gamma': 'Cluster C'
      };
      const targetCluster = clusterMap[currentGroupFilter];
      if (targetCluster) {
        filteredScatter = originalData.scatter.filter(d => d.group === targetCluster);
      }
    }

    // --- 3. Compute Real-Time Metric summaries ---
    const totalTrendSum = d3.sum(filteredTimeseries, d => +d[currentYMetric]);
    const maxVal = d3.max(filteredTimeseries, d => +d[currentYMetric]) || 0;
    const activeSeriesCount = new Set(filteredTimeseries.map(d => d.series)).size;

    // Trend Direction relative to overall timeseries average
    const averageVal = d3.mean(filteredTimeseries, d => +d[currentYMetric]) || 0;
    const peakRatio = maxVal > 0 ? (totalTrendSum / (filteredTimeseries.length || 1)) / maxVal : 0.5;

    metrics.update({
      overallTotal: {
        label: 'Trend Cumulative',
        value: totalTrendSum,
        trend: `${((totalTrendSum / (originalData.timeseries.length || 1)) * 10).toFixed(1)}% Ratio`,
        trendDirection: 'up'
      },
      peakValue: {
        label: 'Peak Maximum',
        value: maxVal,
        trend: `${(peakRatio * 100).toFixed(0)}% Intensity`,
        trendDirection: peakRatio > 0.5 ? 'up' : 'down'
      },
      activeCount: {
        label: 'Monitored Groups',
        value: `${activeSeriesCount} / ${new Set(originalData.timeseries.map(d => d.series)).size}`,
        trend: currentGroupFilter === 'ALL' ? 'Showing All' : 'Filtered view',
        trendDirection: currentGroupFilter === 'ALL' ? 'neutral' : 'down'
      }
    });

    // --- 4. Render and Update D3 visualisations ---
    lineChart.update(filteredTimeseries);
    scatterPlot.update(filteredScatter);
    donutChart.update(originalData.categorical); // Keep ratios intact or filters if needed
  }
});
