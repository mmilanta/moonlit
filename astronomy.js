/* Night calculations. All intervals use UTC instants; civil dates use the site's IANA zone. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./vendor/astronomy.browser.min.js'));
  } else root.NightSky = factory(root.Astronomy);
})(globalThis, function (A) {
  'use strict';
  const DAY = 86400000;
  const formatters = new Map();

  function parts(date, zone) {
    if (!formatters.has(zone)) formatters.set(zone, new Intl.DateTimeFormat('en-CA', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    }));
    return Object.fromEntries(formatters.get(zone).formatToParts(date)
      .filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
  }

  function dateKey(date, zone) {
    const p = parts(date, zone);
    return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
  }

  function addDays(key, count) {
    const d = new Date(`${key}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + count);
    return d.toISOString().slice(0, 10);
  }

  function zonedDate(key, hour, zone) {
    const [y, m, d] = key.split('-').map(Number);
    const target = Date.UTC(y, m - 1, d, hour);
    let value = target, previous = target;
    for (let i = 0; i < 6; i++) {
      const p = parts(new Date(value), zone);
      const delta = target - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
      if (!delta) return new Date(value);
      previous = value;
      value += delta;
    }
    // A midnight DST jump can skip 00:00. Evaluate phase at the first valid
    // instant after that gap, provided it belongs to the requested date.
    const compatible = new Date(Math.max(value, previous));
    if (hour === 0 && dateKey(compatible, zone) === key) return compatible;
    throw new Error('This local date or time does not exist in the selected time zone.');
  }

  function altitude(body, date, observer) {
    const eq = A.Equator(body, date, observer, true, true);
    return A.Horizon(date, observer, eq.ra, eq.dec).altitude;
  }

  function crossings(body, observer, start, end, threshold = null) {
    const events = [];
    for (const direction of [-1, 1]) {
      let cursor = start;
      for (let i = 0; i < 6 && cursor < end; i++) {
        const days = (end - cursor) / DAY;
        const result = threshold === null
          ? A.SearchRiseSet(body, observer, direction, cursor, days)
          : A.SearchAltitude(body, observer, direction, cursor, days, threshold);
        if (!result || result.date >= end) break;
        events.push({ time: result.date, direction });
        cursor = new Date(result.date.getTime() + 1000);
      }
    }
    return events.sort((a, b) => a.time - b.time);
  }

  function aboveHorizon(body, time, observer) {
    const eq = A.Equator(body, time, observer, true, true);
    const radius = Math.asin((body === A.Body.Moon ? 1737.4 : 695700)
      / (eq.dist * 149597870.7)) * 180 / Math.PI;
    const refraction = (34 / 60) * A.Atmosphere(observer.height).density;
    return A.Horizon(time, observer, eq.ra, eq.dec).altitude > -(radius + refraction);
  }

  function intervals(start, end, events, initiallyAbove, wantedAbove) {
    const result = [];
    let cursor = start, above = initiallyAbove;
    for (const event of events) {
      if (above === wantedAbove && event.time > cursor) result.push([cursor, event.time]);
      above = event.direction === 1;
      cursor = event.time;
    }
    if (above === wantedAbove && end > cursor) result.push([cursor, end]);
    return result;
  }

  function intersect(a, b) {
    const result = [];
    for (const [a0, a1] of a) for (const [b0, b1] of b) {
      const start = new Date(Math.max(a0, b0)), end = new Date(Math.min(a1, b1));
      if (end > start) result.push([start, end]);
    }
    return result.sort((a, b) => a[0] - b[0]);
  }

  function duration(intervals) {
    return intervals.reduce((sum, [start, end]) => sum + (end - start), 0);
  }

  function classifyNightWindows(windows, dark) {
    const groups = { evening: [], morning: [], 'full-night': [] };
    if (windows.length && duration(windows) === duration(dark)) {
      groups['full-night'] = windows;
      return groups;
    }
    // Dusk-to-moonrise windows are evening; windows opening after moonset
    // are morning. Keep each interval intact when it crosses midnight.
    for (const window of windows) {
      const darkness = dark.find(([start, end]) => window[0] >= start && window[1] <= end);
      const kind = darkness && +window[0] === +darkness[0] ? 'evening' : 'morning';
      groups[kind].push(window);
    }
    return groups;
  }

  function phaseName(angle) {
    if (angle < 5 || angle >= 355) return 'New Moon';
    if (angle < 85) return 'Waxing crescent';
    if (angle < 95) return 'First quarter';
    if (angle < 175) return 'Waxing gibbous';
    if (angle < 185) return 'Full Moon';
    if (angle < 265) return 'Waning gibbous';
    if (angle < 275) return 'Last quarter';
    return 'Waning crescent';
  }

  function calculateNight(key, site) {
    const start = zonedDate(key, 12, site.zone);
    const end = zonedDate(addDays(key, 1), 12, site.zone);
    const observer = new A.Observer(site.lat, site.lon, site.elevation);
    const sunEvents = crossings(A.Body.Sun, observer, start, end);
    const moonEvents = crossings(A.Body.Moon, observer, start, end);
    const twilightEvents = crossings(A.Body.Sun, observer, start, end, -18);
    const initial = (body, events) => events.length
      ? events[0].direction === -1 : aboveHorizon(body, start, observer);
    const sunlight = intervals(start, end, sunEvents, initial(A.Body.Sun, sunEvents), true);
    const sunDown = intervals(start, end, sunEvents, initial(A.Body.Sun, sunEvents), false);
    const moonUp = intervals(start, end, moonEvents, initial(A.Body.Moon, moonEvents), true);
    const moonDown = intervals(start, end, moonEvents, initial(A.Body.Moon, moonEvents), false);
    const dark = intervals(start, end, twilightEvents,
      twilightEvents.length ? twilightEvents[0].direction === -1
        : altitude(A.Body.Sun, start, observer) > -18, false);
    const windows = intersect(dark, moonDown);
    const sunsetWindows = intersect(sunDown, moonDown);
    const midnight = zonedDate(addDays(key, 1), 0, site.zone);
    const illumination = A.Illumination(A.Body.Moon, midnight).phase_fraction;
    const phase = A.MoonPhase(midnight);
    return { key, start, end, sunEvents, moonEvents, twilightEvents, sunlight, sunDown,
      moonUp, moonDown, dark, windows, sunsetWindows, illumination, phase,
      phaseName: phaseName(phase), total: duration(windows), sunsetTotal: duration(sunsetWindows) };
  }

  return { parts, dateKey, addDays, zonedDate, calculateNight, intersect, duration, classifyNightWindows, altitude };
});
