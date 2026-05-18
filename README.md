# Data-Agnostic D3.js Visualization Dashboard Framework

This is a premium, highly responsive, and **completely data-agnostic D3.js visualization dashboard framework** designed to ingest and represent any datasets conforming to standard schema structures.

Built on **Vite**, **ES Modules (ESM)**, and **D3.js v7**, this repository contains a fully decoupled structure with reusable chart modules and glassmorphism styling.

---

## 📂 Framework Directory Structure

```text
D3-Analysis/
├── index.html                   # Master HTML skeleton layout & control containers
├── package.json                 # Project requirements (Vite, D3.js) & launch scripts
├── vite.config.js               # Dev server configuration
├── README.md                    # Framework API and startup documentation
├── public/                      # Static resources (automatically mapped by Vite)
│   └── data/
│       └── sample_dataset.json  # Reference mock dataset using generic schemas
└── src/
    ├── main.js                  # Main Coordinator: fetches data, manages filters, binds charts
    ├── styles/
    │   ├── variables.css        # Premium design tokens: color system, spacing, typography
    │   ├── layout.css           # CSS Grid skeleton & adaptive columns
    │   ├── components.css       # Custom glass cards, KPI widgets, tooltip overlays, scrollbars
    │   └── main.css             # Main stylesheet imports bundler
    ├── utils/
    │   └── helpers.js           # D3 layout helpers, formatters, and tooltip positioning
    └── components/
        ├── metric-cards.js      # Animates KPI summary count-up values
        ├── line-chart.js        # Reusable D3 Multi-Line and Area chart
        ├── scatter-plot.js      # Reusable D3 Scatter/Bubble distribution plot
        └── donut-chart.js       # Reusable D3 Donut categorical share chart
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

Launch Vite's dev server locally:

```bash
npm run dev
```

By default, the server will launch on [http://localhost:3000](http://localhost:3000). Vite automatically handles hot module reloading (HMR) for both JS and CSS changes.

### 3. Production Bundle

To compile a minimized, production-ready static bundle under the `dist/` directory:

```bash
npm run build
```

---

## 📊 Reusable Chart APIs

Each visualization is designed as a standalone ES6 module. They are completely decoupled from names of fields in specific datasets and are fully customizable via configurations:

### 📈 1. LineChart (`src/components/line-chart.js`)

A responsive, multi-series chronological trend line and area graph.

```javascript
import { LineChart } from './components/line-chart.js';

const line = new LineChart('#selector', {
  xKey: 'date',              // Object key representing timespan/horizontal scale
  yKey: 'value',             // Object key representing continuous y level
  groupKey: 'series',        // Object key distinguishing separate trend lines
  xScaleType: 'time',        // 'time' for dates, or 'linear' for continuous
  yLabel: 'Indicator Level', // Label displayed along the Y axis
  colors: ['#00f2fe', '#b100ff'] // Palette mapping array
});

// Update data
line.update(dataset);
```

### 🫧 2. ScatterPlot (`src/components/scatter-plot.js`)

An interactive bubble/distribution graph supporting dynamic crosshair coordinates.

```javascript
import { ScatterPlot } from './components/scatter-plot.js';

const scatter = new ScatterPlot('#selector', {
  xKey: 'x',                 // Horizontal axis metric
  yKey: 'y',                 // Vertical axis metric
  sizeKey: 'size',           // Bubble area scaling value
  groupKey: 'group',         // Categorical category color map
  labelKey: 'label',         // Unique identifier for hover nodes
  xLabel: 'Performance',     // X-Axis text
  yLabel: 'Efficiency',      // Y-Axis text
  colors: ['#00f2fe', '#ffb700']
});

// Update data
scatter.update(dataset);
```

### 🍩 3. DonutChart (`src/components/donut-chart.js`)

A highly responsive donut slice mapping category shares with dynamic arc expansion on hover.

```javascript
import { DonutChart } from './components/donut-chart.js';

const donut = new DonutChart('#selector', {
  categoryKey: 'label',      // Category text identifier
  valueKey: 'value',         // Continuous value sizing the slice arc
  innerRadiusRatio: 0.65,    // Center hole ratio (0.0 = Pie Chart, 0.9 = Thin Ring)
  colors: ['#00f2fe', '#4facfe', '#b100ff']
});

// Update data
donut.update(dataset);
```

---

## 🛠️ Customizing the Dataset

To visualize your own dataset:

1. Format your JSON conforming to one of the generic structural templates inside `public/data/sample_dataset.json`.
2. Save your file under `public/data/` or configure an external URL endpoint.
3. Open `src/main.js`, update the fetch target `d3.json('/data/sample_dataset.json')` to point to your data, and change the configuration keys inside the chart builders to match your custom field keys!
