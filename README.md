# Moonlit

A small static lunar calendar for astrophotography. Choose an observing location and a night to see lunar phase, Moon rise/set, Sun rise/set, astronomical dusk/dawn, and the exact overlap of darkness with the Moon below the horizon.

Live site: [mmilanta.github.io/moonlit](https://mmilanta.github.io/moonlit/). GitHub Pages publishes the root of the `main` branch automatically; `.nojekyll` keeps the static files unchanged.

Open `index.html` directly in a browser, or run:

```sh
npm run dev
```

Then visit [localhost:5186](http://localhost:5186). No installation, build step, backend, or API key is required. Astronomy, city search, and time-zone lookup work offline; the small OpenStreetMap preview needs an internet connection. To publish, upload `index.html`, `method.html`, `styles.css`, `app.js`, `astronomy.js`, `location-picker.js`, `assets/`, `data/`, and `vendor/` to any static host.

Zurich is the default. The location picker accepts a city, manual latitude/longitude, or a point clicked on the map. Its marker, coordinates, and time zone stay in sync before you press **Use location**. The marker can also be dragged; keyboard users can pan the map and press Enter to select its centre. Elevation is optional; arbitrary points initially use sea level unless you enter an elevation. Closing the picker discards changes.

City time zones come from the bundled city catalogue. Coordinate time zones are inferred locally with [@photostructure/tz-lookup 11.7.0](https://github.com/photostructure/tz-lookup), which uses compressed geographic boundaries and can be approximate near borders or coastlines. You can edit the time zone; that override stays in place while moving the point until **Auto** restores inference. The selected location and override are remembered locally when browser storage is available.

The map uses locally bundled [Leaflet 1.9.4](https://leafletjs.com/) and visible attribution for OpenStreetMap contributors. Tiles load only while the picker is open, using normal browser caching; they are not prefetched for offline use. Serve the page over HTTP with `npm run dev` for the map preview. If tiles are unavailable, city selection, coordinates, and time-zone inference still work. Dependency sources and licences are documented in [vendor/SOURCES.md](vendor/SOURCES.md).

## What a night means

Each date labels the night beginning that afternoon: **local noon to the next local noon**. A `+1d` next to a time means the following calendar date. An event that does not occur during that period displays “No event.” High latitude locations can have no sunrise, moonrise, or astronomical darkness.

The main metric is **moon-free astronomical darkness**: the Sun's geometric center is at or below −18° and the Moon's apparent upper limb is below the horizon. The smaller sunset comparison includes twilight and therefore can be longer. All distinct overlapping intervals are preserved; elapsed durations account for 23- and 25-hour daylight-saving periods. Calendar hours are computed per night, rather than estimated from the phase or a repeating lunar cycle.

Continuous windows stay intact across midnight. **Evening** (↘, amber) starts at astronomical dusk and runs until moonrise. **Morning** (↗, teal) starts after moonset and runs toward dawn, even when moonset happens before midnight. Separate windows retain their moonlit gap. **All night** (•, olive) means all astronomical darkness is moon-free. The calendar and selected-night summary use the same classification; durations use actual elapsed time, including daylight-saving changes.

Lunar illumination is evaluated around the intervening local midnight. Moon graphics show phase with north up, rather than the Moon's current orientation in the observer's sky. Rise/set times and duration values are rounded independently to the nearest minute, so the difference between displayed endpoints can differ from the displayed duration by a minute.

## Accuracy and sources

The bundled [Astronomy Engine 2.1.19](https://github.com/cosinekitty/astronomy/tree/v2.1.19/source/js) computes positions, lunar illumination, and events in the browser. Its stated positional accuracy is within one arcminute, and its upstream tests compare with NOVAS and JPL Horizons. This is a positional accuracy specification, not a promise of one-minute rise/set accuracy everywhere.

`SearchRiseSet` accounts for the disc radius, lunar topocentric parallax, and standard refraction adjusted for observing elevation. The observer is assumed to be at ground level, with a level, unobstructed horizon. `SearchAltitude` supplies un-refracted −18° twilight crossings. See the [U.S. Naval Observatory's definitions](https://aa.usno.navy.mil/faq/RST_defs). Mountains, buildings, and actual atmospheric conditions can shift visible rise/set times. This page does not predict weather or light pollution.

The test suite checks against four independent [USNO API](https://aa.usno.navy.mil/data/api) responses, saved in `tests/` on 29 September 2026:

- [Zurich, 29 September 2026](https://aa.usno.navy.mil/api/rstt/oneday?date=2026-09-29&coords=47.3769,8.5417&tz=2)
- [Zurich, 30 September 2026](https://aa.usno.navy.mil/api/rstt/oneday?date=2026-09-30&coords=47.3769,8.5417&tz=2)
- [Zurich, 2 December 2026](https://aa.usno.navy.mil/api/rstt/oneday?date=2026-12-02&coords=47.3769,8.5417&tz=1)
- [Sydney, 4 October 2026](https://aa.usno.navy.mil/api/rstt/oneday?date=2026-10-04&coords=-33.8688,151.2093&tz=11)

Reference comparisons use zero elevation to match USNO's default. Every reference rise/set agrees within 90 seconds, and reference illumination agrees within one percentage point at local noon. The USNO API uses a fixed UTC offset for an entire date; tests compare actual UTC instants so Sydney's DST transition does not introduce a false one-hour discrepancy.

Run the tests with Node.js (no dependencies):

```sh
npm test
```

Tests also cover after-midnight moonrise, sunset gaps with no fully dark window, northern and southern DST, polar seasons, evening/morning classification across midnight, and interval membership checked against sampled solar/lunar altitude across locations and seasons.

## Files

- `index.html` — the calendar, inline night timeline, and location picker
- `method.html` — calculation method, sources, and attribution
- `styles.css` — responsive layout and Moon-inspired styling
- `app.js` — controls, local preferences, SVG phases, calendar, and timeline
- `location-picker.js` — city search, map/coordinate synchronization, and editable automatic time zones
- `astronomy.js` — time-zone conversion and observing-window calculations
- `vendor/astronomy.browser.min.js` — pinned, unmodified Astronomy Engine browser bundle
- `vendor/astronomy-LICENSE.txt` — upstream MIT license
- `tests/` — astronomy checks and independent reference data
