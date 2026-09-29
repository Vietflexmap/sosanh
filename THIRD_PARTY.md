# Third-party data and services

## datasets/geo-countries

Primary country and territory boundary data is loaded from:

- https://github.com/datasets/geo-countries
- `data/countries.geojson`

The repository documents that the dataset is generated from Natural Earth 1:10m country boundaries using GDAL/ogr2ogr with geometry validation (`-makevalid`) and coordinate precision of 6 decimal places.

The dataset contains 258 country and territory features. Its public schema includes:

- `name`
- `ISO3166-1-Alpha-2`
- `ISO3166-1-Alpha-3`

The dataset is published under ODC-PDDL-1.0. The underlying Natural Earth data is public domain.

## Natural Earth fallback

If the 1:10m Geo Countries mirrors are unavailable, the application can fall back to Natural Earth 1:110m country boundaries so the comparator remains usable.

## World Bank

Runtime indicators include:

- `SP.POP.TOTL` — Population, total
- `NY.GDP.MKTP.CD` — GDP (current US$)
- `NY.GDP.PCAP.CD` — GDP per capita (current US$)

## Vietflex Map

Mercator mode uses the pinned Vietflex 1.0.0 runtime from `Vietflexmap/VN`, including its Google Roadmap legacy tile integration.

## Libraries

- Vietflex Map 1.0.0
- Turf.js 7.2.0
- D3 7

The spherical movement and 360° rotation logic in `app.js` is implemented specifically for this repository.
