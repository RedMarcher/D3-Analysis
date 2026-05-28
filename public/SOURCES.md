# Data Sources

| File | Source | URL | Notes |
|------|--------|-----|-------|
| `im3_open_source_data_center_atlas_v2026.02.09.csv` | IM3 Open Source Data Center Atlas | https://im3.pnnl.gov | 1,479 verified U.S. facility coordinates. No power or stage data. AK/HI not included. |
| `Aterio US Data Centers Dashboard.xlsx` | Aterio | https://www.aterio.io/insights/us-data-centers | 6,590 U.S. facilities with stage, power (MW), sqft, operator, grid authority. Updated May 2026. |
| `aterio_states.json` *(generated)* | Derived from Aterio XLSX via `scripts/process-aterio.py` | — | Per-state active/planned counts, MW, dominant operator. |
| `aterio_yearly_mw.json` *(generated)* | Derived from Aterio XLSX (Evo ISO sheet) via `scripts/process-aterio.py` | — | National cumulative data center power capacity (MW) by year, 2018–2035 baseline. |
| `layoffs.csv` | Kaggle — swaptr (sourced from Layoffs.fyi) | https://www.kaggle.com/datasets/swaptr/layoffs-2022 | Tech industry layoff events 2020–2026. Primarily US companies. Coverage sparse pre-2022. |
| `Electricity production by source.csv` | Kaggle — scibearia (Our World in Data / BP Statistical Review) | https://www.kaggle.com/datasets/scibearia/electricity-production-by-source | Country-level electricity production by source (coal, gas, nuclear, renewables) from 2000. |
