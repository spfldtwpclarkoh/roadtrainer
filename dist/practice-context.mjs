import { distanceMeters } from './geo.mjs';

const types={ROAD:'RD',STREET:'ST',AVENUE:'AVE',AV:'AVE',DRIVE:'DR',COURT:'CT',LANE:'LN',BOULEVARD:'BLVD',CIRCLE:'CIR',PLACE:'PL',TERRACE:'TER',TRAIL:'TRL',PARKWAY:'PKWY',HIGHWAY:'HWY',PIKE:'PIKE',PK:'PIKE'};
const ordinals={FIRST:'1ST',SECOND:'2ND',THIRD:'3RD',FOURTH:'4TH',FIFTH:'5TH'};
// Hide directional variants too: e.g. W POSSUM RD and West Possum Road.
export function roadNameKey(name) {
  return String(name||'').toUpperCase().replace(/^ST[.\s]+(?=PARIS\b)/,'SAINT ').replace(/\bCARILLION\b/g,'CARILLON').replace(/[^A-Z0-9]+/g,' ').trim().split(/\s+/).filter(w=>!['N','S','E','W','NORTH','SOUTH','EAST','WEST'].includes(w)).map(w=>types[w]||ordinals[w]||w).join(' ');
}
function roadBaseKey(name){const parts=roadNameKey(name).split(' ');if(Object.values(types).includes(parts.at(-1)))parts.pop();if(parts.length)parts[parts.length-1]=parts.at(-1).replace(/S$/,'');return parts.join(' ');}
export function hidesTargetLabel(properties, target) {
  if(!target)return false;
  const key=roadNameKey(target.name),base=roadBaseKey(target.name);
  return [properties.name,properties.altName,properties.officialName,properties.ref].flatMap(v=>String(v||'').split(';')).some(name=>{
    const normalized=roadNameKey(name);
    return normalized===key||roadBaseKey(name)===base||(properties.kind==='landmark'&&(normalized.includes(key)||normalized.includes(base)));
  });
}
const priorities={motorway:0,trunk:1,primary:2,secondary:3,tertiary:4,unclassified:5,residential:6,living_street:7,service:8};
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const osmAttribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';

export function createPracticeContext(map, data) {
  map.createPane('practiceRoads');map.getPane('practiceRoads').style.zIndex='350';
  map.createPane('practiceLabels');map.getPane('practiceLabels').style.zIndex='425';map.getPane('practiceLabels').style.pointerEvents='none';
  const roads=L.geoJSON(data,{pane:'practiceRoads',interactive:false,filter:f=>f.properties.kind!=='landmark',style:f=>{
    if(f.properties.kind==='water')return {color:'#78a6c7',weight:f.properties.waterway==='river'?4:2,opacity:.8};
    const major=(priorities[f.properties.highway]??7)<=3;
    return {color:major?'#8898a8':'#b7c2cc',weight:major?3:1.5,opacity:1,lineCap:'round'};
  }});
  const labels=L.layerGroup();let visible=false,target=null,frame=null;
  const candidates=data.features.filter(f=>f.properties.name||f.properties.ref).map(f=>{
    const points=f.geometry.type==='Point'?[f.geometry.coordinates]:f.geometry.coordinates;
    const anchor=points[Math.floor(points.length/2)];
    return {feature:f,anchor,priority:f.properties.kind==='water'?2:f.properties.kind==='landmark'?4:priorities[f.properties.highway]??8};
  }).sort((a,b)=>a.priority-b.priority);
  function updateLabels() {
    labels.clearLayers();if(!visible)return;
    const zoom=map.getZoom(),size=map.getSize(),occupied=[],used=new Set();
    for(const candidate of candidates){
      const {feature:f,anchor,priority}=candidate,p=f.properties;
      if(p.kind==='road'&&zoom<13&&priority>4)continue;
      if(p.kind==='landmark'&&zoom<12)continue;
      if(hidesTargetLabel(p,target))continue;
      // Suppress unfamiliar aliases right on the tested street as an extra guard.
      if(target&&target.points.some(point=>distanceMeters(point,anchor)<65))continue;
      const name=p.name||p.ref,key=`${p.kind}:${roadNameKey(name)}`;
      if(used.has(key))continue;
      const point=map.latLngToContainerPoint([anchor[1],anchor[0]]);
      const width=Math.min(240,name.length*7+18),height=p.kind==='landmark'?32:24;
      const box={left:point.x-width/2,right:point.x+width/2,top:point.y-height/2,bottom:point.y+height/2};
      if(box.left<14||box.right>size.x-14||box.top<75||box.bottom>size.y-85)continue;
      if(occupied.some(b=>box.left<b.right+12&&box.right>b.left-12&&box.top<b.bottom+10&&box.bottom>b.top-10))continue;
      occupied.push(box);used.add(key);
      const prefix=p.kind==='landmark'?(p.category==='fire_station'?'FD · ':p.category==='hospital'?'Hospital · ':p.category==='school'?'School · ':'Park · '):'';
      const icon=L.divIcon({className:`context-label ${p.kind}-label`,html:`<span>${escape(prefix+name)}</span>`,iconSize:[width,height],iconAnchor:[width/2,height/2]});
      L.marker([anchor[1],anchor[0]],{icon,pane:'practiceLabels',interactive:false,keyboard:false}).addTo(labels);
    }
  }
  function schedule(){if(frame!==null)cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{frame=null;updateLabels();});}
  map.on('moveend zoomend resize',schedule);
  return {
    show(street){target=street;if(!visible){visible=true;roads.addTo(map);labels.addTo(map);map.attributionControl.addAttribution(osmAttribution);}updateLabels();},
    hide(){target=null;if(visible){visible=false;map.removeLayer(roads);map.removeLayer(labels);map.attributionControl.removeAttribution(osmAttribution);}labels.clearLayers();},
    refresh:updateLabels
  };
}
