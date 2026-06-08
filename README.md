# Do You Want a Data Center Near You?

An interactive data visualization slideshow exploring the footprint, energy impact, labor effects, and trade-offs of U.S. data center expansion. Built with **D3.js v7**, **Vite**, and **ES Modules**.

---

## 📂 Directory Structure

```text
D3-Analysis/
├── index.html                    # Master HTML skeleton layout & slide containers
├── package.json                  # Project requirements (Vite, D3.js) & launch scripts
├── vite.config.js                # Dev server configuration
├── README.md                     # Documentation
├── public/                       # Static datasets (automatically served by Vite)
│   ├── us-states.json            # GeoJSON for US state boundaries
│   ├── datacenters_slideshow.json
│   ├── aterio_states.json        # Per-state active/pipeline facility counts (Aterio)
│   ├── aterio_yearly_mw.json     # Yearly MW demand data (Aterio)
│   ├── bls_wages.json            # Workforce & wage data (Bureau of Labor Statistics)
│   ├── layoffs.csv               # Tech layoff events 2020–2024 (Kaggle)
│   ├── Electricity production by source.csv  # Annual energy mix (Our World in Data)
│   └── im3_open_source_data_center_atlas_v2026.02.09.csv  # Facility GPS coords (MSD)
└── src/
    ├── main.js                   # App entry: data loading, slide navigation, state management
    ├── slides/                   # One module per slideshow slide
    │   ├── slide1.js             # Location & Density (US Map)
    │   ├── slide2.js             # Energy Demand & Layoffs (Line + Scatter)
    │   ├── slide3.js             # Energy & Environmental Impact (Line + Stream)
    │   └── slide4.js             # Job Creation & Rebuttal (Job Chart + Bar)
    ├── components/               # Reusable D3 chart modules
    │   ├── metric-cards.js       # Animated KPI count-up cards
    │   ├── us-map.js             # Choropleth + bubble overlay map with smooth zoom
    │   ├── line-chart.js         # Multi-series line & area chart
    │   ├── scatter-plot.js       # Bubble/scatter plot with smooth zoom
    │   ├── stream-chart.js       # Stacked stream chart with smooth zoom
    │   ├── bar-chart.js          # Horizontal bar chart
    │   └── job-chart.js          # Unit/dot chart for job type breakdown
    ├── utils/
    │   ├── helpers.js            # getDimensions, tooltip, formatValue
    │   ├── smooth-zoom.js        # Shared exponential-decay zoom/pan factory
    │   └── animate-narrative.js  # Narrative card entrance animation
    └── styles/
        ├── variables.css         # Design tokens: colors, spacing, typography
        ├── layout.css            # CSS Grid skeleton & slide layouts
        ├── components.css        # Glass cards, KPI widgets, tooltips, scrollbars
        ├── reset.css             # CSS reset
        └── main.css              # Stylesheet import bundler
```

---

## ⚡ Quick Start

### Prerequisites

Make sure you have **Node.js** (v18+) installed.

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Local Dev Server

```bash
npm run dev
```

The app will be available at [http://localhost:5173](http://localhost:5173).

### 3. Production Build

```bash
npm run build
```

Output goes to the `dist/` directory.
