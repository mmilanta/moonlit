/* Astronomy and time-zone lookup run locally. Only map tiles use the network. */
'use strict';
const N = NightSky;
const $ = id => document.getElementById(id);
const presets = {
  zurich: { name:'Zurich, Switzerland', lat:47.3769, lon:8.5417, elevation:408, zone:'Europe/Zurich' },
  london: { name:'London, United Kingdom', lat:51.5074, lon:-0.1278, elevation:11, zone:'Europe/London' },
  'new-york': { name:'New York, United States', lat:40.7128, lon:-74.0060, elevation:10, zone:'America/New_York' },
  sydney: { name:'Sydney, Australia', lat:-33.8688, lon:151.2093, elevation:58, zone:'Australia/Sydney' },
  tromso: { name:'Tromsø, Norway', lat:69.6492, lon:18.9553, elevation:10, zone:'Europe/Oslo' },
  ...Object.fromEntries(CapitalCities.map(city=>[city.id,{...city,name:`${city.city}, ${city.country}`}]))
};
let site = { ...presets.zurich }, locationId = 'zurich';
try {
  const saved = JSON.parse(localStorage.getItem('moonlit-site'));
  if (saved && validSite(saved.site)) {
    site = presets[saved.id] ? {...presets[saved.id]} : withAutomaticElevation(saved.site);
    locationId = presets[saved.id] ? saved.id : 'custom';
  }
} catch { /* The page also works when browser storage is unavailable. */ }
let selected = N.dateKey(new Date(), site.zone);
if (selected < '1900-01-01' || selected > '2100-12-30') selected = '2026-09-29';
let month = selected.slice(0,7), moonId = 0;
const cache = new Map();
const weekViewQuery = window.matchMedia('(max-width:700px) and (max-height:639px), (min-width:701px) and (max-height:519px)');

function validSite(value) {
  if (!value || typeof value.name !== 'string' || !value.name.trim() || value.name.length > 80) return false;
  if (![value.lat,value.lon].every(Number.isFinite)
    || Math.abs(value.lat)>90 || Math.abs(value.lon)>180) return false;
  try { new Intl.DateTimeFormat('en',{timeZone:value.zone}).format(); return typeof value.zone === 'string'; } catch { return false; }
}
function withAutomaticElevation(value) {
  const city=Object.values(presets).find(city=>city.lat===value.lat&&city.lon===value.lon);
  return {...value,elevation:city?city.elevation:0,elevationSource:city?(city.elevationSource||'city estimate'):'sea-level fallback'};
}
function night(key) {
  if (!cache.has(key)) cache.set(key,N.calculateNight(key,site));
  return cache.get(key);
}
function escapeHTML(text) { return String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function civilLabel(key, options) { return new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',...options}).format(new Date(`${key}T12:00:00Z`)); }
function clock(date) {
  return new Intl.DateTimeFormat('en-GB',{timeZone:site.zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'})
    .format(new Date(Math.round(date.getTime()/60000)*60000));
}
function timeHTML(date,key) {
  const rounded = new Date(Math.round(date.getTime()/60000)*60000);
  const offset = N.dateKey(rounded,site.zone) > key ? '<span class="day-offset">+1d</span>' : '';
  return `<time datetime="${date.toISOString()}">${clock(date)}</time>${offset}`;
}
function durationText(ms,compact=false) {
  const minutes = Math.round(ms/60000), hours = Math.floor(minutes/60), remainder = minutes%60;
  if (!minutes) return compact ? '0h' : '0 min';
  if (compact) return `${hours}h${remainder ? ` ${String(remainder).padStart(2,'0')}m` : ''}`;
  return `${hours ? `${hours}h ` : ''}${remainder || !hours ? `${remainder}min` : ''}`.trim();
}
function durationHTML(ms) {
  const minutes = Math.round(ms/60000), hours = Math.floor(minutes/60), remainder = minutes%60;
  return hours ? `${hours}<small>h</small> ${String(remainder).padStart(2,'0')}<small>min</small>`
    : `${remainder}<small>min</small>`;
}

function nightPeriods(data) {
  const groups=N.classifyNightWindows(data.windows,data.dark);
  const labels={evening:'Evening',morning:'Morning','full-night':'All night'};
  return Object.entries(labels).map(([id,label])=>({id,label,windows:groups[id],duration:N.duration(groups[id])}))
    .filter(period=>period.windows.length);
}
function periodIndicator(period) {
  const symbol=period.id==='evening'?'↘':period.id==='morning'?'↗':'•';
  return `<span class="period-indicator ${period.id}" title="${period.label}" aria-label="${period.label}">${symbol}</span>`;
}

function moonSVG(phase,fraction,detailed=false) {
  const r=42, cx=48, top=6, bottom=90, k=2*fraction-1;
  const arc = Math.abs(k)<.00001 ? `L${cx},${top}` : `A${Math.abs(k)*r},${r} 0 0 ${k>=0?1:0} ${cx},${top}`;
  const path = `M${cx},${top} A${r},${r} 0 0 1 ${cx},${bottom} ${arc}Z`;
  const id=`moon-${++moonId}`;
  const craters = detailed ? `<g opacity=".13" fill="var(--moon-dark)"><circle cx="28" cy="32" r="9"/><circle cx="63" cy="55" r="13"/><circle cx="39" cy="68" r="6"/><circle cx="66" cy="24" r="5"/><circle cx="27" cy="51" r="4"/><circle cx="49" cy="37" r="4"/></g>` : '';
  return `<svg viewBox="0 0 96 96" aria-hidden="true"><defs><clipPath id="${id}"><path d="${path}"/></clipPath></defs><circle cx="48" cy="48" r="42" fill="var(--moon-dark)" stroke="var(--moon-outline)" stroke-width="1"/><g ${phase>180?'transform="translate(96 0) scale(-1 1)"':''}><path d="${path}" fill="var(--moon-light)"/><g clip-path="url(#${id})">${craters}</g></g></svg>`;
}

function renderDetails(data) {
  const dateLabel=civilLabel(selected,{weekday:'long',day:'numeric',month:'long'});
  $('night-date').textContent='Selected night';
  $('night-heading').textContent=dateLabel;
  $('dark-duration').innerHTML=durationHTML(data.total);
  const periods=nightPeriods(data);
  $('window-times').innerHTML=periods.length
    ? periods.map(period=>{
      const ranges=period.windows.map(([a,b])=>`<span>${timeHTML(a,selected)} <span aria-label="to">–</span> ${timeHTML(b,selected)}</span>`).join('');
      return `<div class="observing-window ${period.id}"><span class="window-period">${periodIndicator(period)} ${period.label}<span class="window-duration">${durationText(period.duration)}</span></span>${ranges}</div>`;
    }).join('')
    : `<span class="no-window-reason">${!data.dark.length
      ? 'No astronomical darkness: the Sun stays above −18°.'
      : 'The Moon stays above the horizon throughout astronomical darkness.'}</span>`;
  $('moon-graphic').innerHTML=moonSVG(data.phase,data.illumination,true);
  $('moon-phase').textContent=data.phaseName;
  $('moon-illumination').textContent=`${Math.round(data.illumination*100)}% illuminated · ${data.phase<180?'waxing':'waning'}`;
  const periodHours=(data.end-data.start)/3600000;
  $('timeline-period').textContent=`Local noon → next noon${periodHours!==24?` · ${periodHours} hours (DST)`:''}`;
  const scale=date=>100*(date-data.start)/(data.end-data.start);
  const segments=(list,cls)=>list.map(([a,b])=>`<span class="segment ${cls}" style="left:${scale(a)}%;width:${scale(b)-scale(a)}%"></span>`).join('');
  $('timeline').innerHTML=`<span class="track-label">Sun</span><div class="track sun-track">${segments(data.dark,'dark')}${segments(data.sunlight,'sunlight')}</div><span class="track-label">Moon</span><div class="track">${segments(data.moonUp,'moonlight')}</div><span class="track-label">Dark</span><div class="track">${segments(data.windows,'clear')}</div><span></span><div class="timeline-ticks">${Array.from({length:7},(_,i)=>`<span class="timeline-tick" style="left:${i*100/6}%">${clock(new Date(+data.start+(data.end-data.start)*i/6))}</span>`).join('')}</div>`;
  const ranges=periods.map(period=>`${period.label}, ${durationText(period.duration)}: ${period.windows.map(([a,b])=>`${clock(a)}${N.dateKey(a,site.zone)>selected?' next day':''} to ${clock(b)}${N.dateKey(b,site.zone)>selected?' next day':''}`).join(', ')}`).join('; ');
  $('timeline').setAttribute('aria-label',`Noon-to-noon timeline: ${durationText(N.duration(data.dark))} astronomical darkness; ${durationText(data.total)} moon-free darkness${ranges?`, ${ranges}`:''}.`);
}

function renderCalendar() {
  const weekView=weekViewQuery.matches;
  document.documentElement.classList.toggle('week-view',weekView);
  if(weekView) month=selected.slice(0,7);
  const [year,m]=month.split('-').map(Number);
  const first=`${month}-01`, weekday=(new Date(`${first}T12:00:00Z`).getUTCDay()+6)%7;
  const days=new Date(Date.UTC(year,m,0)).getUTCDate();
  const selectedWeekday=(new Date(`${selected}T12:00:00Z`).getUTCDay()+6)%7;
  const weekStart=N.addDays(selected,-selectedWeekday), weekEnd=N.addDays(weekStart,6);
  const calendarStart=weekView?weekStart:N.addDays(first,-weekday);
  const cells=weekView?7:Math.ceil((weekday+days)/7)*7;
  const today=N.dateKey(new Date(),site.zone);
  $('month-label').textContent=weekView
    ? `${weekStart.slice(0,7)===weekEnd.slice(0,7)?Number(weekStart.slice(8)):civilLabel(weekStart,{day:'numeric',month:'short'})}–${civilLabel(weekEnd,{day:'numeric',month:'short',year:'numeric'})}`
    : civilLabel(first,{month:'long',year:'numeric'});
  $('month-label').setAttribute('aria-label',weekView
    ? `Week from ${civilLabel(weekStart,{day:'numeric',month:'long',year:'numeric'})} to ${civilLabel(weekEnd,{day:'numeric',month:'long',year:'numeric'})}`
    : $('month-label').textContent);
  $('previous-month').disabled=weekView?weekStart<='1900-01-01':month<='1900-01';
  $('next-month').disabled=weekView?weekEnd>='2100-12-30':month>='2100-12';
  $('previous-month').setAttribute('aria-label',weekView?'Previous week':'Previous month');
  $('next-month').setAttribute('aria-label',weekView?'Next week':'Next month');
  $('calendar').setAttribute('aria-label',`Choose an observing night in this ${weekView?'week':'month'}`);
  let html='';
  for(let i=0;i<cells;i++) {
    const key=N.addDays(calendarStart,i), outside=!weekView&&key.slice(0,7)!==month;
    const number=Number(key.slice(8));
    if (outside || key<'1900-01-01' || key>'2100-12-30') {
      html+=`<div class="calendar-day outside" aria-hidden="true"><span class="day-number">${number}</span></div>`;
      continue;
    }
    let data;
    try { data=night(key); }
    catch {
      html+=`<div class="calendar-day outside" aria-label="${key}: date unavailable in this time zone"><span class="day-number">${number}</span><span class="day-illumination">Unavailable</span></div>`;
      continue;
    }
    const good=data.total>=4*3600000;
    const periods=nightPeriods(data);
    const periodHTML=periods.length
      ? periods.map(period=>`<span class="day-period ${period.id}" title="${period.label}: ${durationText(period.duration)}">${periodIndicator(period)}<span>${durationText(period.duration,true).replaceAll(' ','')}</span></span>`).join('')
      : '<span class="day-hours">—</span>';
    const periodLabel=periods.map(period=>`${period.label.toLowerCase()} ${durationText(period.duration)}`).join(', ');
    const label=`${civilLabel(key,{day:'numeric',month:'long',year:'numeric'})}: ${data.phaseName}, ${Math.round(data.illumination*100)}% illuminated, ${durationText(data.total)} moon-free darkness${periodLabel?`, ${periodLabel}`:''}`;
    html+=`<button class="calendar-day ${key===selected?'selected':''} ${key===today?'today':''} ${good?'good':''}" data-date="${key}" aria-pressed="${key===selected}" aria-label="${escapeHTML(label)}"><span class="day-top"><span class="day-number">${number}</span><span class="mini-moon">${moonSVG(data.phase,data.illumination)}</span></span><span class="day-periods" aria-hidden="true">${periodHTML}</span></button>`;
  }
  $('calendar').innerHTML=html;
}

function render(includeCalendar=true) {
  $('error').hidden=true;
  $('date').value=selected;
  $('edit-location').textContent=site.name;
  try {
    renderDetails(night(selected));
    document.querySelector('.night-card').hidden=false;
    if(includeCalendar) renderCalendar();
    else document.querySelectorAll('.calendar-day[data-date]').forEach(button=>{
      button.classList.toggle('selected',button.dataset.date===selected);
      button.setAttribute('aria-pressed',String(button.dataset.date===selected));
    });
  } catch(error) {
    document.querySelector('.night-card').hidden=true;
    $('error').textContent=`Unable to calculate this night: ${error.message || error}`;
    $('error').hidden=false;
  }
}

function selectNight(key) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(key)||key<'1900-01-01'||key>'2100-12-30') return;
  const changedCalendar=weekViewQuery.matches
    ? !$('calendar').querySelector(`[data-date="${key}"]`)
    : key.slice(0,7)!==month;
  selected=key; month=key.slice(0,7); render(changedCalendar);
}
function setSite(next,id) {
  site=withAutomaticElevation(next); locationId=id; cache.clear();
  try { localStorage.setItem('moonlit-site',JSON.stringify({site,id})); } catch {}
  render();
}
const locationPicker = new LocationPicker(presets,(next,id)=>setSite(next,id));
function editLocation() { locationPicker.open(site,locationId); }
$('calendar').addEventListener('click',event=>{
  const button=event.target.closest('[data-date]');
  if(button) selectNight(button.dataset.date);
});
$('date').addEventListener('change',()=>{
  if($('date').validity.valid && $('date').value) selectNight($('date').value);
});
$('today').addEventListener('click',()=>selectNight(N.dateKey(new Date(),site.zone)));
for(const [id,delta] of [['previous-month',-1],['next-month',1]]) {
  $(id).addEventListener('click',()=>{
    if(weekViewQuery.matches) {
      const key=N.addDays(selected,delta*7);
      selectNight(key<'1900-01-01'?'1900-01-01':key>'2100-12-30'?'2100-12-30':key);
      return;
    }
    const d=new Date(`${month}-01T12:00:00Z`); d.setUTCMonth(d.getUTCMonth()+delta);
    month=d.toISOString().slice(0,7); renderCalendar();
  });
}
$('edit-location').addEventListener('click',editLocation);
weekViewQuery.addEventListener('change',()=>renderCalendar());
render();
