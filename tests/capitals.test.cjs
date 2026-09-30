const {test}=require('node:test');
const assert=require('node:assert/strict');
const cities=require('../data/capitals.js');
const N=require('../astronomy.js');

// Independent ISO codes for the 193 countries in the UN member-state list.
const unMembers='AD AE AF AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FR GA GB GD GE GH GM GN GQ GR GT GW GY HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KI KM KN KP KR KW KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NR NZ OM PA PE PG PH PK PL PT PW PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM TN TO TR TT TV TZ UA UG US UY UZ VC VE VN VU WS YE ZA ZM ZW'.split(' ');

test('all UN member countries and both observer states have observing locations',()=>{
  assert.equal(unMembers.length,193);
  const included=new Set(cities.map(city=>city.countryCode));
  assert.deepEqual([...unMembers,'VA','PS'].filter(code=>!included.has(code)),[]);
});

test('capital records have unique IDs, city coordinates, usable elevations, and valid IANA zones',()=>{
  assert.equal(new Set(cities.map(city=>city.id)).size,cities.length);
  assert.equal(new Set(cities.map(city=>city.geonameId)).size,cities.length);
  for(const city of cities) {
    assert.ok(city.city&&city.country&&`${city.city}, ${city.country}`.length<=80);
    assert.ok(Number.isFinite(city.lat)&&Math.abs(city.lat)<=90,city.city);
    assert.ok(Number.isFinite(city.lon)&&Math.abs(city.lon)<=180,city.city);
    assert.ok(Number.isFinite(city.elevation)&&city.elevation>=-500&&city.elevation<=10000,city.city);
    assert.doesNotThrow(()=>new Intl.DateTimeFormat('en',{timeZone:city.zone}),city.city);
  }
});

test('multiple capitals and current names are present',()=>{
  const names=code=>cities.filter(city=>city.countryCode===code).map(city=>city.city);
  assert.deepEqual(names('ZA').sort(),['Bloemfontein','Cape Town','Pretoria']);
  assert.ok(names('LK').includes('Sri Jayewardenepura Kotte'));
  assert.ok(names('BO').includes('Sucre')&&names('BO').includes('La Paz'));
  assert.deepEqual(names('GQ'),['Ciudad de la Paz']);
  assert.deepEqual(names('PW'),['Ngerulmud']);
  assert.ok(cities.some(city=>city.city==='Washington, D.C.'));
  assert.ok(!cities.some(city=>['Harewood','Liberpolis','Thomas Magena home'].includes(city.city)));
});

test('every capital produces valid observing windows in both solstice seasons',()=>{
  for(const city of cities) for(const key of ['2026-06-21','2026-12-21']) {
    const night=N.calculateNight(key,city);
    assert.ok(Number.isFinite(night.total)&&night.total>=0,`${city.city}: ${key}`);
    const groups=N.classifyNightWindows(night.windows,night.dark);
    const classified=Object.values(groups).flat().sort((a,b)=>a[0]-b[0]);
    assert.deepEqual(classified,night.windows,`${city.city}: ${key} keeps windows intact`);
    assert.equal(N.duration(classified),night.total);
  }
});
