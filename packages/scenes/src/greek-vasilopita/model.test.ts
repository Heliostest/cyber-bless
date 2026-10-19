import {describe,it,expect} from 'vitest'
import * as THREE from 'three'
import {createVasilopitaModel} from './model'
import {disposeTree} from '../procedural-kit'

function bounds(mesh:THREE.Mesh){return new THREE.Box3().setFromObject(mesh,true)}
describe('Vasilopita serving geometry',()=>{
 it('lifts the already-cut slice clear of the cake before serving and rests it on the family plate',()=>{
  const m=createVasilopitaModel();m.pose(0,0);expect(bounds(m.sliceBottom).min.y).toBeCloseTo(bounds(m.blade).max.y,7)
  m.pose(1,0);expect(bounds(m.sliceBottom).min.y).toBeGreaterThan(.528+.243)
  m.pose(2,0);expect(bounds(m.sliceBottom).min.y).toBeCloseTo(.528,7);expect(bounds(m.blade).min.y).toBeCloseTo(.5,7)
  expect(bounds(m.blade).min.z).toBeGreaterThan(.79);disposeTree(m.root)
 })
 it('uses a genuine side opening and removes the coin outward before lifting it above the cake',()=>{
  const m=createVasilopitaModel(),pos=new THREE.Vector3();m.pose(2,0);const start=m.coin.getWorldPosition(pos.clone())
  expect(bounds(m.coin).min.y).toBeCloseTo(bounds(m.sliceBottom).max.y,7)
  m.pose(2,.35);const out=m.coin.getWorldPosition(pos.clone());expect(out.y).toBeCloseTo(start.y,9);expect(out.clone().sub(start).dot(m.outward)).toBeCloseTo(.22,9)
  m.pose(2,.55);const raised=m.coin.getWorldPosition(pos.clone());expect(raised.y).toBeCloseTo(out.y+.18,9)
  m.pose(3,0);expect(m.coin.getWorldPosition(pos).distanceTo(m.coinEnd)).toBeLessThan(1e-12);expect(bounds(m.coin).min.y).toBeCloseTo(.528,7)
  // A ray through the visible mouth reaches the coin; the closed cake layers do not seal it.
  m.pose(2,0);const center=m.coin.getWorldPosition(pos.clone()),ray=new THREE.Raycaster(center.clone().addScaledVector(m.outward,.4),m.outward.clone().negate());
  expect(ray.intersectObjects([m.sliceBottom,m.sliceMiddle,m.sliceTop,m.coin],false)[0]?.object).toBe(m.coin);disposeTree(m.root)
 })
 it('keeps both serving plate tops flat so the blade can slide out without crossing a raised rim',()=>{
  const m=createVasilopitaModel();for(const plate of[m.platter,m.familyPlate]){const p=plate.geometry.getAttribute('position');for(let i=0;i<p.count;i++)expect(p.getY(i)).toBeLessThanOrEqual(.028+1e-7)}disposeTree(m.root)
 })
 it('keeps the blade below the slice until it has completely withdrawn',()=>{
  const m=createVasilopitaModel();for(const t of [.65,.68,.75,.8,.9]){m.pose(1,t);const slice=bounds(m.sliceBottom),blade=bounds(m.blade);if(blade.intersectsBox(slice))expect(blade.max.y).toBeLessThanOrEqual(slice.min.y+1e-7)}disposeTree(m.root)
 })
 it('restores exact checkpoints without rebuilding geometry or producing nonfinite transforms',()=>{
  const m=createVasilopitaModel(),snap=()=>{const rows:number[][]=[];m.root.traverse(o=>rows.push([...o.matrixWorld.elements,Number(o.visible)]));return rows},geometry:THREE.BufferGeometry[]=[];m.root.traverse(o=>{if((o as THREE.Mesh).isMesh)geometry.push((o as THREE.Mesh).geometry)})
  for(let step=0;step<3;step++){for(let i=0;i<=100;i++){m.pose(step,i/100);m.root.traverse(o=>expect(o.matrixWorld.elements.every(Number.isFinite),o.name).toBe(true))}const end=snap();m.pose(step+1,0);expect(snap()).toEqual(end)}
  const after:THREE.BufferGeometry[]=[];m.root.traverse(o=>{if((o as THREE.Mesh).isMesh)after.push((o as THREE.Mesh).geometry)});expect(after).toEqual(geometry);disposeTree(m.root)
 })
})
