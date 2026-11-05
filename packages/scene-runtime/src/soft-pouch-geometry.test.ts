import { expect, it } from 'vitest';
import * as THREE from 'three';
import { puffPouchGeometry } from './soft-pouch-geometry';

it('keeps subdivided cap boundaries coincident with the original closed bevel', () => {
  const points=[[-.22,-.34],[.22,-.34],[.23,.2],[.15,.34],[-.15,.34],[-.23,.2]];
  const shape=new THREE.Shape(points.map(([x,y])=>new THREE.Vector2(x,y)));
  const source=new THREE.ExtrudeGeometry(shape,{depth:.17,bevelEnabled:true,bevelSize:.02,bevelThickness:.025,bevelSegments:3,steps:1}); source.translate(0,0,-.085);
  const geometry=puffPouchGeometry(source), p=geometry.getAttribute('position'), n=geometry.getAttribute('normal'); let checked=0;
  for(let i=0;i<p.count;i++){
    if(Math.abs(p.getZ(i))<.1)continue;
    const x=p.getX(i),y=p.getY(i);
    for(let j=0;j<points.length;j++){
      const a=new THREE.Vector2(...points[j]),b=new THREE.Vector2(...points[(j+1)%points.length]),q=new THREE.Vector2(x,y),edge=b.clone().sub(a);
      const t=q.clone().sub(a).dot(edge)/edge.lengthSq();
      if(t<-.00001||t>1.00001||q.distanceTo(a.addScaledVector(edge,t))>1e-6)continue;
      expect(Math.abs(p.getZ(i))).toBeCloseTo(.11,6); checked++; break;
    }
  }
  expect(checked).toBeGreaterThan(30); geometry.computeBoundingBox(); expect(geometry.boundingBox!.max.z).toBeGreaterThan(.12);
  geometry.dispose(); source.dispose();
});
