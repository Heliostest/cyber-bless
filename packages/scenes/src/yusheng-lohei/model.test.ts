import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {createYushengModel} from './model';
import {disposeTree} from '../procedural-kit';
const cleanup=(m:ReturnType<typeof createYushengModel>)=>{m.dispose();disposeTree(m.root)};
describe('Communal chopsticks and real fish-salad pieces',()=>{
  it('uses closed ingredient surfaces so the toss never exposes open tube ends',()=>{
    const m=createYushengModel();
    for(const piece of m.food){const body=piece.children[0] as THREE.Mesh,p=body.geometry.getAttribute('position'),edges=new Map<string,number>();
      const vertex=(i:number)=>[p.getX(i),p.getY(i),p.getZ(i)].map(n=>Math.round(n*1e6)).join(',');
      for(let i=0;i<p.count;i+=3)for(const [a,b] of[[i,i+1],[i+1,i+2],[i+2,i]]){const key=[vertex(a!),vertex(b!)].sort().join('|');edges.set(key,(edges.get(key)??0)+1)}
      expect([...edges.values()].every(n=>n===2),piece.name).toBe(true);
    }cleanup(m);
  });
  it('keeps every checkpoint identical to the previous settled pose',()=>{
    const m=createYushengModel();
    for(let s=0;s<3;s++){m.pose(s,1);const end=new Map<string,number[]>();m.subject.traverse(o=>end.set(o.name,[...o.matrixWorld.elements]));m.pose(s+1,0);m.subject.traverse(o=>o.matrixWorld.elements.forEach((v,i)=>expect(v,o.name).toBeCloseTo(end.get(o.name)![i]!,8)))}cleanup(m);
  });
  it('shows several participating chopstick pairs and lifts real ingredients above the plate',()=>{
    const m=createYushengModel();expect(m.diners.length).toBeGreaterThanOrEqual(3);expect(m.food.length).toBeGreaterThan(40);
    m.pose(1,0);const before=m.food.map(o=>o.position.y);m.pose(2,0);
    expect(m.food.filter((o,i)=>o.position.y-before[i]!>.5).length).toBeGreaterThan(25);
    expect(m.food.some(o=>o.name.startsWith('fish-slice'))).toBe(true);cleanup(m);
  });
  it('gathers ingredients into the platter after tossing without leaving floating food',()=>{
    const m=createYushengModel();m.pose(3,0);
    const lowest=Math.min(...m.food.map(piece=>new THREE.Box3().setFromObject(piece).min.y));
    expect(lowest).toBeCloseTo(.238,6);
    for(const piece of m.food){const box=new THREE.Box3().setFromObject(piece);expect(box.min.y,piece.name).toBeGreaterThanOrEqual(.238-1e-5);expect(box.max.y,piece.name).toBeLessThan(.65);expect(Math.hypot(piece.position.x,piece.position.z),piece.name).toBeLessThan(1.1)}cleanup(m);
  });
  it('keeps the platter fixed and reuses geometry across the whole motion',()=>{
    const m=createYushengModel(),geometries=new Map<string,THREE.BufferGeometry>();m.root.traverse(o=>{if((o as THREE.Mesh).isMesh)geometries.set(o.name,(o as THREE.Mesh).geometry)});const plate=[...m.plate.matrixWorld.elements];
    for(let s=0;s<3;s++)for(let n=0;n<=20;n++){m.pose(s,n/20);expect(m.plate.matrixWorld.elements).toEqual(plate);m.root.traverse(o=>{if((o as THREE.Mesh).isMesh)expect((o as THREE.Mesh).geometry,o.name).toBe(geometries.get(o.name))})}cleanup(m);
  });
});
