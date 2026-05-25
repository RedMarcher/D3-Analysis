import * as d3 from 'd3';
import { MetricCards } from './components/metric-cards.js';
import { LineChart } from './components/line-chart.js';
import { DonutChart } from './components/donut-chart.js';
import { BarChart } from './components/bar-chart.js';
import { JobChart } from './components/job-chart.js';
import { USMap } from './components/us-map.js';

/**
 * Main Controller: Loads data, sets up filter controls, orchestrates slideshow states.
 */
document.addEventListener('DOMContentLoaded', () => {
  // State Management
  let activeSlide = 0;
  let geoJson = null;
  let slideData = null;

  // Visual Components
  let metrics = null;
  let usMap = null;
  let currentSupportingChart = null;

  // Persuasive Narratives & Takeaway Connotations
  const slideNarratives = [
    {
      lbl: "Case Study 1: Neutral Context",
      title: "The Massive Infrastructure Footprint",
      body: `
        <p>The U.S. data center footprint is expanding exponentially, driven by AI and cloud infrastructure demands. This first slide illustrates where the physical infrastructure is being built.</p>
        <ul class="narrative-bullets">
          <li><strong>Virginia, California, and Texas</strong> hold the highest operational densities in the world.</li>
          <li><strong>Planned additions</strong> show that growth is accelerated, with an estimated 39% capacity increase nationwide in active development.</li>
          <li><strong>Highly Concentrated:</strong> Virginia alone hosts over 450 active gigawatt-scale data centers, acting as the global hub.</li>
        </ul>
      `,
      takeawayTitle: "Conclusive Takeaway: The Illusion of Scale",
      takeawayText: "While the physical footprint is massive, this growth is highly localized. Corporations select sites based on tax breaks and low energy rates, forcing local economies to bear the structural burden of corporate computing expansion."
    },
    {
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
    },
    {
      lbl: "Case Study 3: Core Argument - Grid Burden",
      title: "Energy Demands & Carbon Subsidies",
      body: `
        <p>A single modern data center draws as much electricity as a medium-sized city, siphoning immense public energy grids and stalling clean transitions.</p>
        <ul class="narrative-bullets">
          <li><strong>Grid Strain:</strong> In Virginia, data centers consume a staggering 24.5% of total grid capacity, raising local residential utility rates.</li>
          <li><strong>Fossil Fuel Draw:</strong> Since over 58% of the U.S. power grid is fueled by natural gas (39%) and coal (19%), these facilities directly drive up high-carbon emissions.</li>
          <li><strong>Continuous Draw:</strong> Unlike residential loads, data centers demand continuous 24/7 baseload power, keeping dirty coal plants operational.</li>
        </ul>
      `,
      takeawayTitle: "Conclusive Takeaway: Environmental Subsidies",
      takeawayText: "Data centers consume enormous amounts of public utility grid capacity, delaying clean energy transitions. This constitutes an environmental tax on local residents to directly subsidize corporate compute power."
    },
    {
      lbl: "Case Study 4: Rebuttals - The Jobs Myth",
      title: "GDP Illusions & Job Skew",
      body: `
        <p>Proponents claim data centers create local GDP and rich jobs. In reality, the labor force is highly skewed towards low-wage and temporary construction roles.</p>
        <ul class="narrative-bullets">
          <li><strong>Temporary Boom:</strong> 80% of jobs are temporary construction roles that disappear after 12-18 months.</li>
          <li><strong>Low-Wage Custodial:</strong> 15% are permanent but low-paying security and groundkeeper jobs averaging $38,000/yr.</li>
          <li><strong>Technician Disparity:</strong> Only 5% are skilled technician roles, and their wages are 55% lower than software engineering positions ($65k vs $145k).</li>
        </ul>
      `,
      takeawayTitle: "Conclusive Takeaway: A Local Net Economic Drain",
      takeawayText: "Data centers contribute to corporate GDP but represent a net local drain. They create few permanent, high-paying jobs, consume vast public resources, and do not enrich local labor workforces, debunking the economic benefit myth."
    }
  ];

  // Initialize Metric Card elements
  metrics = new MetricCards({
    overallTotal: 'kpi-card-1',
    peakValue: 'kpi-card-2',
    activeCount: 'kpi-card-3'
  });

  // Parallel Fetching GeoJSON & Slideshow Dataset
  Promise.all([
    d3.json('/data/us-states.json'),
    d3.json('/data/datacenters_slideshow.json')
  ])
    .then(([geojsonRes, slideDataRes]) => {
      geoJson = geojsonRes;
      slideData = slideDataRes;

      // Instantiate core U.S. Map
      usMap = new USMap('#container-us-map', geoJson);

      // Setup slideshow event listeners
      setupNavigationListeners();

      // Trigger initial slide rendering
      renderSlide();

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
      console.error('Error fetching slideshow datasets:', err);
      d3.selectAll('.skeleton-loader span')
        .text('Failed to load dataset. Please verify network or static files.');
      d3.selectAll('.skeleton-spinner')
        .style('border-top-color', 'var(--accent-danger)')
        .style('animation-iteration-count', '1');
    });

  /**
   * Configures Next, Back, Dot Clicks, and Keyboard Navigation.
   */
  function setupNavigationListeners() {
    // Prev button click
    d3.select('#btn-slide-prev').on('click', () => {
      navigateSlide(-1);
    });

    // Next button click
    d3.select('#btn-slide-next').on('click', () => {
      navigateSlide(1);
    });

    // Dot indicators clicks
    d3.selectAll('.slide-dot').on('click', function() {
      const targetIdx = +d3.select(this).attr('data-index');
      if (targetIdx !== activeSlide) {
        transitionSlide(() => {
          activeSlide = targetIdx;
          renderSlide();
        });
      }
    });

    // Keyboard Arrow Keys support presentation mode
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') {
        navigateSlide(-1);
      } else if (e.key === 'ArrowRight') {
        navigateSlide(1);
      }
    });
  }

  /**
   * Slide Navigation State Incrementor
   */
  function navigateSlide(direction) {
    const nextIdx = activeSlide + direction;
    if (nextIdx >= 0 && nextIdx < slideNarratives.length) {
      transitionSlide(() => {
        activeSlide = nextIdx;
        renderSlide();
      });
    }
  }

  /**
   * Helper utilizing Web View Transitions API for stunning micro-animations
   */
  function transitionSlide(updateFn) {
    if (document.startViewTransition) {
      document.startViewTransition(updateFn);
    } else {
      updateFn();
    }
  }

  /**
   * Coordinates and triggers all panel rendering for the active slide.
   */
  function renderSlide() {
    const slide = slideNarratives[activeSlide];

    // --- 1. Update Navigation Controls ---
    document.getElementById('btn-slide-prev').disabled = activeSlide === 0;
    document.getElementById('btn-slide-next').disabled = activeSlide === slideNarratives.length - 1;

    // Update progress markers
    document.getElementById('slide-progress-text').textContent = `Slide ${activeSlide + 1} of ${slideNarratives.length}`;

    // Update active dot indicator
    d3.selectAll('.slide-dot')
      .classed('active', function() {
        return +d3.select(this).attr('data-index') === activeSlide;
      });

    // --- 2. Update Left Narrative Panels ---
    document.getElementById('narrative-slide-lbl').textContent = slide.lbl;
    document.getElementById('narrative-slide-title').textContent = slide.title;
    document.getElementById('narrative-slide-body').innerHTML = slide.body;
    document.getElementById('narrative-takeaway-title').textContent = slide.takeawayTitle;
    document.getElementById('narrative-takeaway-text').textContent = slide.takeawayText;

    // --- 3. Update KPI Card Metrics ---
    updateKPIs();

    // --- 4. Update U.S. Map Visualization Mode ---
    updateUSMapMode();

    // --- 5. Update Supporting Context D3 Chart ---
    updateSupportingChart();
  }

  /**
   * Dynamic Metric values update based on active slide content.
   */
  function updateKPIs() {
    if (activeSlide === 0) {
      metrics.update({
        overallTotal: { label: "Nationwide Active", value: 2850, trend: "+39% Planned", trendDirection: "up" },
        peakValue: { label: "Est. Total Load", value: 18500, trend: "Megawatt draw", trendDirection: "up" },
        activeCount: { label: "Virginia Power Draw", value: 3500, trend: "Highest Global Hub", trendDirection: "up" }
      });
    } else if (activeSlide === 1) {
      metrics.update({
        overallTotal: { label: "Workers Laid Off", value: 462000, trend: "Tech cuts since 2019", trendDirection: "down" },
        peakValue: { label: "Cumulative Capacity", value: 22.0, trend: "Surging to 22 GW", trendDirection: "up" },
        activeCount: { label: "Labor Protection", value: 0, trend: "No active safeguards", trendDirection: "down" }
      });
    } else if (activeSlide === 2) {
      metrics.update({
        overallTotal: { label: "Virginia Grid Share", value: 24.5, trend: "Straining local grids", trendDirection: "down" },
        peakValue: { label: "Fossil Fuel Power", value: 58.0, trend: "39% Gas, 19% Coal", trendDirection: "neutral" },
        activeCount: { label: "24/7 Baseload", value: 100, trend: "Continuous dirty draw", trendDirection: "down" }
      });
    } else {
      metrics.update({
        overallTotal: { label: "Temporary Work", value: 80.0, trend: "Vanish in 18 months", trendDirection: "down" },
        peakValue: { label: "Technician Jobs", value: 5.0, trend: "Only 75 per $1B spent", trendDirection: "down" },
        activeCount: { label: "Wage Disparity", value: 55.0, trend: "Lower than software eng.", trendDirection: "down" }
      });
    }
  }

  /**
   * Refreshes U.S. Map presentation metrics.
   */
  function updateUSMapMode() {
    const mapTitles = [
      "U.S. Data Center Hubs & Planned Growth",
      "Cumulative Tech Industry Layoffs (2019 - Present)",
      "Data Center Draw Share of State Grid Capacity",
      "Key Tech Hubs Under Assessment"
    ];

    document.getElementById('us-map-title').textContent = mapTitles[activeSlide];
    
    // Pass appropriate modes (Mode 1 for Slide 1, Mode 2 for Slide 2, Mode 3 for Slide 3/4)
    const mapMode = activeSlide === 0 ? 1 : (activeSlide === 1 ? 2 : 3);
    usMap.update(slideData.stateData, mapMode);
  }

  /**
   * Swaps and completely builds the active Supporting visualization panel.
   */
  function updateSupportingChart() {
    const chartTitles = [
      "Nationwide Active vs Planned Capacity Share",
      "Tech Layoffs Spike vs Cumulative Compute Growth",
      "U.S. Electricity Production Energy Sources",
      "Workforce Quality Breakdown & Wage Disparity"
    ];

    document.getElementById('supporting-chart-title').textContent = chartTitles[activeSlide];

    // Clear previous charts & legends
    const chartContainerSelector = '#container-supporting-chart';
    const legendContainer = document.getElementById('legend-supporting-chart');
    if (legendContainer) legendContainer.innerHTML = '';
    
    // Destroy previous chart reference
    currentSupportingChart = null;

    // Reset container height to standard CSS height for SVG charts
    d3.select(chartContainerSelector).style('height', null);

    if (activeSlide === 0) {
      // Donut Chart - Capacity Breakdown
      currentSupportingChart = new DonutChart(chartContainerSelector, {
        categoryKey: 'label',
        valueKey: 'value',
        innerRadiusRatio: 0.62,
        colors: ['var(--accent-primary)', 'var(--accent-secondary)']
      });
      currentSupportingChart.update([
        { label: 'Active Nationwide', value: 2850 },
        { label: 'Planned Nationwide', value: 1120 }
      ]);
    } else if (activeSlide === 1) {
      // Line Chart - Tech Layoffs vs GW capacity (Dual Y-Axis)
      currentSupportingChart = new LineChart(chartContainerSelector, {
        xKey: 'date',
        yKey: 'layoffs',
        xScaleType: 'time',
        isDualAxis: true
      });
      currentSupportingChart.update(slideData.layoffTimeseries);
    } else if (activeSlide === 2) {
      // Bar Chart - Electricity Sources Share
      currentSupportingChart = new BarChart(chartContainerSelector, {
        xKey: 'percentage',
        yKey: 'source',
        colors: ['#4facfe', '#6b7280', '#b100ff', '#05ffc8', '#ffb700', '#ff0844', '#f3f4f6']
      });
      currentSupportingChart.update(slideData.powerGridData.energySources);
    } else {
      // Set container height to auto for the HTML infographic to let it expand naturally
      d3.select(chartContainerSelector).style('height', 'auto');
      // Custom HTML Job Breakdown Infographic
      currentSupportingChart = new JobChart(chartContainerSelector);
      currentSupportingChart.update(slideData.jobsBreakdown);
    }
  }
});
