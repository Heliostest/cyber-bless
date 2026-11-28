import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import {
  applyStylizedHumanSurfaceHint,
  createStylizedFingerGeometry,
  createStylizedForearmGeometry,
  createStylizedGarmentMaterial,
  createStylizedPalmGeometry,
  createStylizedSkinMaterial,
  createStylizedSleeveCuffGeometry,
  createStylizedThumbGeometry,
} from '@wbr/scene-runtime/stylized-human'
import * as THREE from 'three'
import { addSteppedPedestal } from '../cozy-furniture'

/** An original stone recumbent ox: no museum object's dimensions or surface art are copied. */
export function createNadeushiModel() {
  const root = new THREE.Group(); root.name = 'nadeushi-subject'; root.position.y = -.012
  const stone = new THREE.MeshStandardMaterial({ color: 0x6c8182, roughness: .88 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x384f54, roughness: .82 })
  const skin = createStylizedSkinMaterial({ color: 0xf0bc91, tone: 'warm-peach', roughness: .84, scatterStrength: .13, name: 'nadeushi-visitor-skin' })
  const cuff = createStylizedGarmentMaterial({ color: 0xd5ede3, roughness: .91, fabricStrength: .25, axis: 'z', name: 'nadeushi-visitor-cuff' })
  applyCraftSurface(stone,{kind:'stone',strength:.45})
  // Remove the degenerate pole triangles from sphere/lathe primitives before rendering.
  const clean = (source: THREE.BufferGeometry) => {
    const raw = source.index ? source.toNonIndexed() : source, p = raw.getAttribute('position'), values: number[] = []
    for (let i=0;i<p.count;i+=3) {
      const a = new THREE.Vector3().fromBufferAttribute(p,i), b = new THREE.Vector3().fromBufferAttribute(p,i+1), c = new THREE.Vector3().fromBufferAttribute(p,i+2)
      if (new THREE.Triangle(a,b,c).getArea() > 1e-12) values.push(...a.toArray(),...b.toArray(),...c.toArray())
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(values,3)); g.computeVertexNormals(); g.computeBoundingSphere()
    if (source !== raw) raw.dispose(); source.dispose(); return g
  }
  const mesh = (name:string, g:THREE.BufferGeometry, material:THREE.Material, parent:THREE.Object3D=root) => {
    const m = new THREE.Mesh(clean(g),material); m.name=name; m.castShadow=m.receiveShadow=true; parent.add(m); return m
  }
  const ellipsoid = (name:string,p:number[],s:number[],mat=stone,parent:THREE.Object3D=root) => {
    const m=mesh(name,new THREE.SphereGeometry(1,32,20),mat,parent); m.position.set(p[0]!,p[1]!,p[2]!); m.scale.set(s[0]!,s[1]!,s[2]!); return m
  }
  // Stepped stone plinth grounded at world y = -0.004 (local 0.008) with cap raised +5 mm to seat ox hooves flush at local 0.365.
  const pedestal = addSteppedPedestal(root, {
    name: 'stone-plinth',
    topName: 'plinth-cap',
    shape: 'rect',
    kind: 'stone',
    groundY: .008,
    surfaceY: .365,
    color: 0xb6bfae,
    trimColor: 0xa4ae9d,
    roughness: .95,
    surfaceStrength: .45,
    tiers: [
      { width: 2.98, depth: 1.46, height: .117, bevel: .014, color: 0xa4ae9d },
      { width: 2.86, depth: 1.36, height: .155, bevel: .018, color: 0xb6bfae },
      { width: 2.78, depth: 1.30, height: .085, bevel: .016, color: 0xc0c8b8 },
    ],
  }).root
  const ox=new THREE.Group();ox.name='recumbent-ox';root.add(ox)
  ellipsoid('ox-body',[.22,.75,0],[.86,.40,.44],stone,ox)
  ellipsoid('ox-haunch',[.82,.69,-.015],[.38,.31,.4],stone,ox)
  ellipsoid('ox-neck',[-.48,.98,.05],[.38,.43,.34],stone,ox)
  // The broad forehead remains directly accessible from the camera-facing side.
  const head=ellipsoid('ox-head',[-.85,1.29,.18],[.36,.30,.30],stone,ox)
  ellipsoid('ox-muzzle',[-1.10,1.10,.32],[.28,.19,.25],stone,ox)
  ellipsoid('lower-jaw',[-.96,.99,.27],[.30,.13,.23],stone,ox)
  for (const side of [-1,1]) {
    const z=side*.33
    ellipsoid('folded-front-leg-'+side,[-.43,.46,z],[.50,.105,.12],stone,ox)
    ellipsoid('front-hoof-'+side,[-.87,.45,z],[.17,.085,.13],stone,ox)
    ellipsoid('folded-hind-leg-'+side,[.66,.46,z],[.42,.105,.13],stone,ox)
    ellipsoid('hind-hoof-'+side,[.30,.45,z],[.16,.085,.12],stone,ox)
    const ear=ellipsoid('ox-ear-'+side,[-.56,1.38,.18+side*.31],[.18,.075,.10],stone,ox);ear.rotation.x=side*.32
    ellipsoid('eye-'+side,[-.99,1.33,.18+side*.255],[.044,.029,.022],dark,ox)
    ellipsoid('nostril-'+side,[-1.325,1.14,.32+side*.145],[.024,.026,.032],dark,ox)
    const points=[new THREE.Vector3(-.63,1.40,.18+side*.19),new THREE.Vector3(-.49,1.56,.18+side*.28),new THREE.Vector3(-.52,1.72,.18+side*.32)]
    const curve=new THREE.CatmullRomCurve3(points)
    const rings=18, radial=12, vertices:number[]=[],frames=curve.computeFrenetFrames(rings,false)
    const ring=(i:number,j:number)=>curve.getPoint(i/rings).addScaledVector(frames.normals[i]!,Math.cos(j/radial*Math.PI*2)*(.064*(1-i/(rings+1)))).addScaledVector(frames.binormals[i]!,Math.sin(j/radial*Math.PI*2)*(.064*(1-i/(rings+1))))
    const tri=(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3)=>vertices.push(...a.toArray(),...b.toArray(),...c.toArray())
    for(let i=0;i<rings;i++)for(let j=0;j<radial;j++){const k=(j+1)%radial;tri(ring(i,j),ring(i+1,k),ring(i+1,j));tri(ring(i,j),ring(i,k),ring(i+1,k))}
    for(let j=0;j<radial;j++){tri(points[0]!,ring(0,(j+1)%radial),ring(0,j));tri(points[2]!,ring(rings,j),ring(rings,(j+1)%radial))}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));mesh('horn-'+side,g,stone,ox)
  }
  const tailCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(.94,.87,-.3),new THREE.Vector3(1.14,.68,-.35),new THREE.Vector3(1.04,.44,-.22)])
  mesh('stone-tail',new THREE.TubeGeometry(tailCurve,24,.045,10,false),stone,ox)
  ellipsoid('tail-tip',[1.04,.44,-.22],[.09,.065,.065],stone,ox)

  const hand=new THREE.Group();hand.name='visitor-hand';root.add(hand)
  const addHumanPart=(name:string,g:THREE.BufferGeometry,mat:THREE.Material,role:'skin'|'garment')=>{
    const m=new THREE.Mesh(g,mat);m.name=name;m.castShadow=m.receiveShadow=true;applyStylizedHumanSurfaceHint(m,role);hand.add(m);return m
  }
  addHumanPart('palm',createStylizedPalmGeometry({
    width:.225,thickness:.078,length:.255,handedness:'right',palmUp:false,arch:.014,iterations:1,
  }),skin,'skin')
  const fingerLayout:[number,number,number,number,number,number][]=[
    // [x, zBase, length, radius, curl, splay] — gentle stroking fingers curving over the ox brow
    [-.076,-.108,.168,.024,.24,-.055],
    [-.026,-.120,.186,.025,.26,-.015],
    [.025,-.115,.172,.024,.28,.025],
    [.073,-.096,.134,.021,.30,.065],
  ]
  for(const [i,[x,zBase,len,r,curl,splay]] of fingerLayout.entries()){
    const f=addHumanPart('finger-'+i,createStylizedFingerGeometry({
      length:len,radiusX:r,radiusY:r*.94,curl,curlUp:false,splay,iterations:1,
    }),skin,'skin')
    f.position.set(x,-.004,zBase)
  }
  const thumb=addHumanPart('thumb',createStylizedThumbGeometry({
    length:.142,radiusX:.029,radiusY:.027,curl:.20,curlUp:false,opposition:.014,iterations:1,
  }),skin,'skin')
  thumb.position.set(-.102,-.007,.015)
  thumb.rotation.y=.42
  const wrist=addHumanPart('wrist',createStylizedForearmGeometry({
    length:.195,wristRadiusX:.070,wristRadiusY:.042,elbowRadiusX:.078,elbowRadiusY:.049,fullness:.04,iterations:1,
  }),skin,'skin')
  wrist.position.set(0,-.006,.105)
  const sleeveCuff=addHumanPart('sleeve-cuff',createStylizedSleeveCuffGeometry({
    length:.175,cuffRadiusX:.092,cuffRadiusY:.065,sleeveRadiusX:.108,sleeveRadiusY:.078,wallThickness:.014,rolledLip:.009,foldDepth:.005,cavityDepthRatio:.48,iterations:1,
  }),cuff,'garment')
  sleeveCuff.position.set(0,-.006,.225)
  const rest=new THREE.Vector3(-.9,.78,.91)
  hand.updateMatrixWorld(true)
  const handVertexMap=new Map<string,THREE.Vector3>(),handInverse=hand.matrixWorld.clone().invert()
  hand.traverse(o=>{const m=o as THREE.Mesh;if(!m.geometry)return;const p=m.geometry.getAttribute('position');for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld).applyMatrix4(handInverse);handVertexMap.set(v.toArray().join(','),v)}})
  const handVertices=[...handVertexMap.values()]
  // Solve the height for the whole hand, including fingertips, against the forehead.
  // The approach goes above the stone first; a diagonal path would cut through it.
  const contact=(t:number)=>{
    const x=-.97+.24*THREE.MathUtils.clamp(t,0,1),z=.36;let y=1.40
    for(const p of handVertices){const horizontal=((x+p.x+.85)/.36)**2+((z+p.z-.18)/.30)**2;if(horizontal<1)y=Math.max(y,1.29+.30*Math.sqrt(1-horizontal)-p.y+.002)}
    return new THREE.Vector3(x,y,z)
  }
  const firstContact=contact(0),lastContact=contact(1)
  const pose=(step:number,amount:number)=>{
    const t=THREE.MathUtils.clamp(amount,0,1)
    if(step===0){
      if(t<.35)hand.position.set(rest.x,THREE.MathUtils.lerp(rest.y,1.90,t/.35),rest.z)
      else if(t<.8)hand.position.lerpVectors(new THREE.Vector3(rest.x,1.90,rest.z),new THREE.Vector3(firstContact.x,1.90,firstContact.z),(t-.35)/.45)
      else hand.position.lerpVectors(new THREE.Vector3(firstContact.x,1.90,firstContact.z),firstContact,(t-.8)/.2)
    }
    else if(step===1)hand.position.copy(contact(t))
    else if(step===2){
      if(t<.2)hand.position.lerpVectors(lastContact,new THREE.Vector3(lastContact.x,1.90,lastContact.z),t/.2)
      else if(t<.65)hand.position.lerpVectors(new THREE.Vector3(lastContact.x,1.90,lastContact.z),new THREE.Vector3(rest.x,1.90,rest.z),(t-.2)/.45)
      else hand.position.set(rest.x,THREE.MathUtils.lerp(1.90,rest.y,(t-.65)/.35),rest.z)
    }
    else hand.position.copy(rest)
    root.updateMatrixWorld(true)
  }
  pose(0,0)
  return {root,ox,head,hand,pedestal,contact,pose,targets:[hand,head,hand],roots:[hand,head,hand],anchors:[[0,0,0],[0,.05,.99],[0,0,0]] as [number,number,number][],dispose(){}}
}
