const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const N = require('../astronomy.js');
const A = require('../vendor/astronomy.browser.min.js');
const zurich = {lat:47.3769,lon:8.5417,elevation:0,zone:'Europe/Zurich'};
const sydney = {lat:-33.8688,lon:151.2093,elevation:0,zone:'Australia/Sydney'};
const tromso = {lat:69.6492,lon:18.9553,elevation:10,zone:'Europe/Oslo'};
const inIntervals = (list, time) => list.some(([a,b]) => time >= a && time < b);

// Independent USNO snapshots: source URLs and retrieval details are in README.md.
for (const [file,site] of [
  ['usno-zurich-2026-09-29.json',zurich],
  ['usno-zurich-2026-09-30.json',zurich],
  ['usno-zurich-2026-12-02.json',zurich],
  ['usno-sydney-2026-10-04.json',sydney]
]) {
  test(`rise/set agrees with independent Naval Observatory data: ${file}`,()=>{
    const reference=JSON.parse(fs.readFileSync(path.join(__dirname,file))).properties.data;
    const key=`${reference.year}-${String(reference.month).padStart(2,'0')}-${String(reference.day).padStart(2,'0')}`;
    // Two adjoining noon-to-noon nights cover the whole civil date.
    const nights=[N.calculateNight(N.addDays(key,-1),site),N.calculateNight(key,site)];
    for (const [field,eventsKey] of [['sundata','sunEvents'],['moondata','moonEvents']]) {
      for (const event of reference[field].filter(e=>e.phen==='Rise'||e.phen==='Set')) {
        const direction=event.phen==='Rise'?1:-1;
        const [hour,minute]=event.time.split(':').map(Number);
        // The USNO response uses one fixed UTC offset for the entire date,
        // including hours before an actual daylight-saving transition.
        const expected=Date.UTC(reference.year,reference.month-1,reference.day,hour,minute)-reference.tz*3600000;
        const actual=nights.flatMap(n=>n[eventsKey]).find(e=>e.direction===direction&&N.dateKey(e.time,site.zone)===key);
        assert.ok(actual,`${field} ${event.phen} exists`);
        assert.ok(Math.abs(+actual.time-expected)<=90000,
          `${field} ${event.phen}: ${actual.time.toISOString()} differs from ${event.time} by more than 90 seconds`);
      }
    }
    const illumination=A.Illumination(A.Body.Moon,N.zonedDate(key,12,site.zone)).phase_fraction*100;
    assert.ok(Math.abs(illumination-parseFloat(reference.fracillum))<=1,'noon illumination agrees to within 1 percentage point');
  });
}

test('the winter dark window ends at moonrise after midnight',()=>{
  const night=N.calculateNight('2026-12-02',zurich);
  assert.equal(night.windows.length,1);
  assert.equal(+night.windows[0][0],+night.twilightEvents.find(e=>e.direction===-1).time);
  assert.equal(+night.windows[0][1],+night.moonEvents.find(e=>e.direction===1).time);
  assert.equal(N.dateKey(night.windows[0][1],zurich.zone),'2026-12-03');
  assert.ok(night.sunsetTotal>night.total,'sunset-only estimate includes twilight');
  assert.ok(night.total>7*3600000&&night.total<8*3600000);
});

test('a gap after sunset can contain no astronomical darkness',()=>{
  const night=N.calculateNight('2026-09-29',zurich);
  assert.ok(night.sunsetTotal>45*60000);
  assert.equal(night.total,0);
  assert.deepEqual(night.windows,[]);
  assert.ok(!night.moonEvents.some(e=>e.direction===-1),'a missing moonset is not fabricated');
});

test('noon-to-noon periods include DST changes at the observing location',()=>{
  for(const [key,site,hours] of [
    ['2026-03-28',zurich,23],['2026-10-24',zurich,25],
    ['2026-10-03',sydney,23],['2026-04-04',sydney,25]
  ]) {
    const night=N.calculateNight(key,site);
    assert.equal((night.end-night.start)/3600000,hours);
    assert.equal(N.parts(night.start,site.zone).hour,12);
    assert.equal(N.parts(night.end,site.zone).hour,12);
  }
});

test('polar summer and winter do not invent sunrise or darkness',()=>{
  const summer=N.calculateNight('2026-06-21',tromso);
  assert.deepEqual(summer.sunEvents,[]);
  assert.deepEqual(summer.dark,[]);
  assert.equal(summer.total,0);
  const winter=N.calculateNight('2026-12-21',tromso);
  assert.deepEqual(winter.sunEvents,[]);
  assert.ok(N.duration(winter.dark)>0);
});

test('midnight DST gaps do not prevent a whole month from being calculated',()=>{
  for(const [zone,key] of [['America/Santiago','2026-09-05'],['America/Havana','2026-03-07']]) {
    const site={lat:zone==='America/Santiago'?-33.4489:23.1136,lon:zone==='America/Santiago'?-70.6693:-82.3666,elevation:0,zone};
    const night=N.calculateNight(key,site);
    assert.ok(Number.isFinite(night.total));
    assert.equal(N.parts(N.zonedDate(N.addDays(key,1),0,zone),zone).hour,1);
  }
  assert.throws(()=>N.zonedDate('2011-12-30',12,'Pacific/Apia'),/does not exist/);
});

test('dark intervals and windows agree with independent altitude sampling across locations and seasons',()=>{
  for(const site of [zurich,sydney,tromso,{lat:89,lon:0,elevation:0,zone:'UTC'}]) {
    const observer=new A.Observer(site.lat,site.lon,site.elevation);
    for(const key of ['2026-01-05','2026-03-28','2026-06-21','2026-09-29','2026-12-02']) {
      const night=N.calculateNight(key,site);
      for(let value=+night.start+150000;value<+night.end;value+=10*60000) {
        const time=new Date(value);
        const sunAltitude=N.altitude(A.Body.Sun,time,observer);
        assert.equal(inIntervals(night.dark,time),sunAltitude<=-18,`${site.zone} ${key} twilight at ${time.toISOString()}`);
        // Moon upper limb + standard refraction: an independent sample away from the crossing boundary.
        const eq=A.Equator(A.Body.Moon,time,observer,true,true);
        const moonAltitude=A.Horizon(time,observer,eq.ra,eq.dec).altitude;
        const limb=Math.asin(1737.4/(eq.dist*149597870.7))*180/Math.PI;
        const margin=moonAltitude+limb+(34/60)*A.Atmosphere(site.elevation).density;
        if(Math.abs(margin)>.02) {
          assert.equal(inIntervals(night.windows,time),sunAltitude<=-18&&margin<0,
            `${site.zone} ${key} window at ${time.toISOString()}`);
        }
      }
      assert.ok(night.total<=N.duration(night.dark));
      assert.ok(night.total<=night.sunsetTotal+1000);
    }
  }
});

test('intersections preserve two distinct observing windows and actual elapsed durations',()=>{
  const d=value=>new Date(value*3600000);
  const windows=N.intersect([[d(0),d(12)]],[[d(0),d(2)],[d(8),d(16)]]);
  assert.deepEqual(windows,[[d(0),d(2)],[d(8),d(12)]]);
  assert.equal(N.duration(windows),6*3600000);
});

test('January 1 dusk-to-moonrise window remains evening after midnight',()=>{
  const site={...zurich,elevation:408};
  const night=N.calculateNight('2027-01-01',site);
  const groups=N.classifyNightWindows(night.windows,night.dark);
  assert.equal(night.windows.length,1);
  assert.equal(+night.windows[0][0],+night.dark[0][0]);
  assert.equal(+night.windows[0][1],+night.moonEvents.find(e=>e.direction===1).time);
  assert.equal(N.dateKey(night.windows[0][1],site.zone),'2027-01-02');
  assert.deepEqual(groups.evening,night.windows);
  assert.deepEqual(groups.morning,[]);
  assert.deepEqual(groups['full-night'],[]);
  assert.equal(Math.round(N.duration(groups.evening)/60000),8*60+49);
});

test('a moonset-to-dawn window remains morning when it starts before midnight',()=>{
  const night=N.calculateNight('2027-01-10',{...zurich,elevation:408});
  const groups=N.classifyNightWindows(night.windows,night.dark);
  assert.equal(night.windows.length,1);
  assert.equal(+night.windows[0][0],+night.moonEvents.find(e=>e.direction===-1).time);
  assert.equal(+night.windows[0][1],+night.dark[0][1]);
  assert.equal(N.dateKey(night.windows[0][0],zurich.zone),'2027-01-10');
  assert.deepEqual(groups.morning,night.windows);
  assert.deepEqual(groups.evening,[]);
  assert.deepEqual(groups['full-night'],[]);
});

test('distinct evening and morning windows retain the moonlit gap',()=>{
  const d=hour=>new Date(hour*3600000);
  const dark=[[d(18),d(30)]];
  const windows=[[d(18),d(20)],[d(26),d(30)]];
  assert.deepEqual(N.classifyNightWindows(windows,dark),{
    evening:[windows[0]],morning:[windows[1]],'full-night':[]
  });
  assert.deepEqual(N.classifyNightWindows([],dark),{evening:[],morning:[],'full-night':[]});
  assert.deepEqual(N.classifyNightWindows([],[]),{evening:[],morning:[],'full-night':[]});
});

test('full-night classification requires every dark interval to be moon-free',()=>{
  const d=hour=>new Date(hour*3600000);
  const dark=[[d(12),d(15)],[d(18),d(36)]];
  const full=N.classifyNightWindows(dark,dark);
  assert.deepEqual(full,{'full-night':dark,evening:[],morning:[]});
  const partial=N.classifyNightWindows([dark[1]],dark);
  assert.deepEqual(partial['full-night'],[],'one complete interval cannot stand for the entire night');
  assert.equal(N.duration(Object.values(partial).flat()),18*3600000);
});

test('whole morning windows use actual elapsed time across daylight-saving changes',()=>{
  for(const [key,expectedMorning] of [['2026-03-28',9],['2026-10-24',11]]) {
    const next=N.addDays(key,1), zone='Europe/Zurich';
    const dark=[[N.zonedDate(key,18,zone),N.zonedDate(next,6,zone)]];
    const windows=[[N.zonedDate(key,20,zone),N.zonedDate(next,6,zone)]];
    const groups=N.classifyNightWindows(windows,dark);
    assert.deepEqual(groups.morning,windows);
    assert.deepEqual(groups.evening,[]);
    assert.equal(N.duration(groups.morning),expectedMorning*3600000);
    assert.equal(N.duration(Object.values(groups).flat()),N.duration(windows));
  }
});
