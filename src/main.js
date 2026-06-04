import * as d3 from 'd3';
import { MetricCards } from './components/metric-cards.js';
import { animateNarrative } from './utils/animate-narrative.js';
import * as slide1 from './slides/slide1.js';
import * as slide2 from './slides/slide2.js';
import * as slide3 from './slides/slide3.js';
import * as slide4 from './slides/slide4.js';

const slides = [slide1, slide2, slide3, slide4];

document.addEventListener('DOMContentLoaded', () => {
  let activeSlide = 0;
  let showFacilitiesOverlay = false;

  const metrics = new MetricCards({
    overallTotal: 'kpi-card-1',
    peakValue: 'kpi-card-2',
    activeCount: 'kpi-card-3'
  });

  // Load all datasets upfront
  Promise.all([
    d3.json('/us-states.json'),
    d3.json('/datacenters_slideshow.json'),
    d3.csv('/im3_open_source_data_center_atlas_v2026.02.09.csv'),
    d3.csv('/layoffs.csv'),
    d3.csv('/Electricity production by source.csv'),
    d3.json('/aterio_states.json'),
    d3.json('/aterio_yearly_mw.json'),
    d3.json('/bls_wages.json')
  ])
    .then(([geoJson, slideData, atlasData, layoffsData, energyData, aterioStates, aterioYearlyMW, blsWages]) => {
      const data = { geoJson, slideData, atlasData, layoffsData, energyData, aterioStates, aterioYearlyMW, blsWages };

      setupNavigation();
      renderSlide(data);

      d3.selectAll('.skeleton-loader')
        .transition()
        .duration(800)
        .style('opacity', 0)
        .style('pointer-events', 'none')
        .on('end', function() { d3.select(this).style('display', 'none'); });

      function setupNavigation() {
        d3.select('#btn-slide-prev').on('click', () => navigate(-1));
        d3.select('#btn-slide-next').on('click', () => navigate(1));

        d3.selectAll('.slide-dot').on('click', function() {
          const idx = +d3.select(this).attr('data-index');
          if (idx !== activeSlide) transition(() => { activeSlide = idx; renderSlide(data); });
        });

        document.addEventListener('keydown', e => {
          if (e.key === 'ArrowLeft') navigate(-1);
          else if (e.key === 'ArrowRight') navigate(1);
        });
      }

      function navigate(direction) {
        const next = activeSlide + direction;
        if (next >= 0 && next < slides.length) {
          transition(() => { activeSlide = next; renderSlide(data); });
        }
      }
    })
    .catch(err => {
      console.error('Failed to load datasets:', err);
      d3.selectAll('.skeleton-loader span').text('Failed to load dataset. Please verify network or static files.');
      d3.selectAll('.skeleton-spinner')
        .style('border-top-color', 'var(--accent-danger)')
        .style('animation-iteration-count', '1');
    });

  function renderSlide(data) {
    slides.forEach(s => s.cleanup?.());
    const slide = slides[activeSlide];

    // Navigation state
    document.getElementById('btn-slide-prev').disabled = activeSlide === 0;
    document.getElementById('btn-slide-next').disabled = activeSlide === slides.length - 1;
    document.getElementById('slide-progress-text').textContent = `Slide ${activeSlide + 1} of ${slides.length}`;

    d3.selectAll('.slide-dot').classed('active', function() {
      return +d3.select(this).attr('data-index') === activeSlide;
    });

    // Narrative panel
    document.getElementById('narrative-slide-lbl').textContent = slide.narrative.lbl;
    document.getElementById('narrative-slide-title').textContent = slide.narrative.title;
    document.getElementById('narrative-slide-body').innerHTML = slide.narrative.body;
    animateNarrative(document.getElementById('narrative-slide-body'));
    document.getElementById('narrative-takeaway-title').textContent = slide.narrative.takeawayTitle;
    document.getElementById('narrative-takeaway-text').textContent = slide.narrative.takeawayText;

    // KPIs
    slide.updateKPIs(metrics, { ...data, showFacilitiesOverlay });

    // Set dynamic layout class for non-repetitive layout
    const mainPanel = document.querySelector('.main-presentation-panel');
    if (mainPanel) {
      mainPanel.className = `main-presentation-panel slide-${activeSlide + 1}-mode`;
    }

    // Reset chart containers
    d3.select('#container-us-map').html('');
    d3.select('#container-supporting-chart').html('');
    d3.select('#us-map-controls').html('');
    d3.select('#supporting-chart-controls').html('');
    const legendContainer = document.getElementById('legend-supporting-chart');
    if (legendContainer) legendContainer.innerHTML = '';

    // Render slide visuals
    slide.render({
      containerLeft: '#container-us-map',
      containerRight: '#container-supporting-chart',
      ...data,
      showFacilitiesOverlay,
      onOverlayToggle: (checked, usMap) => {
        showFacilitiesOverlay = checked;
        usMap.update(data.aterioStates, 1, data.atlasData, showFacilitiesOverlay);
        slide.updateKPIs(metrics, { ...data, showFacilitiesOverlay });
      }
    });
  }

  function transition(updateFn) {
    if (document.startViewTransition) {
      document.startViewTransition(updateFn);
    } else {
      updateFn();
    }
  }
});
