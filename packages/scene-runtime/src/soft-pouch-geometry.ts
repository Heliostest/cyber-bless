import * as THREE from 'three';

/** Give the existing closed pouch soft fullness without changing its outline. */
export function puffPouchGeometry(source: THREE.BufferGeometry) {
  const data = source.index ? source.toNonIndexed() : source;
  const positions = data.getAttribute('position'), normals = data.getAttribute('normal');
  const attributes = Object.entries(data.attributes);
  const arrays = attributes.map(() => [] as number[]);
  const cap = (ids: number[]) => ids.every(index => Math.abs(normals.getZ(index)) > .99999);
  const edges = new Map<string, {a: number[]; b: number[]; count: number}>();
  for (let i=0;i<positions.count;i+=3) {
    const ids=[i,i+1,i+2]; if(!ids.every(index=>normals.getZ(index)>.99999))continue;
    for(let j=0;j<3;j++){
      const a=[positions.getX(ids[j]),positions.getY(ids[j])], b=[positions.getX(ids[(j+1)%3]),positions.getY(ids[(j+1)%3])];
      const key=[a.map(n=>n.toFixed(7)).join(','),b.map(n=>n.toFixed(7)).join(',')].sort().join('|');
      const edge=edges.get(key); if(edge)edge.count++;else edges.set(key,{a,b,count:1});
    }
  }
  const boundary=[...edges.values()].filter(edge=>edge.count===1).map(({a,b})=>{
    const dx=b[0]-a[0],dy=b[1]-a[1];return [-dy,dx,dy*a[0]-dx*a[1]];
  });
  const height=(x:number,y:number)=>{
    let product=1;
    for(const [a,b,c] of boundary){ if(Math.abs(c)<1e-9)continue;const factor=(a*x+b*y+c)/c;if(factor<=0)return 0;product*=factor }
    const square=product*product;return boundary.length ? .052*square/(1+square) : 0;
  };
  const emit = (ids: number[], bary: number[]) => {
    const values = attributes.map(([_, attribute]) => Array.from({ length: attribute.itemSize }, (_, k) =>
      ids.reduce((sum, index, i) => sum + attribute.array[index * attribute.itemSize + k] * bary[i], 0)));
    const p = values[attributes.findIndex(([name]) => name === 'position')];
    const n = values[attributes.findIndex(([name]) => name === 'normal')];
    const x = p[0], y = p[1], side = Math.sign(p[2]);
    if (cap(ids)) {
      // Both displacement and its derivative vanish on the actual cap edge.
      // The original bevel stays coincident even though only caps subdivide.
      p[2] += side * height(x,y);
      const e=.0001, hx=(height(x+e,y)-height(x-e,y))/(2*e),hy=(height(x,y+e)-height(x,y-e))/(2*e);
      const normal = new THREE.Vector3(-hx,-hy,side).normalize();
      n.splice(0, 3, normal.x, normal.y, normal.z);
    }
    values.forEach((value, i) => arrays[i].push(...value));
  };
  const split = (ids: number[], a: number[], b: number[], c: number[], depth: number) => {
    if (!depth) { emit(ids, a); emit(ids, b); emit(ids, c); return; }
    const midpoint = (p: number[], q: number[]) => p.map((value, i) => (value + q[i]) / 2);
    const ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);
    split(ids, a, ab, ca, depth - 1); split(ids, ab, b, bc, depth - 1);
    split(ids, ca, bc, c, depth - 1); split(ids, ab, bc, ca, depth - 1);
  };
  for (let i = 0; i < positions.count; i += 3) {
    const isCap = cap([i,i+1,i+2]);
    split([i, i + 1, i + 2], [1, 0, 0], [0, 1, 0], [0, 0, 1], isCap ? 3 : 0);
  }
  const geometry = new THREE.BufferGeometry();
  attributes.forEach(([name, attribute], i) => geometry.setAttribute(name, new THREE.Float32BufferAttribute(arrays[i], attribute.itemSize)));
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  geometry.userData.iconPouchFullness = true;
  if (data !== source) data.dispose();
  return geometry;
}
