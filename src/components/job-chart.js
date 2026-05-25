export class JobChart {
  /**
   * Constructs the Job Breakdown chart.
   * @param {string} selector - Container selector
   */
  constructor(selector) {
    this.container = document.querySelector(selector);
    if (!this.container) throw new Error(`Job Container ${selector} not found`);

    this.data = null;
    this.activeIdx = 0; // Default active category for detail highlighted
  }

  /**
   * Updates component data and triggers rendering.
   * @param {Array} rawData - Jobs breakdown data array
   */
  update(rawData) {
    if (!rawData || rawData.length === 0) return;
    this.data = rawData;
    this.draw();
  }

  /**
   * Renders the interactive infographic layout.
   */
  draw() {
    if (!this.data) return;

    // Build overall layout
    this.container.innerHTML = '';

    const totalJobs = this.data.reduce((acc, d) => acc + d.count, 0);

    const mainWrapper = document.createElement('div');
    mainWrapper.className = 'job-chart-container';

    // 1. Stacked Bar Section
    const barWrapper = document.createElement('div');
    barWrapper.className = 'job-bar-wrapper';

    const barMeta = document.createElement('div');
    barMeta.className = 'job-bar-meta';
    barMeta.innerHTML = `
      <span>Workforce Composition per $1B Project</span>
      <span style="color: var(--accent-danger); font-weight:700;">${totalJobs.toLocaleString()} Total Jobs</span>
    `;
    barWrapper.appendChild(barMeta);

    const barStack = document.createElement('div');
    barStack.className = 'job-bar-stack';

    // Segment colors matched to theme
    const colors = {
      'temporary': 'var(--accent-warning)',
      'lowwage': 'var(--accent-danger)',
      'skilled': 'var(--accent-primary)'
    };

    this.data.forEach((d, idx) => {
      const segment = document.createElement('div');
      segment.className = 'job-bar-segment';
      segment.style.width = `${d.percentage}%`;
      segment.style.backgroundColor = colors[d.type];
      segment.textContent = `${d.percentage}%`;
      segment.title = `${d.category}: ${d.count} jobs (${d.percentage}%)`;

      segment.addEventListener('click', () => {
        this.activeIdx = idx;
        this.draw();
      });

      barStack.appendChild(segment);
    });

    barWrapper.appendChild(barStack);
    mainWrapper.appendChild(barWrapper);

    // 2. Detail Cards Section
    const cardsGrid = document.createElement('div');
    cardsGrid.className = 'job-details-grid';

    const activeItem = this.data[this.activeIdx];

    this.data.forEach((d, idx) => {
      const card = document.createElement('div');
      card.className = `job-details-card ${idx === this.activeIdx ? 'active' : ''}`;
      card.style.borderTop = `3px solid ${colors[d.type]}`;

      card.innerHTML = `
        <span class="job-card-label">${d.category}</span>
        <span class="job-card-val">${d.count} Jobs</span>
        <span class="job-card-sub">${d.percentage}% of total</span>
      `;

      card.addEventListener('click', () => {
        this.activeIdx = idx;
        this.draw();
      });

      cardsGrid.appendChild(card);
    });

    mainWrapper.appendChild(cardsGrid);

    // 3. Highlighted Connotation Box
    const comparisonBox = document.createElement('div');
    comparisonBox.className = 'wage-comparison-box';
    
    let activeNotice = "";
    if (activeItem.type === 'temporary') {
      activeNotice = "<strong>80% of jobs are temporary construction roles</strong>. Once the facility is completed (usually in 12-18 months), these jobs disappear, leaving zero long-term economic footprint in the local labor market.";
    } else if (activeItem.type === 'lowwage') {
      activeNotice = "<strong>15% are low-wage security & custodial roles</strong>. These roles are permanent but offer very low salaries (avg. $38k/yr) and zero upward mobility, failing to enrich local communities.";
    } else {
      activeNotice = "<strong>Only 5% are skilled hardware technicians</strong>. A massive $1B data center creates a mere 75 permanent technical roles, showing that data center growth does not translate into a booming local tech hub.";
    }

    comparisonBox.innerHTML = `
      <div style="font-size:0.85rem; color:var(--text-primary); margin-bottom:0.75rem; text-align:left;">
        ${activeNotice}
      </div>
      <div class="wage-row" style="border-top: 1px solid rgba(255,255,255,0.06); padding-top:0.75rem; margin-top:0.25rem;">
        <span style="color:var(--text-secondary);">Avg. Data Center Tech Wage:</span>
        <strong style="color:var(--accent-danger);">$65,000 / yr</strong>
      </div>
      <div class="wage-row">
        <span style="color:var(--text-secondary);">Avg. Tech Software Engineer Wage:</span>
        <strong style="color:var(--accent-success);">$145,000 / yr</strong>
      </div>
      <div style="font-size:0.7rem; color:var(--accent-danger); margin-top:0.4rem; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">
        ⚠️ Local Tech Wages are 55% Lower than actual software engineering jobs
      </div>
    `;

    mainWrapper.appendChild(comparisonBox);
    this.container.appendChild(mainWrapper);
  }
}
