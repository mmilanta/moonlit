const {test}=require('node:test');
const assert=require('node:assert/strict');
const tzlookup=require('../vendor/tz-lookup.js');

test('coordinate lookup identifies geographic time zones across regions',()=>{
  for(const [lat,lon,zone] of [
    [47.3769,8.5417,'Europe/Zurich'],
    [51.5074,-0.1278,'Europe/London'],
    [40.7128,-74.006,'America/New_York'],
    [34.0522,-118.2437,'America/Los_Angeles'],
    [33.4484,-112.074,'America/Phoenix'],
    [-33.8688,151.2093,'Australia/Sydney'],
    [27.7172,85.324,'Asia/Kathmandu'],
    [28.6139,77.209,'Asia/Kolkata'],
    [35.6762,139.6503,'Asia/Tokyo'],
    [-36.8485,174.7633,'Pacific/Auckland']
  ]) {
    assert.equal(tzlookup(lat,lon),zone);
    assert.doesNotThrow(()=>new Intl.DateTimeFormat('en',{timeZone:zone}));
  }
});
