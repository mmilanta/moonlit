/* One draft location shared by the city list, coordinate fields, and map. */
'use strict';
class LocationPicker {
  constructor(presets,onApply) {
    this.presets=presets;
    this.onApply=onApply;
    this.el=id=>document.getElementById(id);
    this.dialog=this.el('location-dialog');
    this.catalog=Object.entries(presets).map(([id,city])=>({id,...city}))
      .filter((city,index,all)=>all.findIndex(other=>other.name===city.name)===index);
    this.el('city-search').addEventListener('input',()=>{
      this.el('city-search').setCustomValidity(''); this.showCities();
    });
    this.el('city-search').addEventListener('focus',()=>this.el('city-search').select());
    this.el('city-search').addEventListener('click',()=>this.showCities());
    this.el('city-search').addEventListener('keydown',event=>{
      if(event.key==='Escape' && !this.el('city-results').hidden) {
        event.preventDefault(); this.el('city-results').hidden=true;
      } else if(event.key==='Enter' && !this.el('city-results').hidden) {
        event.preventDefault();
        const first=this.el('city-results').querySelector('[data-location]');
        if(first) this.chooseCity(first.dataset.location);
      } else if(event.key==='ArrowDown') {
        event.preventDefault(); this.showCities();
        this.el('city-results').querySelector('[data-location]')?.focus();
      }
    });
    this.el('city-results').addEventListener('click',event=>{
      const button=event.target.closest('[data-location]');
      if(button) this.chooseCity(button.dataset.location);
    });
    this.el('city-picker').addEventListener('focusout',event=>{
      if(!this.el('city-picker').contains(event.relatedTarget)) this.el('city-results').hidden=true;
    });
    for(const id of ['latitude','longitude']) this.el(id).addEventListener('input',()=>this.readCoordinates());
    this.el('timezone').addEventListener('input',()=>{
      this.manualZone=true; this.el('timezone').setCustomValidity(''); this.zoneStatus();
    });
    this.el('auto-timezone').addEventListener('click',()=>{
      this.manualZone=false; this.inferZone();
    });
    this.el('elevation').addEventListener('input',()=>this.manualElevation=true);
    this.el('close-location').addEventListener('click',()=>this.dialog.close());
    this.dialog.addEventListener('click',event=>{
      if(!this.el('city-picker').contains(event.target)) this.el('city-results').hidden=true;
      if(event.target===this.dialog) {
        const rect=this.dialog.getBoundingClientRect();
        if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom) this.dialog.close();
      }
    });
    this.dialog.addEventListener('close',()=>{
      this.el('city-results').hidden=true;
      if(this.tiles && this.map.hasLayer(this.tiles)) this.map.removeLayer(this.tiles);
    });
    this.el('location-form').addEventListener('submit',event=>{
      event.preventDefault(); this.apply();
    });
  }
  open(site,id) {
    this.draft={...site}; this.draftId=id;
    this.manualZone=!!site.zoneManual;
    this.manualElevation=id==='custom' && site.elevationSource!=='sea-level fallback';
    this.el('location-error').hidden=true;
    this.el('location-options').open=false;
    this.fillFields();
    this.el('city-results').hidden=true;
    this.dialog.showModal();
    if(!this.map) this.createMap();
    this.map.invalidateSize({pan:false});
    this.moveMarker(10);
    if(!this.map.hasLayer(this.tiles)) this.tiles.addTo(this.map);
    this.el('city-search').focus();
  }
  fillFields() {
    this.el('city-search').value=this.draft.name;
    this.el('city-search').setCustomValidity('');
    this.el('latitude').value=this.draft.lat;
    this.el('longitude').value=this.draft.lon;
    this.el('elevation').value=this.draft.elevation;
    this.el('timezone').value=this.draft.zone;
    this.el('timezone').setCustomValidity('');
    this.zoneStatus();
  }
  showCities() {
    const normalize=value=>value.normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/[‘’]/g,"'").toLowerCase();
    let query=normalize(this.el('city-search').value.trim());
    if(query===normalize(this.draft.name)) query='';
    const cities=query
      ? this.catalog.filter(city=>normalize([city.name,city.countryCode,...(city.aliases||[])].filter(Boolean).join(' ')).includes(query))
        .sort((a,b)=>Number(normalize(b.city||b.name).startsWith(query))-Number(normalize(a.city||a.name).startsWith(query))||a.name.localeCompare(b.name))
      : ['zurich','london','new-york','sydney','tromso'].map(id=>({id,...this.presets[id]}));
    const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    this.el('city-results').innerHTML=cities.length
      ? cities.slice(0,6).map(city=>`<button type="button" class="city-result" data-location="${escape(city.id)}" aria-pressed="${city.id===this.draftId}">${escape(city.name)}</button>`).join('')
      : '<p class="city-empty">No matching city.</p>';
    this.el('city-results').hidden=false;
    this.el('city-search-status').textContent=`${cities.length} matching cities${cities.length>6?'; first six shown':''}.`;
  }
  chooseCity(id) {
    if(!this.presets[id]) return;
    this.draft={...this.presets[id]}; this.draftId=id;
    this.manualZone=false; this.manualElevation=false;
    this.el('location-error').hidden=true;
    this.fillFields(); this.el('city-results').hidden=true;
    this.moveMarker(10);
    this.el('latitude').focus();
  }
  createMap() {
    this.map=L.map('location-map',{scrollWheelZoom:false,worldCopyJump:true,zoomAnimation:false,fadeAnimation:false});
    this.map.attributionControl.setPrefix(false);
    this.tiles=L.tileLayer(this.el('location-map').dataset.tileUrl,{
      maxZoom:19,keepBuffer:0,updateWhenIdle:true,
      attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
    });
    this.tiles.on('tileerror',()=>{
      if(!this.loadedTiles) this.el('map-status').hidden=false;
    });
    this.tiles.on('tileload',()=>{
      this.loadedTiles=true; this.el('map-status').hidden=true;
    });
    this.marker=L.marker([this.draft.lat,this.draft.lon],{
      draggable:true,title:'Observing location. Drag to move.',
      icon:L.divIcon({className:'location-pin',iconSize:[14,14],iconAnchor:[7,7]})
    }).addTo(this.map);
    this.map.on('click',event=>this.selectMapPoint(event.latlng));
    this.marker.on('dragend',()=>this.selectMapPoint(this.marker.getLatLng()));
    this.el('location-map').addEventListener('keydown',event=>{
      if(event.key==='Enter' && event.target===this.el('location-map')) {
        event.preventDefault(); this.selectMapPoint(this.map.getCenter());
      }
    });
  }
  selectMapPoint(point) {
    this.el('city-results').hidden=true;
    const lon=((point.lng+180)%360+360)%360-180;
    this.el('latitude').value=Math.max(-90,Math.min(90,point.lat)).toFixed(5);
    this.el('longitude').value=lon.toFixed(5);
    this.readCoordinates(false);
  }
  readCoordinates(recenter=true) {
    const lat=this.el('latitude').valueAsNumber,lon=this.el('longitude').valueAsNumber;
    if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180) return;
    if(lat===this.draft.lat && lon===this.draft.lon) return;
    this.draft.lat=lat; this.draft.lon=lon;
    this.draft.name=`${lat.toFixed(4)}°, ${lon.toFixed(4)}°`; this.draftId='custom';
    this.el('city-search').value='';
    this.el('city-search').setCustomValidity('');
    if(!this.manualElevation) {
      this.draft.elevation=0; this.el('elevation').value=0;
      this.draft.elevationSource='sea-level fallback';
    }
    if(!this.manualZone) this.inferZone();
    this.marker.setLatLng([lat,lon]);
    if(recenter) this.map.setView([lat,lon],this.map.getZoom(),{animate:false});
  }
  moveMarker(zoom) {
    this.marker.setLatLng([this.draft.lat,this.draft.lon]);
    this.map.setView([this.draft.lat,this.draft.lon],zoom,{animate:false});
  }
  inferZone() {
    const lat=this.el('latitude').valueAsNumber,lon=this.el('longitude').valueAsNumber;
    try {
      const zone=tzlookup(lat,lon);
      new Intl.DateTimeFormat('en',{timeZone:zone}).format();
      this.draft.zone=zone; this.el('timezone').value=zone;
      this.el('timezone').setCustomValidity(''); this.zoneStatus();
    } catch {
      this.el('timezone-status').textContent='Enter valid coordinates, or set the time zone manually.';
    }
  }
  zoneStatus() {
    this.el('timezone-status').textContent=this.manualZone?'Time zone set manually. Auto restores coordinate lookup.':'Time zone inferred from location. You can edit it.';
    this.el('auto-timezone').setAttribute('aria-pressed',String(!this.manualZone));
  }
  apply() {
    const query=this.el('city-search').value.trim();
    if(query && query.toLowerCase()!==this.draft.name.toLowerCase()) {
      this.showCities();
      this.el('city-search').setCustomValidity('Choose a city from the list, or enter coordinates.');
      this.el('city-search').reportValidity(); return;
    }
    this.readCoordinates(false);
    const zone=this.el('timezone').value.trim();
    try { new Intl.DateTimeFormat('en',{timeZone:zone}).format(); }
    catch {
      this.el('timezone').setCustomValidity('Use a valid time zone, such as Europe/Zurich.');
      this.el('timezone').reportValidity(); return;
    }
    const next={...this.draft,lat:this.el('latitude').valueAsNumber,lon:this.el('longitude').valueAsNumber,
      elevation:this.el('elevation').valueAsNumber,zone,zoneManual:this.manualZone};
    if(this.manualElevation) delete next.elevationSource;
    const id=this.manualZone||this.manualElevation?'custom':this.draftId;
    this.onApply(next,id); this.dialog.close();
  }
}
