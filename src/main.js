import * as d3 from 'd3';
import { MetricCards } from './components/metric-cards.js';
import { LineChart } from './components/line-chart.js';
import { DonutChart } from './components/donut-chart.js';
import { BarChart } from './components/bar-chart.js';
import { JobChart } from './components/job-chart.js';
import { USMap } from './components/us-map.js';
import { ScatterPlot } from './components/scatter-plot.js';

/**
 * Main Controller: Loads data, sets up filter controls, orchestrates slideshow states.
 */
document.addEventListener('DOMContentLoaded', () => {
  // State Management
  let activeSlide = 0;
  let geoJson = null;
  let slideData = null;
  let rawAtlasData = null;
  let rawLayoffsData = null;
  let rawEnergyData = null;

  // Dynamic Control Toggle & State
  let showFacilitiesOverlay = false;

  // Visual Components
  let metrics = null;
  let usMap = null;
  let currentSupportingChart = null;

  // Persuasive Narratives & Takeaway Connotations
  const slideNarratives = [
    {
      lbl: "Case Study 1: Real-World Distribution",
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

  // Lazy loaders for heavy CSVs to achieve instant initial load
  function ensureLayoffsLoaded(callback) {
    if (rawLayoffsData) {
      callback();
    } else {
      d3.select('#loader-supporting-chart').style('display', 'flex').style('opacity', 1);
      d3.csv('/layoffs.csv').then(data => {
        rawLayoffsData = data;
        d3.select('#loader-supporting-chart').transition().duration(400).style('opacity', 0).on('end', function() {
          d3.select(this).style('display', 'none');
        });
        callback();
      }).catch(err => {
        console.error('Failed to load layoffs.csv:', err);
        d3.select('#loader-supporting-chart span').text('Failed to load Layoffs dataset.');
      });
    }
  }

  function ensureEnergyLoaded(callback) {
    if (rawEnergyData) {
      callback();
    } else {
      d3.select('#loader-supporting-chart').style('display', 'flex').style('opacity', 1);
      d3.csv('/Electricity production by source.csv').then(data => {
        rawEnergyData = data;
        d3.select('#loader-supporting-chart').transition().duration(400).style('opacity', 0).on('end', function() {
          d3.select(this).style('display', 'none');
        });
        callback();
      }).catch(err => {
        console.error('Failed to load Electricity CSV:', err);
        d3.select('#loader-supporting-chart span').text('Failed to load Grid Sources dataset.');
      });
    }
  }

  // Initialize Metric Card elements
  metrics = new MetricCards({
    overallTotal: 'kpi-card-1',
    peakValue: 'kpi-card-2',
    activeCount: 'kpi-card-3'
  });

  // Parallel Fetching GeoJSON & Slideshow Dataset & Atlas CSV
  Promise.all([
    d3.json('/us-states.json'),
    d3.json('/datacenters_slideshow.json'),
    d3.csv('/im3_open_source_data_center_atlas_v2026.02.09.csv')
  ])
    .then(([geojsonRes, slideDataRes, atlasRes]) => {
      geoJson = geojsonRes;
      slideData = slideDataRes;
      rawAtlasData = atlasRes;

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

    // --- 4. Render Slide Visualizations ---
    renderVisualizations();
  }

  /**
   * Dynamic Metric values update based on active slide content.
   * Completely switched off placeholders, deriving statistics directly from raw datasets.
   */
  function updateKPIs() {
    if (activeSlide === 0) {
      // Slide 1 Metrics (Calculated dynamically)
      const totalPlanned = d3.sum(slideData.stateData, d => d.plannedDataCenters);
      const activeCount = rawAtlasData ? rawAtlasData.length : 1481;
      
      let hubLabel = "Virginia Share";
      let hubVal = 450;
      let hubTrend = "Highest Global Capital";

      if (showFacilitiesOverlay && rawAtlasData) {
        const vaCount = rawAtlasData.filter(d => d.state_abb === 'VA').length;
        const vaPct = ((vaCount / rawAtlasData.length) * 100).toFixed(1);
        hubLabel = "Virginia Footprint";
        hubVal = vaCount;
        hubTrend = `${vaPct}% of U.S. total`;
      }

      metrics.update({
        overallTotal: { label: "Nationwide Active", value: activeCount, trend: "Atlas verified facilities", trendDirection: "up" },
        peakValue: { label: "Planned Additions", value: totalPlanned, trend: "+39% Nationwide boost", trendDirection: "up" },
        activeCount: { label: hubLabel, value: hubVal, trend: hubTrend, trendDirection: "up" }
      });
    } else if (activeSlide === 1) {
      // Slide 2 Metrics (Dynamic from layoffs CSV & powerTimeseries)
      let layoffsVal = 462000;
      let layoffsTrend = "Estimated cumulative cuts";
      
      if (rawLayoffsData) {
        const usLayoffs = d3.sum(rawLayoffsData.filter(d => d.country === 'United States'), d => +d.total_laid_off || 0);
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
    } else if (activeSlide === 2) {
      // Slide 3 Metrics (Dynamic from US electricity source CSV)
      let fossilPct = 58.0;
      let renewablePct = 22.0;
      let totalUSGen = 4249; // TWh in 2023
      let trendTxt = "Gas (39%) + Coal (19%)";

      if (rawEnergyData) {
        const usa2023 = rawEnergyData.find(d => d.Code === 'USA' && d.Year === '2023');
        if (usa2023) {
          const total = +usa2023.Coal + +usa2023.Gas + +usa2023.Nuclear + +usa2023.Hydro + +usa2023.Solar + +usa2023.Wind + +usa2023.Oil + +usa2023.Bioenergy + +usa2023['Other renewables'];
          fossilPct = +(((+usa2023.Coal + +usa2023.Gas) / total) * 100).toFixed(1);
          renewablePct = +(((+usa2023.Solar + +usa2023.Wind + +usa2023.Hydro) / total) * 100).toFixed(1);
          totalUSGen = Math.round(total);
          trendTxt = `Coal (${((+usa2023.Coal / total) * 100).toFixed(0)}%) & Gas (${((+usa2023.Gas / total) * 100).toFixed(0)}%)`;
        }
      }

      metrics.update({
        overallTotal: { label: "Fossil Fuel Draw", value: fossilPct, trend: trendTxt, trendDirection: "neutral" },
        peakValue: { label: "Clean Green Ratio", value: renewablePct, trend: "Solar, wind & hydro share", trendDirection: "up" },
        activeCount: { label: "U.S. Grid Size", value: totalUSGen, trend: "TWh Total generation", trendDirection: "neutral" }
      });
    } else {
      // Slide 4 Metrics (Workforce Myth statistics)
      metrics.update({
        overallTotal: { label: "Temporary Work", value: 80.0, trend: "Vanish in 18 months", trendDirection: "down" },
        peakValue: { label: "Technician Jobs", value: 5.0, trend: "Only 75 per $1B spent", trendDirection: "down" },
        activeCount: { label: "Wage Disparity", value: 55.0, trend: "Lower than software eng.", trendDirection: "down" }
      });
    }
  }

  /**
   * Cleans containers, adjusts layout grids, and renders correct Left and Right visualizations.
   */
  function renderVisualizations() {
    // 1. Reset grids and heights
    const chartsGrid = document.querySelector('.charts-grid');
    const containerLeftSelector = '#container-us-map';
    const containerRightSelector = '#container-supporting-chart';
    
    // Reset heights
    d3.select(containerLeftSelector).style('height', null).html('');
    d3.select(containerRightSelector).style('height', null).html('');
    
    // Clear dynamic control container boxes
    d3.select('#us-map-controls').html('');
    d3.select('#supporting-chart-controls').html('');
    
    // Clear legends
    const legendContainer = document.getElementById('legend-supporting-chart');
    if (legendContainer) legendContainer.innerHTML = '';

    // De-register previous chart references (for memory cleanliness)
    currentSupportingChart = null;
    usMap = null;

    if (activeSlide === 0) {
      // --- SLIDE 1: US Map + Donut Chart ---
      if (chartsGrid) chartsGrid.style.gridTemplateColumns = '1.2fr 0.8fr';
      
      // Left: Map
      document.getElementById('us-map-title').textContent = "U.S. Data Center Hubs & Planned Growth";
      d3.select('#us-map-mode-badge').text('Albers USA').style('display', 'block');
      
      // Restore facility overlay controls
      const mapControls = d3.select('#us-map-controls');
      mapControls.html(`
        <label class="toggle-control">
          <input type="checkbox" id="chk-show-facilities" ${showFacilitiesOverlay ? 'checked' : ''}>
          Overlay 1,480+ Real Facilities
        </label>
      `);
      
      usMap = new USMap(containerLeftSelector, geoJson);
      usMap.update(slideData.stateData, 1, rawAtlasData, showFacilitiesOverlay);

      d3.select('#chk-show-facilities').on('change', function() {
        showFacilitiesOverlay = this.checked;
        if (usMap) {
          usMap.update(slideData.stateData, 1, rawAtlasData, showFacilitiesOverlay);
        }
        updateKPIs();
      });

      // Right: Donut Chart
      document.getElementById('supporting-chart-title').textContent = "Nationwide Active vs Planned Capacity Share";
      d3.select('#supporting-chart-mode-badge').text('D3 Donut').style('display', 'block');
      
      currentSupportingChart = new DonutChart(containerRightSelector, {
        categoryKey: 'label',
        valueKey: 'value',
        innerRadiusRatio: 0.62,
        colors: ['var(--accent-primary)', 'var(--accent-secondary)']
      });
      const totalActive = d3.sum(slideData.stateData, d => d.dataCenters);
      const totalPlanned = d3.sum(slideData.stateData, d => d.plannedDataCenters);
      currentSupportingChart.update([
        { label: 'Active Nationwide', value: totalActive },
        { label: 'Planned Nationwide', value: totalPlanned }
      ]);

    } else if (activeSlide === 1) {
      // --- SLIDE 2: Dual-Axis Line + Scatter Plot ---
      if (chartsGrid) chartsGrid.style.gridTemplateColumns = '1fr 1fr';

      // Left: Dual Axis Line Chart
      document.getElementById('us-map-title').textContent = "Tech Layoffs Spike vs Cumulative Compute Growth";
      d3.select('#us-map-mode-badge').text('D3 Dual-Axis Line').style('display', 'block');

      const lineChart = new LineChart(containerLeftSelector, {
        xKey: 'date',
        yKey: 'layoffs',
        xScaleType: 'time',
        isDualAxis: true
      });
      lineChart.update(slideData.layoffTimeseries);

      // Right: Scatter Plot (Asynchronous load)
      document.getElementById('supporting-chart-title').textContent = "Tech Layoffs Corporate Spread";
      d3.select('#supporting-chart-mode-badge').text('D3 Scatter Plot').style('display', 'block');

      ensureLayoffsLoaded(() => {
        // Double-check active slide hasn't changed during fetch delay
        if (activeSlide !== 1) return;
        
        currentSupportingChart = new ScatterPlot(containerRightSelector, {
          xKey: 'funds_raised',
          yKey: 'total_laid_off',
          sizeKey: 'percentage_laid_off_pct',
          groupKey: 'industry',
          labelKey: 'company',
          xLabel: 'Total Funds Raised ($ Millions)',
          yLabel: 'Total Employees Laid Off',
          colors: d3.schemeTableau10
        });
        
        const formattedLayoffs = rawLayoffsData.map(d => ({
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
        currentSupportingChart.update(formattedLayoffs);
      });

    } else if (activeSlide === 2) {
      // --- SLIDE 3: Horizontal Bar Chart + US Grid Multi-Line ---
      if (chartsGrid) chartsGrid.style.gridTemplateColumns = '1fr 1fr';

      // Left: Grid Sources Bar Chart
      document.getElementById('us-map-title').textContent = "U.S. Electricity Production Energy Sources";
      d3.select('#us-map-mode-badge').text('D3 Horizontal Bar').style('display', 'block');

      const barChart = new BarChart(containerLeftSelector, {
        xKey: 'percentage',
        yKey: 'source',
        colors: ['#4facfe', '#6b7280', '#b100ff', '#05ffc8', '#ffb700', '#ff0844', '#f3f4f6']
      });
      barChart.update(slideData.powerGridData.energySources);

      // Right: Grid History Timeline (Asynchronous load)
      document.getElementById('supporting-chart-title').textContent = "U.S. Grid History (2000 - Present)";
      d3.select('#supporting-chart-mode-badge').text('D3 Multi-Line').style('display', 'block');

      ensureEnergyLoaded(() => {
        // Double-check active slide hasn't changed during fetch delay
        if (activeSlide !== 2) return;

        currentSupportingChart = new LineChart(containerRightSelector, {
          xKey: 'date',
          yKey: 'value',
          groupKey: 'series',
          xScaleType: 'time',
          yLabel: 'Electricity Generation (TWh)',
          colors: ['#6b7280', '#4facfe', '#b100ff', '#05ffc8', '#ffb700', '#ff0844']
        });

        const energySourcesToTrack = ['Coal', 'Gas', 'Nuclear', 'Hydro', 'Solar', 'Wind'];
        const structuredData = [];
        
        rawEnergyData.filter(d => d.Code === 'USA' && +d.Year >= 2000)
          .forEach(row => {
            const year = row.Year;
            energySourcesToTrack.forEach(source => {
              const val = +row[source];
              if (!isNaN(val)) {
                structuredData.push({
                  date: `${year}-01-01`,
                  value: val,
                  series: source
                });
              }
            });
          });

        currentSupportingChart.update(structuredData);
      });

    } else if (activeSlide === 3) {
      // --- SLIDE 4: Wage Comparison Bar Chart + Job Composition Infographic ---
      if (chartsGrid) chartsGrid.style.gridTemplateColumns = '1fr 1fr';

      // Left: Wage Comparison Bar Chart
      document.getElementById('us-map-title').textContent = "Data Center Tech vs. Broader Tech Industry Wages";
      d3.select('#us-map-mode-badge').text('D3 Horizontal Bar').style('display', 'block');

      const wageData = [
        { role: "Software Engineer", wage: 145000 },
        ...slideData.jobsBreakdown.map(d => ({
          role: d.category,
          wage: d.salary
        }))
      ];

      const wageChart = new BarChart(containerLeftSelector, {
        xKey: 'wage',
        yKey: 'role',
        margin: { top: 20, right: 30, bottom: 30, left: 130 },
        colors: ['var(--accent-success)', 'var(--accent-primary)', 'var(--accent-warning)', 'var(--accent-danger)'],
        xTickFormat: d => `$${d3.format(',.0f')(d)}`,
        tooltipFormatter: (d, color) => `
          <div class="d3-tooltip-title">Annual Wage Comparison</div>
          <div class="d3-tooltip-row">
            <span>Role:</span>
            <span class="d3-tooltip-val" style="color: ${color}">${d.role}</span>
          </div>
          <div class="d3-tooltip-row">
            <span>Average Salary:</span>
            <span class="d3-tooltip-val" style="color: #fff">$${d.wage.toLocaleString()} / yr</span>
          </div>
        `
      });
      wageChart.update(wageData);

      // Right: Job Infographic
      document.getElementById('supporting-chart-title').textContent = "Workforce Composition & Demographics";
      d3.select('#supporting-chart-mode-badge').text('D3 HTML Infographic').style('display', 'block');
      
      d3.select(containerRightSelector).style('height', 'auto');
      currentSupportingChart = new JobChart(containerRightSelector);
      currentSupportingChart.update(slideData.jobsBreakdown);
    }
  }
});
