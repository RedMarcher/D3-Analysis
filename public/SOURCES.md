# Data Sources

| File | Source | URL | Notes |
|------|--------|-----|-------|
| `im3_open_source_data_center_atlas_v2026.02.09.csv` | IM3 Open Source Data Center Atlas | https://im3.pnnl.gov | 1,479 verified U.S. facility coordinates. No power or stage data. AK/HI not included. |
| `Aterio US Data Centers Dashboard.xlsx` | Aterio | https://www.aterio.io/insights/us-data-centers | 6,590 U.S. facilities with stage, power (MW), sqft, operator, grid authority. Updated May 2026. |
| `aterio_states.json` *(generated)* | Derived from Aterio XLSX | — | Per-state active/planned counts, MW, dominant operator. |
| `aterio_yearly_mw.json` *(generated)* | Derived from Aterio XLSX (Evo ISO sheet) | — | National cumulative data center power capacity (MW) by year, 2018–2035 baseline. |
| `oesm25nat/national_M2025_dl.xlsx` | BLS Occupational Employment and Wage Statistics (OEWS) — National cross-industry estimates, May 2025 | https://www.bls.gov/oes/tables.htm | National median wages by occupation across all industries. Used for software developer, network admin, and security guard wage benchmarks. |
| `oesm25in4/nat5d_6d_M2025_dl.xlsx` | BLS OEWS — National industry-specific estimates (5 & 6-digit NAICS), May 2025 | https://www.bls.gov/oes/tables.htm | Wages by occupation within specific industries. Used for NAICS 238210 (Electrical Contractors), 238220 (HVAC Contractors), and 561610 (Guard Services) to source data center workforce wage data. |
| `bls_wages.json` *(generated)* | Derived from BLS OEWS National + Industry-specific files | https://www.bls.gov/oes/tables.htm | 6 occupation records: median annual wages for Temp Laborers (NAICS 561320), Electricians (238210), HVAC Mechanics (238220), Security Guards (561610), IT/Systems Admins and Software Developers (national cross-industry). Used for slide 4 workforce unit chart and wage bar chart. |
| `us-states.json` | *(source needed — please confirm)* | — | US state boundary GeoJSON with population density. Used for the slide 1 choropleth map. |
| `datacenters_slideshow.json` *(generated)* | Derived from Aterio XLSX, IM3 Atlas CSV, and layoffs.csv | — | Pre-aggregated per-state data center counts, layoff timeseries, power grid data, and jobs breakdown. Used across all slides. |
| `layoffs.csv` | Kaggle — swaptr (sourced from Layoffs.fyi) | https://www.kaggle.com/datasets/swaptr/layoffs-2022 | Tech industry layoff events 2020–2026. Primarily US companies. Coverage sparse pre-2022. |
| `Electricity production by source.csv` | Kaggle — scibearia (Our World in Data / BP Statistical Review) | https://www.kaggle.com/datasets/scibearia/electricity-production-by-source | Country-level electricity production by source (coal, gas, nuclear, renewables) from 2000. |
