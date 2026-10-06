import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {inGeometry,distanceMeters,shuffled} from '../dist/geo.mjs';
test('Township islands and municipal holes preserve geographic scope',()=>{
  const geometry={type:'MultiPolygon',coordinates:[[[[0,0],[10,0],[10,10],[0,10],[0,0]],[[2,2],[4,2],[4,4],[2,4],[2,2]]],[[[12,0],[14,0],[14,2],[12,2],[12,0]]]]};
  assert.equal(inGeometry([1,1],geometry),true);
  assert.equal(inGeometry([3,3],geometry),false);
  assert.equal(inGeometry([11,1],geometry),false);
  assert.equal(inGeometry([13,1],geometry),true);
  assert.equal(inGeometry([0,5],geometry),true);
  assert.equal(inGeometry([2,3],geometry),false);
});
test('Distance scoring is in metres at Springfield latitude',()=>{
  assert.equal(distanceMeters([-83.8,39.9],[-83.8,39.9]),0);
  const distance=distanceMeters([-83.8,39.9],[-83.8,39.901]);
  assert.ok(distance>110&&distance<112);
});
test('Every published address belongs to the township and excludes municipal land',()=>{
  const boundaries=JSON.parse(fs.readFileSync(new URL('../dist/data/boundaries.geojson',import.meta.url)));
  const data=JSON.parse(fs.readFileSync(new URL('../dist/data/streets.json',import.meta.url)));
  const township=boundaries.features.find(f=>f.properties.kind==='township'&&f.properties.name==='Springfield');
  const municipalities=boundaries.features.filter(f=>f.properties.kind==='municipality');
  assert.ok(data.streets.length>=10);
  assert.equal(new Set(data.streets.map(s=>s.id)).size,data.streets.length);
  assert.equal(new Set(data.streets.map(s=>s.name)).size,data.streets.length);
  let count=0;
  for(const street of data.streets){
    assert.ok(street.name&&street.points.length);
    assert.equal(new Set(street.points.map(p=>p.join('|'))).size,street.points.length);
    for(const point of street.points){
      assert.ok(inGeometry(point,township.geometry),`${street.name}: outside township after coordinate rounding`);
      assert.ok(!municipalities.some(m=>inGeometry(point,m.geometry)),`${street.name}: inside municipal boundary`);
      count++;
    }
  }
  assert.equal(count,data.addressCount);
  const drill=shuffled(data.streets).slice(0,10);
  assert.equal(new Set(drill.map(s=>s.id)).size,10);
});
