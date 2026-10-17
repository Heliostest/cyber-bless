import * as THREE from 'three'

const PROFILE = [[0,.34],[.06,.43],[.18,.52],[.38,.58],[.60,.60],[.82,.57],[1.02,.526],[1.20,.475],[1.40,.36],[1.52,.325],[1.66,.38],[1.84,.395],[2,.33],[2.12,.23],[2.18,.12],[2.20,0]]
function radius(y:number){
  for(let i=1;i<PROFILE.length;i++){const [hi,r]=PROFILE[i]!,[lo,last]=PROFILE[i-1]!;if(y<=hi!)return THREE.MathUtils.lerp(last!,r!,THREE.MathUtils.clamp((y-lo!)/(hi!-lo!),0,1))}
  return 0
}
const sample=(from:number,to:number,n:number,inside=false)=>Array.from({length:n+1},(_,i)=>{const y=THREE.MathUtils.lerp(from,to,i/n);return [inside?Math.max(0,radius(y)-.065):radius(y),y]})
const smooth=(n:number,a:number,b:number)=>THREE.MathUtils.smoothstep(n,a,b)

/** Original painted wood, genuine hollow shells, and assisted clearance-preserving paths. */
export function createMatryoshkaModel(){
  const subject=new THREE.Group();subject.name='matryoshka-subject'
  const materials=new Map<number,THREE.MeshStandardMaterial>()
  const paint=(color:number)=>{if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.51}));return materials.get(color)!}
  const wood=new THREE.MeshStandardMaterial({color:0xc9a275,roughness:.91})
  const endWood=new THREE.MeshStandardMaterial({color:0xe3bf87,roughness:.86})
  const add=(parent:THREE.Object3D,name:string,g:THREE.BufferGeometry,mat:THREE.Material|THREE.Material[])=>{
    const mesh=new THREE.Mesh(g,mat);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh
  }
  function lathe(name:string,points:number[][],parent:THREE.Object3D,outerSegments:number,base:number,scarf:number){
    const g=new THREE.LatheGeometry(points.map(([r,y])=>new THREE.Vector2(r,y)),64),index=g.getIndex()!,buckets:number[][]=[[],[],[],[]]
    const vertices=g.getAttribute('position')
    for(let j=0;j<points.length;j++)vertices.setXYZ(64*points.length+j,vertices.getX(j),vertices.getY(j),vertices.getZ(j))
    for(let i=0;i<64;i++)for(let j=0;j<points.length-1;j++){
      const y=(points[j]![1]!+points[j+1]![1]!)/2,slot=j<outerSegments?(y>1.44?1:0):j===outerSegments||j===points.length-2?3:2,start=(i*(points.length-1)+j)*6
      for(let k=0;k<6;k++)buckets[slot]!.push(index.getX(start+k))
    }
    g.clearGroups();g.setIndex(buckets.flat());let offset=0
    buckets.forEach((b,i)=>{g.addGroup(offset,b.length,i);offset+=b.length})
    return add(parent,name,g,[paint(base),paint(scarf),wood,endWood])
  }
  // Every ornament follows the lathed surface instead of floating on a front-facing plane.
  function oval(parent:THREE.Object3D,name:string,theta:number,y:number,rx:number,ry:number,color:number,offset=.004){
    const positions:number[]=[],indices:number[]=[],rings=10,segments=48
    for(let j=0;j<=rings;j++)for(let k=0;k<=segments;k++){
      const a=k/segments*Math.PI*2,angle=theta+rx*j/rings*Math.cos(a),height=y+ry*j/rings*Math.sin(a),r=radius(height)+offset
      positions.push(r*Math.sin(angle),height,r*Math.cos(angle))
    }
    for(let j=0;j<rings;j++)for(let k=0;k<segments;k++){
      const a=j*(segments+1)+k,b=a+segments+1;indices.push(a,b,b+1,a,b+1,a+1)
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals()
    const mesh=add(parent,name,g,paint(color));mesh.castShadow=false;mesh.userData.toonSurface={outline:false};return mesh
  }
  function decorations(parent:THREE.Object3D,prefix:string,part:'upper'|'lower'|'whole',accent:number){
    if(part!=='lower'){
      oval(parent,prefix+'-face-border',0,1.81,.66,.275,0x914d38,.004)
      oval(parent,prefix+'-face',0,1.81,.62,.261,0xf4d7a3,.007)
      for(const sign of [-1,1]){
        oval(parent,prefix+'-eye-'+sign,sign*.25,1.84,.032,.040,0x413c38,.011)
        oval(parent,prefix+'-cheek-'+sign,sign*.36,1.73,.115,.033,0xd88d70,.011)
      }
      oval(parent,prefix+'-mouth',0,1.67,.11,.022,0xad614a,.011)
      oval(parent,prefix+'-scarf-knot',0,1.48,.13,.07,accent,.007)
      for(let i=0;i<7;i++)oval(parent,prefix+'-scarf-dot-'+i,(i-3)*.45,2.01-Math.abs(i-3)*.08,.035,.025,0xf6d88d,.007)
    }
    if(part!=='upper'){
      oval(parent,prefix+'-apron-border',0,.55,.76,.415,0xe4b35e,.004)
      oval(parent,prefix+'-apron',0,.55,.70,.385,0xf0ddb0,.007)
      oval(parent,prefix+'-stem',0,.51,.023,.215,0x507859,.012)
      for(const sign of [-1,1])oval(parent,prefix+'-leaf-'+sign,sign*.21,.43,.19,.06,0x6c9270,.014)
      for(let i=0;i<5;i++){const a=i*Math.PI*2/5;oval(parent,prefix+'-petal-'+i,.19*Math.cos(a),.69+.105*Math.sin(a),.18,.10,accent,.017)}
      oval(parent,prefix+'-flower-heart',0,.69,.12,.065,0xe9b85b,.021)
    }
  }
  const lower=new THREE.Group();lower.name='matryoshka-lower';subject.add(lower)
  const bottom=[[0,0],[.34,0],...sample(.015,1.02,48),[.464,1.02],[.464,1.09],[.441,1.09],...sample(1.01,.18,40,true),[.32,.10],[0,.10],[0,0]]
  lathe('matryoshka-lower-shell',bottom,lower,50,0x378c91,0xca644b)
  decorations(lower,'matryoshka-large','lower',0xcf7055)
  const upper=new THREE.Group();upper.name='matryoshka-upper';subject.add(upper)
  const top=[...sample(1.04,2.20,58),[0,2.13],...sample(2.125,1.16,49,true),[.474,1.10],[.474,1.04],[radius(1.04),1.04]]
  const upperShell=lathe('matryoshka-upper-shell',top,upper,58,0x378c91,0xca644b)
  decorations(upper,'matryoshka-large','upper',0xe5ba66)
  const small=new THREE.Group();small.name='matryoshka-small';small.scale.setScalar(.50);subject.add(small)
  const smallProfile=[[0,0],[.34,0],...sample(.015,2.20,90)]
  const smallShell=lathe('matryoshka-small-shell',smallProfile,small,smallProfile.length,0x78a280,0xe4b052)
  decorations(small,'matryoshka-small','whole',0x64949b)
  // A low felt pad protects the painted wood; no display furniture.
  const pad=add(subject,'matryoshka-pad',new THREE.CylinderGeometry(1,1,.025,64),new THREE.MeshStandardMaterial({color:0xa5b7aa,roughness:1}))
  pad.scale.set(2.15,1,.78);pad.position.set(-.28,-.0125,0)
  function pose(step:number,amount:number){
    const at=THREE.MathUtils.clamp(step,0,3),n=at===3?0:THREE.MathUtils.clamp(amount,0,1)
    upper.position.set(0,0,0);small.position.set(1.15,0,0)
    if(at>=1)upper.position.set(-1.55,-1.04,0)
    if(at>=2)small.position.set(0,.10,0)
    if(at===0){
      upper.position.x=-1.55*smooth(n,.22,.65)
      upper.position.y=.30*smooth(n,0,.22)-1.34*smooth(n,.65,1)
    }else if(at===1){
      small.position.x=1.15*(1-smooth(n,.30,.65))
      small.position.y=1.20*smooth(n,0,.30)-1.10*smooth(n,.65,1)
    }else if(at===2){
      upper.position.x=-1.55*(1-smooth(n,.35,.70))
      upper.position.y=-1.04+1.34*smooth(n,0,.35)-.30*smooth(n,.70,1)
    }else upper.position.set(0,0,0)
    subject.updateMatrixWorld(true)
  }
  pose(0,0)
  return {subject,pose,targets:[upperShell,smallShell,upperShell],roots:[upper,small,upper],anchors:[[.04,2.17,.125],[.28,1.30,.35],[.04,2.17,.125]] as [number,number,number][]}
}
