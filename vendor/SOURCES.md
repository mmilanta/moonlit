# Bundled location-picker dependencies

Downloaded on 1 October 2026. These files are served locally; there is no CDN dependency at runtime.

- **Leaflet 1.9.4**: `leaflet.js` and `leaflet.css`, unmodified distributions from [unpkg](https://unpkg.com/leaflet@1.9.4/dist/). [Source](https://github.com/Leaflet/Leaflet/tree/v1.9.4), [BSD-2-Clause licence](leaflet-LICENSE.txt). The picker uses a CSS marker rather than the optional default marker images or layer selector. The source-map file is not bundled.
- **@photostructure/tz-lookup 11.7.0**: `tz-lookup.js`, the unmodified `tz.js` distribution from [unpkg](https://unpkg.com/@photostructure/tz-lookup@11.7.0/tz.js). [Source](https://github.com/photostructure/tz-lookup), [CC0 licence](tz-lookup-LICENSE.txt). It estimates IANA zones from geographic boundaries derived from [timezone-boundary-builder](https://github.com/evansiroky/timezone-boundary-builder). Compression can introduce errors near borders and coastlines; the UI allows a manual override. Browser IANA data still determines daylight-saving rules for the selected date.

The map requests visible raster tiles from `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, with on-map [OpenStreetMap attribution](https://www.openstreetmap.org/copyright). The tile URL can be changed via `data-tile-url` on `#location-map`. No prefetch, bulk download, proxy, or offline tile archive is included. Standard browser caching is used. See the [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/).
