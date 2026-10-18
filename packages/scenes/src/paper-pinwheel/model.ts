import * as THREE from 'three'

/** Original pre-bent paper toy with assisted rotation; no airflow or folding solver. */
export function createPinwheelModel(){
  const root=new THREE.Group();root.name='pinwheel-subject'
  const wood=new THREE.MeshStandardMaterial({color:'#b9966c',roughness:.86}),metal=new THREE.MeshStandardMaterial({color:'#a98450',metalness:.55,roughness:.5}),coral=new THREE.MeshStandardMaterial({color:'#e5947a',roughness:.95}),teal=new THREE.MeshStandardMaterial({color:'#6bbcaf',roughness:.95}),paper=new THREE.MeshStandardMaterial({color:'#e7c17d',roughness:.95}),ivory=new THREE.MeshStandardMaterial({color:'#ece1c7',roughness:.65})
  const mesh=(name:string,g:THREE.BufferGeometry,material:THREE.Material,parent:THREE.Object3D=root)=>{const o=new THREE.Mesh(g,material);o.name=name;o.castShadow=o.receiveShadow=true;parent.add(o);return o}
  const geometry=(v:number[],indices:number[])=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex(indices);g.computeVertexNormals();return g}
  const ring=()=>{const n=48,v:number[]=[],a:number[]=[];for(const [r,z]of[[.14,0],[.14,.30],[.047,0],[.047,.30]])for(let i=0;i<n;i++){const t=i*2*Math.PI/n;v.push(r!*Math.cos(t),r!*Math.sin(t),z!)}const quad=(i:number,j:number,k:number,l:number)=>a.push(i,j,k,i,k,l);for(let i=0;i<n;i++){const j=(i+1)%n;quad(i,j,n+j,n+i);quad(2*n+i,3*n+i,3*n+j,2*n+j);quad(n+i,n+j,3*n+j,3*n+i);quad(i,2*n+i,2*n+j,j)}return geometry(v,a)}
  const vane=()=>{const nu=12,nv=20,v:number[]=[],a:number[]=[],n=(nu+1)*(nv+1);for(const sign of[1,-1])for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){const u=i/nu,w=j/nv;v.push(.07+.81*w,(.015+.03*u)*(1-w)+(.015+.72*u)*w,.045+.17*u*(1-w)+.2*Math.sin(Math.PI*w)*u+sign*.009)}for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const k=j*(nu+1)+i,b=k+nu+1,c=b+1,d=k+1;a.push(k,b,c,k,c,d,k+n,c+n,b+n,k+n,d+n,c+n)}const boundary:number[]=[];for(let j=0;j<=nv;j++)boundary.push(j*(nu+1));for(let i=1;i<=nu;i++)boundary.push(nv*(nu+1)+i);for(let j=nv-1;j>=0;j--)boundary.push(j*(nu+1)+nu);for(let i=nu-1;i>=1;i--)boundary.push(i);for(let i=0;i<boundary.length;i++){const x=boundary[i]!,y=boundary[(i+1)%boundary.length]!;const first=v.length/3;for(const index of[x,x+n,y+n,y])v.push(v[index*3]!,v[index*3+1]!,v[index*3+2]!);a.push(first,first+1,first+2,first,first+2,first+3)}return geometry(v,a)}
  const handle=mesh('pinwheel-handle',new THREE.CylinderGeometry(.05,.05,1.8,32).translate(0,.95,-.1),wood)
  const pin=mesh('pinwheel-pin',new THREE.CylinderGeometry(.025,.025,.60,24).rotateX(Math.PI/2).translate(0,1.85,.12),metal)
  const rearBead=mesh('pinwheel-rear-bead',new THREE.SphereGeometry(.07,24,16).translate(0,1.85,-.085),teal)
  const frontBead=mesh('pinwheel-front-bead',new THREE.SphereGeometry(.07,24,16).translate(0,1.85,.375),ivory)
  const rotor=new THREE.Group();rotor.name='pinwheel-rotor';rotor.position.y=1.85;root.add(rotor)
  const hub=mesh('pinwheel-hub',ring(),paper,rotor)
  const blades=Array.from({length:4},(_,i)=>mesh('pinwheel-vane-'+i,vane().rotateZ(i*Math.PI/2),i%2===0?coral:teal,rotor))
  function pose(step:number,n:number){const t=THREE.MathUtils.clamp(Number.isFinite(n)?n:0,0,1);const angle=step===0?Math.PI*2*t:step===1?Math.PI*2+Math.PI*2*t:step===2?Math.PI*4+Math.PI*(1-(1-t)**3):Math.PI*4+Math.PI;const lift=step===0?0:step===1?.18*t:.18;root.position.y=lift===0?0:lift;rotor.rotation.z=angle===0?0:angle;root.updateMatrixWorld(true)}
  pose(0,0)
  return{root,subject:root,rotor,handle,pin,rearBead,frontBead,hub,blades,pose,targets:[blades[0],handle,blades[0]],roots:[blades[0],handle,blades[0]],anchors:[[.556,.1038,.107],[0,.4,-.049],[.556,.1038,.107]] as [number,number,number][]}
}
