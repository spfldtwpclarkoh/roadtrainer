import fs from 'node:fs';
const boundaries=JSON.parse(fs.readFileSync(new URL('../dist/data/boundaries.geojson',import.meta.url)));
const township=boundaries.features.find(f=>f.properties.kind==='township'&&f.properties.name==='Springfield');
const coords=[];
function visit(a){if(typeof a[0]==='number')coords.push(a);else a.forEach(visit);}
visit(township.geometry.coordinates);
const pad=.015;
const bbox=[Math.min(...coords.map(p=>p[1]))-pad,Math.min(...coords.map(p=>p[0]))-pad,Math.max(...coords.map(p=>p[1]))+pad,Math.max(...coords.map(p=>p[0]))+pad].join(',');
const query=`[out:json][timeout:60];(way[highway][highway!~"^(footway|path|steps|cycleway|bridleway|construction|proposed)$"](${bbox});way[waterway~"^(river|stream)$"](${bbox});nwr[amenity~"^(fire_station|school|hospital)$"][name](${bbox});nwr[leisure=park][name](${bbox}););out geom;`;
let raw;
for(const endpoint of ['https://overpass.private.coffee/api/interpreter','https://overpass-api.de/api/interpreter']){
  try{
    console.log(`Requesting public road and landmark context from ${endpoint}`);
    const response=await fetch(`${endpoint}?${new URLSearchParams({data:query})}`,{headers:{'User-Agent':'SpringfieldTownshipRoadTrainer/1.0'},signal:AbortSignal.timeout(70000)});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const candidate=await response.json();
    if(candidate.remark)throw new Error(candidate.remark);
    if(!candidate.elements?.length)throw new Error('No map features returned.');
    raw=candidate;
    break;
  }catch(error){console.error(error.message);}
}
if(!raw)throw new Error('Could not download road context. Existing data was preserved.');
const features=[];
const coord=p=>[Number(p.lon.toFixed(6)),Number(p.lat.toFixed(6))];
for(const e of raw.elements){
  const t=e.tags||{};
  const properties={osmId:`${e.type}/${e.id}`,name:t.name||'',ref:t.ref||'',altName:t.alt_name||'',officialName:t.official_name||''};
  if(t.highway&&e.geometry?.length>1){features.push({type:'Feature',properties:{...properties,kind:'road',highway:t.highway},geometry:{type:'LineString',coordinates:e.geometry.filter(p=>p.lat!=null&&p.lon!=null).map(coord)}});}
  else if(t.waterway&&e.geometry?.length>1){features.push({type:'Feature',properties:{...properties,kind:'water',waterway:t.waterway},geometry:{type:'LineString',coordinates:e.geometry.filter(p=>p.lat!=null&&p.lon!=null).map(coord)}});}
  else if(t.name&&(t.amenity||t.leisure)){
    const points=e.type==='node'?[e]:(e.geometry||e.members?.flatMap(m=>m.geometry||[])||[]).filter(p=>p.lat!=null&&p.lon!=null);
    if(!points.length)continue;
    const position=coord({lon:points.reduce((n,p)=>n+p.lon,0)/points.length,lat:points.reduce((n,p)=>n+p.lat,0)/points.length});
    features.push({type:'Feature',properties:{...properties,kind:'landmark',category:t.amenity||t.leisure},geometry:{type:'Point',coordinates:position}});
  }
}
const data={type:'FeatureCollection',source:'OpenStreetMap',license:'ODbL 1.0',downloadedAt:new Date().toISOString(),osmTimestamp:raw.osm3s?.timestamp_osm_base||null,bbox: bbox.split(',').map(Number),features};
fs.writeFileSync(new URL('../dist/data/map-context.geojson',import.meta.url),JSON.stringify(data));
console.log(`Saved ${features.filter(f=>f.properties.kind==='road').length} road segments, ${features.filter(f=>f.properties.kind==='landmark').length} landmarks, and ${features.filter(f=>f.properties.kind==='water').length} waterways.`);
