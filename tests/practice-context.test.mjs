import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {roadNameKey,hidesTargetLabel} from '../dist/practice-context.mjs';
test('Tested street labels are suppressed despite abbreviation and directional differences',()=>{
  const target={name:'W POSSUM RD'};
  for(const name of ['West Possum Road','Possum Road','E Possum Rd'])assert.equal(hidesTargetLabel({kind:'road',name},target),true,name);
  assert.equal(hidesTargetLabel({kind:'road',name:'Bird Road',altName:'Old alignment;West Possum Road'},target),true);
  assert.equal(hidesTargetLabel({kind:'landmark',name:'West Possum Road School'},target),true);
  assert.equal(hidesTargetLabel({kind:'road',name:'South Bird Road'},target),false);
  assert.equal(roadNameKey('St. Paris Pike'),roadNameKey('SAINT PARIS PIKE'));
  assert.equal(roadNameKey('West Lonesome Dove Lane'),roadNameKey('LONESOME DOVE LN W'));
  assert.equal(roadNameKey('Springfield-Xenia Road'),roadNameKey('SPRINGFIELD-XENIA RD'));
  assert.equal(hidesTargetLabel({kind:'road',name:'West 1st Street'},{name:'W FIRST ST'}),true);
  assert.equal(hidesTargetLabel({kind:'road',name:'West Leffels Lane'},{name:'W LEFFEL LN'}),true);
  assert.equal(hidesTargetLabel({kind:'road',name:'Scioto Street'},{name:'SCIOTO DR'}),true);
  assert.equal(hidesTargetLabel({kind:'road',name:'Carillon Drive'},{name:'CARILLION DR'}),true);
});
test('Practice snapshot supplies real roads, waterways, and landmarks with attribution',()=>{
  const data=JSON.parse(fs.readFileSync(new URL('../dist/data/map-context.geojson',import.meta.url)));
  assert.equal(data.source,'OpenStreetMap');assert.equal(data.license,'ODbL 1.0');assert.ok(data.osmTimestamp);
  assert.ok(data.features.filter(f=>f.properties.kind==='road').length>100);
  assert.ok(data.features.some(f=>f.properties.kind==='landmark'));
  assert.ok(data.features.some(f=>f.properties.kind==='water'&&f.properties.name));
  for(const f of data.features){
    const points=f.geometry.type==='Point'?[f.geometry.coordinates]:f.geometry.coordinates;
    assert.ok(f.properties.osmId);
    if(f.geometry.type==='LineString')assert.ok(points.length>=2);
    for(const p of points)assert.ok(p.length===2&&p.every(Number.isFinite));
  }
});
