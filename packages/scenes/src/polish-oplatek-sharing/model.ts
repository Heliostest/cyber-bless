import { getEnvironmentSurfaceY } from '@wbr/scene-runtime'
import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { addObjectCradle, addOfferingTable } from '../cozy-furniture'

// An original wafer and one complementary corner. The relief and fracture are
// product geometry, not a reproduction of a particular family or sacred image.
export const fracture: [number, number][] = [[.12,-.7],[.2,-.66],[.23,-.59],[.31,-.55],[.35,-.47],[.43,-.43],[.47,-.35],[.55,-.3]]
export const mainOutline: [number, number][] = [[-.55,-.7],...fracture,[.55,.7],[-.55,.7]]
export const pieceOutline: [number, number][] = [...fracture.slice().reverse(),[.55,-.7]]
const clamp = THREE.MathUtils.clamp
const smooth = (n: number) => { const t=clamp(n,0,1); return t*t*(3-2*t) }

function dedupeNames(root: THREE.Object3D) {
  const seen = new Map<string, number>()
  root.traverse(o => {
    const n = seen.get(o.name) ?? 0
    seen.set(o.name, n + 1)
    if (n > 0) o.name = `${o.name}-${n}`
  })
}

function limbGeometry(profile: [number, number][], sx: number, sy: number, segments = 24) {
  const g = new THREE.LatheGeometry(profile.map(([r, z]) => new THREE.Vector2(r, z)), segments)
  g.rotateX(Math.PI / 2)
  g.scale(sx, sy, 1)
  g.computeVertexNormals()
  g.computeBoundingBox()
  return g
}

export function createOplatekModel() {
  const root=new THREE.Group();root.name='oplatek-subject'
  const GROUND_Y=getEnvironmentSurfaceY('polish-oplatek-sharing')
  // Festive wooden dining table and cream woven linen runner grounded cleanly at +0.0175 (product staging only).
  const tableBuild=addOfferingTable(root,{
    name:'oplatek-table',
    topName:'oplatek-table-top',
    width:3.10,
    depth:2.20,
    surfaceY:.86,
    thickness:.085,
    center:[.15,-.38],
    groundY:GROUND_Y,
    finish:'honey',
    color:0xb0804f,
    frameColor:0x825a38,
    planks:4,
    breadboardEnds:true,
    legThickness:.13,
    legInset:.14,
    apron:true,
    stretchers:true,
    bevel:.018,
  })
  const runnerBuild=addObjectCradle(root,{
    name:'oplatek-linen-runner',
    topName:'oplatek-linen-runner-top',
    width:2.56,
    depth:1.12,
    center:[.15,-.38],
    groundY:.86,
    surfaceY:.884,
    style:'pad',
    kind:'fabric',
    color:0xeae0cc,
    bevel:.009,
    roughness:.95,
    surfaceScale:1.5,
    surfaceStrength:.36,
  })
  const runnerHemMat=applyCraftSurface(new THREE.MeshStandardMaterial({color:0xdacdb4,roughness:.95}),{kind:'fabric',strength:.34,scale:1.5})
  for(const [idx,sz] of ([-1,1] as const).entries()){
    const hem=new THREE.Mesh(new RoundedBoxGeometry(2.50,.005,.040,2,.002),runnerHemMat)
    hem.name=`oplatek-linen-hem-${idx}`
    hem.position.set(0,.884-.86+.001,sz*.47)
    hem.castShadow=hem.receiveShadow=true
    runnerBuild.root.add(hem)
  }
  for(const stand of [tableBuild.root,runnerBuild.root]){
    dedupeNames(stand)
    stand.traverse(o=>{if((o as THREE.Mesh).isMesh)o.userData.intentionalCrop=true})
  }
  const table=tableBuild.root,runner=runnerBuild.root
  const holder=new THREE.Group();holder.name='oplatek-holder';root.add(holder)
  const waferBody=new THREE.Group();waferBody.name='oplatek-wafer-body';holder.add(waferBody)
  const recipient=new THREE.Group();recipient.name='oplatek-recipient';root.add(recipient)
  const pieceCarrier=new THREE.Group();pieceCarrier.name='oplatek-piece-carrier';root.add(pieceCarrier)
  const wafer=new THREE.MeshStandardMaterial({color:0xfff2d5,roughness:.91})
  const relief=new THREE.MeshStandardMaterial({color:0xf4e2bd,roughness:.92})
  const skinA=new THREE.MeshStandardMaterial({color:0xe7ac7c,roughness:.86})
  const skinB=new THREE.MeshStandardMaterial({color:0xbb7956,roughness:.86})
  const clothA=new THREE.MeshStandardMaterial({color:0x6b9496,roughness:.98})
  const clothB=new THREE.MeshStandardMaterial({color:0xb25e59,roughness:.98})
  for(const sleeve of[clothA,clothB])applyCraftSurface(sleeve,{kind:'fabric',strength:.25})
  function solid(points: [number,number][],depth:number,material:THREE.Material,name:string) {
    const shape=new THREE.Shape();points.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath()
    const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,steps:1});geometry.rotateX(-Math.PI/2);geometry.translate(0,-depth/2,0)
    const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;return mesh
  }
  const main=solid(mainOutline,.03,wafer,'oplatek-main');waferBody.add(main)
  const piece=solid(pieceOutline,.03,wafer,'oplatek-piece');pieceCarrier.add(piece)
  // Small closed embossed ribs and a star, on the unbroken central part.
  const star: [number,number][] = Array.from({length:16},(_,i)=>{const a=i*Math.PI/8, r=i%2?.045:i%4===0?.18:.10;return [Math.cos(a)*r,Math.sin(a)*r-.25]})
  const emblem=solid(star,.008,relief,'oplatek-star');emblem.position.y=.019;waferBody.add(emblem)
  function box(parent:THREE.Object3D,name:string,size:[number,number,number],position:[number,number,number],material:THREE.Material,crop=false) {
    const m=new THREE.Mesh(new THREE.BoxGeometry(...size),material);m.name=name;m.position.set(...position);m.castShadow=m.receiveShadow=true;m.userData.intentionalCrop=crop;parent.add(m);return m
  }
  function rounded(parent:THREE.Object3D,name:string,size:[number,number,number],position:[number,number,number],material:THREE.Material,bevel:number,crop=false) {
    const r=Math.max(.002,Math.min(bevel,size[0]*.42,size[1]*.42,size[2]*.42))
    const m=new THREE.Mesh(new RoundedBoxGeometry(size[0],size[1],size[2],3,r),material)
    m.name=name;m.position.set(...position);m.castShadow=m.receiveShadow=true;m.userData.intentionalCrop=crop;parent.add(m);return m
  }
  function part(parent:THREE.Object3D,name:string,geometry:THREE.BufferGeometry,position:[number,number,number],material:THREE.Material,crop=false) {
    const m=new THREE.Mesh(geometry,material);m.name=name;m.position.set(...position);m.castShadow=m.receiveShadow=true;m.userData.intentionalCrop=crop;parent.add(m);return m
  }
  for(const x of [-.49,.49])box(waferBody,'oplatek-rim-x-'+x,[.012,.006,x<0?1.14:.78],[x,.018,x<0?.06:.24],relief)
  for(const z of [-.64,.64])box(waferBody,'oplatek-rim-z-'+z,[z<0?.56:.98,.006,.012],[z<0?-.21:0,.018,z],relief)
  for(let i=0;i<3;i++)box(waferBody,'oplatek-line-'+i,[.38,.003,.006],[-.08,.0165,.19+i*.055],relief)
  function hand(parent:THREE.Group,label:string,skin:THREE.Material,cloth:THREE.Material,scale:number,yaw:number,center:[number,number,number]) {
    const g=new THREE.Group();g.name='oplatek-'+label+'-hand';g.position.set(...center);g.rotation.y=yaw;parent.add(g)
    // Smooth rounded palm and fingers meet the wafer underside cleanly at y = -0.015;
    // wrist, forearm, and sleeve stay strictly below y = -0.015 so they never pierce the wafer.
    const palmW=.43*scale,palmH=.086,palmD=.34*scale
    rounded(g,'oplatek-'+label+'-palm',[palmW,palmH,palmD],[0,-.015-palmH/2,0],skin,.024)
    for(let i=0;i<4;i++){
      const length=(i===0?.21:i===3?.22:.26)*scale
      const fingerW=.076*scale,fingerH=.068
      const finger=rounded(g,'oplatek-'+label+'-finger-'+i,[fingerW,fingerH,length],[(i-1.5)*.095*scale,-.015-fingerH/2,-palmD*.45-length/2],skin,.024)
      finger.rotation.y=(i-1.5)*.035
    }
    const thumbH=.068
    const thumb=rounded(g,'oplatek-'+label+'-thumb',[.086*scale,thumbH,.30*scale],[-.30*scale,-.015-thumbH/2,.03*scale],skin,.024)
    thumb.rotation.y=-.70
    const wristGeo=limbGeometry([
      [0,0],[.94,0],[1.0,.04*scale],[.90,.16*scale],[.85,.28*scale],[0,.28*scale],
    ],.132*scale,.043)
    part(g,'oplatek-'+label+'-wrist',wristGeo,[0,-.060,.10*scale],skin)
    const forearmGeo=limbGeometry([
      [0,0],[.84,0],[.86,.05*scale],[.92,.32*scale],[1.0,.62*scale],[0,.62*scale],
    ],.134*scale,.050)
    part(g,'oplatek-'+label+'-forearm',forearmGeo,[0,-.067,.28*scale],skin,true)
    const sleeveGeo=limbGeometry([
      [0,0],[.86,0],[.93,.025*scale],[.89,.065*scale],[.96,.44*scale],[1.0,.94*scale],[0,.94*scale],
    ],.176*scale,.068)
    part(g,'oplatek-'+label+'-sleeve',sleeveGeo,[0,-.085,.80*scale],cloth,true)
    return g
  }
  const holderHand=hand(holder,'giver',skinA,clothA,1.15,0,[-.15,0,.23])
  const recipientHand=hand(recipient,'receiver',skinB,clothB,.96,Math.PI*.75,[.47,0,-.56])
  function pose(step:number,n:number,_update=true) {
    if(n>=1&&step<3){pose(step+1,0,_update);return}
    const t=clamp(n,0,1),offer=step>0?1:smooth(t),reach=step>1?1:step===1?smooth(t/.38):0
    const breakOff=step>1?1:step===1?smooth((t-.42)/.58):0,away=step>2?1:step===2?smooth(t):0
    holder.position.set(-.12,1.35+.18*offer,.18-.28*offer)
    // Clear the main wafer horizontally before lifting the receiving fingers.
    const lift=.08*smooth((breakOff-.92)/.08)+.06*away
    pieceCarrier.position.copy(holder.position).add(new THREE.Vector3(.18*breakOff+.22*away,lift,-.13*breakOff-.30*away))
    recipient.position.copy(holder.position).add(new THREE.Vector3(.80*(1-reach)+.18*breakOff+.22*away,-.16*(1-reach)+lift,-.70*(1-reach)-.13*breakOff-.30*away))
    if(_update)root.updateMatrixWorld(true)
  }
  pose(0,0)
  return {root,table,runner,holder,recipient,main,piece,pieceCarrier,holderHand,recipientHand,pose,tick(_dt:number){},targets:[main,main,piece],roots:[waferBody,waferBody,piece],anchors:[new THREE.Vector3(-.25,.015,0),new THREE.Vector3(-.25,.015,0),new THREE.Vector3(.44,.015,-.59)]}
}
