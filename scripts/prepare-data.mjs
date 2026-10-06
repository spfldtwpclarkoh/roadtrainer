import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inGeometry } from '../dist/geo.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.resolve(process.argv[2] || path.join(root, '../Geo Files'));
const read = name => JSON.parse(fs.readFileSync(path.join(source, name), 'utf8'));
const townships = read('TownshipBoundries.geojson');
const municipalities = read('MunicipalBoundary.geojson');
const addresses = read('Address.geojson');
const township = townships.features.find(f => f.properties.NAME.toUpperCase() === 'SPRINGFIELD');
if (!township) throw new Error('Springfield Township boundary is missing.');
const compactFeature = (f, kind) => ({ type:'Feature', properties:{name:f.properties.NAME,kind}, geometry:f.geometry });
const boundaryData = { type:'FeatureCollection', features:[...townships.features.map(f=>compactFeature(f,'township')), ...municipalities.features.map(f=>compactFeature(f,'municipality'))] };
const groups = new Map();
let count = 0;
for (const f of addresses.features) {
  if (f.geometry?.type !== 'Point') continue;
  const coord = f.geometry.coordinates;
  if (!inGeometry(coord, township.geometry)) continue;
  // Exclude incorporated municipalities, including Springfield city.
  if (municipalities.features.some(m => inGeometry(coord, m.geometry))) continue;
  const p=f.properties;
  const name=[p.ST_PREFIX,p.ST_NAME,p.ST_TYPE,p.ST_SUFFIX].map(v=>String(v??'').trim()).filter(Boolean).join(' ').toUpperCase();
  if (!String(p.ST_NAME??'').trim() || !name) continue;
  if (!groups.has(name)) groups.set(name, new Map());
  const point=[Number(coord[0].toFixed(6)),Number(coord[1].toFixed(6)),String(p.HOUSENUM??'').trim()];
  groups.get(name).set(point.join('|'),point);
  count++;
}
const streets=[...groups].sort(([a],[b])=>a.localeCompare(b)).map(([name,points],id)=>({id,name,points:[...points.values()]}));
const output=path.join(root,'dist/data'); fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'boundaries.geojson'),JSON.stringify(boundaryData));
fs.writeFileSync(path.join(output,'streets.json'),JSON.stringify({township:'Springfield Township',county:'Clark County',state:'Ohio',sourceAddressCount:addresses.features.length,addressCount:streets.reduce((n,s)=>n+s.points.length,0),streets}));
console.log(`Prepared ${streets.length} streets and ${streets.reduce((n,s)=>n+s.points.length,0)} unique address points strictly inside Springfield Township.`);
