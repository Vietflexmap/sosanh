# Third-party data and services

## Natural Earth

This project uses country boundary data from Natural Earth through:

- https://github.com/TheTrueSize/natural-earth-vector
- upstream: https://github.com/nvkelso/natural-earth-vector

The Natural Earth repository states:

> Everything here is public domain.

Natural Earth data may be used and modified for personal, educational, and commercial purposes. See the upstream terms for full details.

## World Bank

Population data is requested at runtime from the World Bank API using indicator:

`SP.POP.TOTL` — Population, total.

## OpenStreetMap

Map tiles are displayed from OpenStreetMap and retain the required on-map attribution.

## Libraries

- Leaflet 1.9.4
- Turf.js 7.2.0

The interactive spherical-rotation implementation in `app.js` was written for this repository. It is inspired by the educational idea of moving countries across a Mercator map, but is not copied from the bundled production JavaScript of thetruesize.com.
