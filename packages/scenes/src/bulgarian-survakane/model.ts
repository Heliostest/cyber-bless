import { getEnvironmentSurfaceY } from '@wbr/scene-runtime'
import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import {
  applyStylizedHumanSurfaceHint,
  createStylizedFingerGeometry,
  createStylizedGarmentMaterial,
  createStylizedHairGeometry,
  createStylizedHeadGeometry,
  createStylizedLimbGeometry,
  createStylizedPalmGeometry,
  createStylizedShoeGeometry,
  createStylizedSkinMaterial,
  createStylizedSleeveCuffGeometry,
  createStylizedThumbGeometry,
  createStylizedTorsoGeometry,
  subdivideClosedCage,
} from '@wbr/scene-runtime/stylized-human'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { addSteppedPedestal } from '../cozy-furniture'

function dedupeNames(root: THREE.Object3D) {
  const seen = new Map<string, number>()
  root.traverse(o => {
    const n = seen.get(o.name) ?? 0
    seen.set(o.name, n + 1)
    if (n > 0) o.name = `${o.name}-${n}`
  })
}

const smooth = (x: number) => {
  const t = THREE.MathUtils.clamp(x, 0, 1)
  return t * t * (3 - 2 * t)
}

/** Cornel branch, looped twigs and a seated relative. Geometry is an illustrative composition. */
export function createSurvakaneModel() {
  const root=new THREE.Group();root.name='surva-root'
  const subject=new THREE.Group();subject.name='surva-subject';root.add(subject)
  const GROUND_Y=getEnvironmentSurfaceY('bulgarian-survakane')
  const mat=(color:number,roughness=.85)=>new THREE.MeshStandardMaterial({color,roughness})
  const bark=mat(0x936038),wood=mat(0xba8652),legWood=mat(0x9e6d40),sideWood=mat(0xa87647),standWood=mat(0xb27e4c)
  const coat=createStylizedGarmentMaterial({color:0x4e8791,roughness:.92,fabricStrength:.30,name:'surva-coat'})
  const vestTrim=createStylizedGarmentMaterial({color:0xa95149,roughness:.92,fabricStrength:.32,name:'surva-vest-trim'})
  const cloth=createStylizedGarmentMaterial({color:0x385b6a,roughness:.93,fabricStrength:.28,name:'surva-trousers'})
  const skin=createStylizedSkinMaterial({color:0xe2b38a,roughness:.86,scatterStrength:.12,name:'surva-skin'})
  const hair=new THREE.MeshStandardMaterial({color:0xe3dcc8,roughness:.85,vertexColors:true})
  const shoe=new THREE.MeshStandardMaterial({color:0x625344,roughness:.88,vertexColors:true})
  const red=mat(0xc65e55),gold=mat(0xe7ba64),cream=mat(0xf2e5bc),green=mat(0x648b62),thread=mat(0xbfa97b)
  applyCraftSurface(wood,{kind:'wood',strength:.4,axis:'x'})
  applyCraftSurface(legWood,{kind:'wood',strength:.42,axis:'y'})
  applyCraftSurface(sideWood,{kind:'wood',strength:.40,axis:'z'})
  applyCraftSurface(standWood,{kind:'wood',strength:.40,axis:'x'})
  ;[red,gold,green,thread].forEach(material=>applyCraftSurface(material,{kind:'cord',strength:.3}))
  const mesh=(g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D,name:string)=>{const o=new THREE.Mesh(g,m);o.name=name;o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
  const roundedBox=(name:string,size:[number,number,number],p:[number,number,number],m:THREE.Material,parent:THREE.Object3D=subject,bevel=.012)=>{
    const r=Math.max(.002,Math.min(bevel,size[0]/3,size[1]/3,size[2]/3))
    const o=mesh(new RoundedBoxGeometry(size[0],size[1],size[2],2,r),m,parent,name)
    o.position.set(...p)
    return o
  }
  const ball=(name:string,p:[number,number,number],scale:[number,number,number],m:THREE.Material,parent:THREE.Object3D=subject)=>{const o=mesh(new THREE.SphereGeometry(1,24,16),m,parent,name);o.position.set(...p);o.scale.set(...scale);return o}
  const rod=(name:string,a:[number,number,number],b:[number,number,number],radius:number,m:THREE.Material,parent:THREE.Object3D=subject)=>{
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),d=end.clone().sub(start),o=mesh(new THREE.CylinderGeometry(radius,radius,d.length(),12),m,parent,name)
    o.position.copy(start).add(end).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return o
  }
  // Chamfered 4-legged wooden stool grounded directly at courtyard surface (-0.0475) with vertical-grain legs.
  const seatProfile=[
    [0,-.05],[.368,-.05],[.386,-.036],[.400,0],[.396,.038],[.380,.05],[0,.05],
  ].map(([r,y])=>new THREE.Vector2(r!,y!))
  const seatGeo=new THREE.LatheGeometry(seatProfile,40);seatGeo.computeVertexNormals()
  const seat=mesh(seatGeo,wood,subject,'surva-stool-seat');seat.position.set(.50,.60,-.10)
  const legH=.55-GROUND_Y,legY=GROUND_Y+legH/2
  for(const [i,x,z] of [[0,.24,-.35],[1,.76,-.35],[2,.24,.15],[3,.76,.15]]){
    roundedBox('surva-stool-leg-'+i,[.082,legH,.082],[x!,legY,z!],legWood,subject,.014)
  }
  roundedBox('surva-stool-apron-front',[.48,.062,.042],[.50,.512,.15],wood,subject,.009)
  roundedBox('surva-stool-apron-back',[.48,.062,.042],[.50,.512,-.35],wood,subject,.009)
  roundedBox('surva-stool-apron-left',[.042,.062,.46],[.24,.512,-.10],sideWood,subject,.009)
  roundedBox('surva-stool-apron-right',[.042,.062,.46],[.76,.512,-.10],sideWood,subject,.009)
  roundedBox('surva-stool-stretcher-left',[.044,.044,.48],[.24,.14,-.10],sideWood,subject,.009)
  roundedBox('surva-stool-stretcher-right',[.044,.044,.48],[.76,.14,-.10],sideWood,subject,.009)
  roundedBox('surva-stool-stretcher-cross',[.50,.042,.044],[.50,.14,-.10],wood,subject,.009)

  // Compact chamfered wooden side stand / leaning cradle grounded at -0.0475 supporting the branch at rest (steps 0 and 3).
  const standBuild=addSteppedPedestal(subject,{
    name:'surva-branch-stand',
    topName:'surva-branch-stand-top',
    shape:'rect',
    kind:'wood',
    finish:'chestnut',
    color:0xb4804e,
    trimColor:0x8f623a,
    center:[-.67,.54],
    groundY:GROUND_Y,
    surfaceY:.16,
    tiers:[
      {width:.38,depth:.34,height:.048},
      {width:.30,depth:.26,height:.115},
      {width:.33,depth:.29,height:.0445},
    ],
  })
  const stand=standBuild.root
  const socketProfile=[
    [.024,0],[.064,0],[.070,.005],[.068,.015],[.058,.018],[.028,.018],[.024,.014],[.024,0],
  ].map(([r,y])=>new THREE.Vector2(r!,y!))
  const socketGeo=new THREE.LatheGeometry(socketProfile,32);socketGeo.computeVertexNormals()
  const socket=mesh(socketGeo,standWood,stand,'surva-branch-socket')
  socket.position.set(0,.16-GROUND_Y,0)
  // Rear vertical-grain upright post with an open-front U-cradle holding the bare stem between grip and lower loop.
  roundedBox('surva-branch-rest-post',[.056,.28,.056],[0,.16-GROUND_Y+.14,-.105],legWood,stand,.011)
  roundedBox('surva-branch-rest-brace',[.052,.040,.084],[0,.16-GROUND_Y+.25,-.055],sideWood,stand,.009)
  roundedBox('surva-branch-rest-arm-left',[.024,.036,.070],[-.036,.16-GROUND_Y+.25,-.006],sideWood,stand,.007)
  roundedBox('surva-branch-rest-arm-right',[.024,.036,.070],[.036,.16-GROUND_Y+.25,-.006],sideWood,stand,.007)
  dedupeNames(stand)

  // Helper: place a sculpted stylized limb from proximal joint `a` to distal joint `b`.
  const stylizedLimb=(
    name:string,
    a:[number,number,number],
    b:[number,number,number],
    topRadius:number,
    bottomRadius:number,
    m:THREE.Material,
    role:'garment'|'skin'='garment',
    bend=.05,
  )=>{
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b)
    const dir=start.clone().sub(end)
    const len=dir.length()
    const g=createStylizedLimbGeometry({length:len,topRadius,bottomRadius,bend,foldDepth:role==='garment'?.005:.001,radialSegments:8,iterations:1})
    g.translate(0,len*.5,0)
    const o=mesh(g,m,subject,name)
    o.position.copy(start).add(end).multiplyScalar(.5)
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize())
    return applyStylizedHumanSurfaceHint(o,role)
  }

  // Warm stylized seated relative facing -Z, grounded in rounded winter boots on the courtyard stones.
  for(const [i,x] of [.33,.67].entries()){
    stylizedLimb('surva-thigh-'+i,[x,.80,-.03],[x,.76,-.55],.114,.090,cloth,'garment',.03)
    stylizedLimb('surva-lower-leg-'+i,[x,.76,-.55],[x,GROUND_Y+.09,-.57],.088,.066,cloth,'garment',.04)
    const bootGeo=createStylizedShoeGeometry({length:.33,width:.18,height:.142,toeLift:.013,radialSegments:8,iterations:1})
    const boot=mesh(bootGeo,shoe,subject,'surva-shoe-'+i)
    boot.position.set(x,GROUND_Y,-.60)
    boot.rotation.y=Math.PI
    applyStylizedHumanSurfaceHint(boot,'garment')
  }

  // Seated winter-coat skirt / hips resting flush at seat.max.y (0.65), clear of the branch back plane.
  const hipsGeo=createStylizedTorsoGeometry({
    shoulderWidth:.56,
    waistWidth:.58,
    hemWidth:.62,
    depth:.42,
    height:.30,
    collarStyle:'round',
    foldDepth:.009,
    radialSegments:10,
    iterations:1,
  })
  hipsGeo.rotateY(Math.PI)
  hipsGeo.computeBoundingBox()
  hipsGeo.translate(0,-hipsGeo.boundingBox!.min.y,0)
  const hips=mesh(hipsGeo,coat,subject,'surva-hips')
  hips.position.set(.50,.65,-.05)
  applyStylizedHumanSurfaceHint(hips,'garment')

  // Sculpted winter wool tunic torso in normalized unit-ellipsoid space (position (.50, 1.13, -.04),
  // scale (.32, .40, .26)) so the enclosing smooth ellipsoid stays exact and the +Z back surface kisses z = 0.22.
  const backGeo=createStylizedTorsoGeometry({
    shoulderWidth:2.04,
    waistWidth:1.74,
    hemWidth:1.96,
    depth:1.92,
    height:1.96,
    collarStyle:'crossed',
    foldDepth:.034,
    radialSegments:12,
    iterations:1,
  })
  backGeo.rotateY(Math.PI)
  backGeo.computeBoundingBox()
  const backCenter=backGeo.boundingBox!.getCenter(new THREE.Vector3())
  backGeo.translate(-backCenter.x,-backCenter.y,-backCenter.z)
  // Gently shape the +Z back contour so (0, 0) is the smooth peak and calibrate exact ray hit to local z = 1.0.
  {
    const pos=backGeo.getAttribute('position') as THREE.BufferAttribute
    for(let i=0;i<pos.count;i++){
      const vx=pos.getX(i),vy=pos.getY(i),vz=pos.getZ(i)
      if(vz>0){
        const r2=vx*vx+vy*vy
        const dome=1/(1+.14*r2)
        pos.setZ(i,vz*dome)
      }
    }
    pos.needsUpdate=true
    backGeo.computeVertexNormals()
    const probe=new THREE.Mesh(backGeo)
    const hit=new THREE.Raycaster(new THREE.Vector3(0,0,5),new THREE.Vector3(0,0,-1)).intersectObject(probe)[0]
    if(hit&&hit.point.z>1e-4){
      const zScale=1/hit.point.z
      for(let i=0;i<pos.count;i++){
        const vz=pos.getZ(i)
        if(vz>0)pos.setZ(i,vz*zScale)
      }
      pos.needsUpdate=true
      backGeo.computeVertexNormals()
      backGeo.computeBoundingBox()
      backGeo.computeBoundingSphere()
    }
  }
  const back=mesh(backGeo,coat,subject,'surva-relative-back')
  back.position.set(.50,1.13,-.04)
  back.scale.set(.32,.40,.26)
  applyStylizedHumanSurfaceHint(back,'garment')

  // Warm woven folk wool vest collar accent hugging the upper neckline (strictly behind z = 0.16, clear of branch).
  const collarGeo=createStylizedTorsoGeometry({
    shoulderWidth:.42,
    waistWidth:.36,
    hemWidth:.38,
    depth:.28,
    height:.15,
    collarStyle:'crossed',
    foldDepth:.005,
    radialSegments:10,
    iterations:1,
  })
  collarGeo.rotateY(Math.PI)
  const collar=mesh(collarGeo,vestTrim,subject,'surva-vest-collar')
  collar.position.set(.50,1.375,-.045)
  applyStylizedHumanSurfaceHint(collar,'garment')

  stylizedLimb('surva-neck',[.50,1.61,-.04],[.50,1.45,-.04],.074,.082,skin,'skin',0)

  const headGeo=createStylizedHeadGeometry({
    width:.36,
    height:.43,
    depth:.36,
    cheekFullness:.18,
    noseProminence:.42,
    chinTaper:.16,
    radialSegments:10,
    iterations:1,
  })
  const head=mesh(headGeo,skin,subject,'surva-head')
  head.position.set(.50,1.73,-.04)
  head.rotation.y=Math.PI
  applyStylizedHumanSurfaceHint(head,'skin')

  // Soft silver-cream gathered elder bun framing the face cleanly and staying clear of the branch plane.
  const hairGeo=createStylizedHairGeometry({
    style:'bun',
    headWidth:.36,
    headHeight:.43,
    headDepth:.36,
    volume:.028,
    radialSegments:10,
    iterations:1,
  })
  const hairMesh=mesh(hairGeo,hair,subject,'surva-hair')
  hairMesh.position.set(.50,1.74,-.045)
  hairMesh.rotation.y=Math.PI
  applyStylizedHumanSurfaceHint(hairMesh,'hair')

  // Soft sculpted ears & subtle nose bridge accent keeping all original node names.
  const earCage=new THREE.IcosahedronGeometry(1,0)
  const earGeo=subdivideClosedCage(earCage,{iterations:1})
  earCage.dispose()
  earGeo.scale(.030,.052,.034)
  for(const [i,x] of [.322,.678].entries()){
    const ear=mesh(i===0?earGeo:earGeo.clone(),skin,subject,'surva-ear-'+i)
    ear.position.set(x,1.72,-.045)
    applyStylizedHumanSurfaceHint(ear,'skin')
  }
  const noseCage=new THREE.IcosahedronGeometry(1,0)
  const noseGeo=subdivideClosedCage(noseCage,{iterations:1})
  noseCage.dispose()
  noseGeo.scale(.026,.034,.032)
  const nose=mesh(noseGeo,skin,subject,'surva-nose')
  nose.position.set(.50,1.715,-.224)
  applyStylizedHumanSurfaceHint(nose,'skin')

  // Warm draped wool sleeves with rolled cuffs and soft resting hands on knees.
  for(const [i,x] of [.185,.815].entries()){
    const elbow=new THREE.Vector3(x,1.00,-.19)
    const wrist=new THREE.Vector3(x,.85,-.42)
    stylizedLimb('surva-sleeve-'+i,[x,1.35,-.04],[x,1.00,-.19],.096,.082,coat,'garment',.05)

    // Thick-walled forearm sleeve with rolled cuff opening toward wrist.
    const foreLen=elbow.distanceTo(wrist)
    const cuffGeo=createStylizedSleeveCuffGeometry({
      length:foreLen,
      cuffRadiusX:.074,
      cuffRadiusY:.068,
      sleeveRadiusX:.084,
      sleeveRadiusY:.078,
      wallThickness:.011,
      rolledLip:.008,
      foldDepth:.004,
      radialSegments:10,
      iterations:1,
    })
    const forearm=mesh(cuffGeo,coat,subject,'surva-forearm-'+i)
    forearm.position.copy(wrist)
    forearm.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),elbow.clone().sub(wrist).normalize())
    applyStylizedHumanSurfaceHint(forearm,'garment')

    // Facing -Z: left side is x = 0.185 (i=0), right side is x = 0.815 (i=1).
    const handedness:'left'|'right'=i===0?'left':'right'
    const thumbSign=handedness==='right'?-1:1
    const palmGeo=createStylizedPalmGeometry({
      width:.108,
      thickness:.044,
      length:.115,
      handedness,
      palmUp:false,
      radialSegments:8,
      iterations:1,
    })
    const hand=mesh(palmGeo,skin,subject,'surva-hand-'+i)
    hand.position.set(x,.835,-.47)
    hand.rotation.set(-.12,i===0?-.14:.14,0)
    applyStylizedHumanSurfaceHint(hand,'skin')

    const fingerRatios=[.72,.82,.76,.60]
    for(let f=0;f<4;f++){
      const slot=1.5-f
      const fGeo=createStylizedFingerGeometry({
        length:.115*fingerRatios[f]!,
        radiusX:.0135,
        radiusY:.0128,
        curl:.34+f*.04,
        curlUp:false,
        splay:thumbSign*slot*.03,
        radialSegments:6,
        iterations:1,
      })
      const finger=mesh(fGeo,skin,hand,`surva-hand-${i}-finger-${f}`)
      finger.position.set(thumbSign*slot*.025,-.003,-.050)
      applyStylizedHumanSurfaceHint(finger,'skin')
    }
    const thumbGeo=createStylizedThumbGeometry({
      length:.068,
      radiusX:.016,
      radiusY:.0145,
      curl:.28,
      curlUp:false,
      opposition:-thumbSign*.012,
      radialSegments:6,
      iterations:1,
    })
    const thumb=mesh(thumbGeo,skin,hand,`surva-hand-${i}-thumb`)
    thumb.position.set(thumbSign*.048,-.004,.008)
    thumb.rotation.y=thumbSign*.46
    applyStylizedHumanSurfaceHint(thumb,'skin')
  }
  const branch=new THREE.Group();branch.name='surva-branch-root';subject.add(branch)
  rod('surva-stem',[0,0,0],[0,1.31,0],.018,bark,branch)
  const grip=rod('surva-grip',[0,.02,0],[0,.18,0],.035,red,branch)
  for(let i=0;i<6;i++)rod('surva-grip-wrap-'+i,[-.032,.03+i*.024,.008],[.032,.05+i*.024,.008],.008,gold,branch)
  // Each loop is a continuous curved twig connected at both ends to the main stem.
  for(const [index,cy,rx,ry] of [[0,.66,.29,.30],[1,1.12,.18,.20]]){
    const points=Array.from({length:49},(_,i)=>{const a=i/48*Math.PI*2;return new THREE.Vector3(rx!*Math.sin(a),cy!-ry!*Math.cos(a),0)})
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),80,.014,8,true),bark,branch,'surva-loop-'+index)
    const yarn=new THREE.TorusGeometry(rx!*.72,.014,8,48)
    const band=mesh(yarn,index===0?red:green,branch,'surva-wool-loop-'+index);band.position.set(0,cy!,0);band.scale.y=ry!/rx!
    rod('surva-loop-tie-'+index,[-.04,cy!-ry!,.012],[.04,cy!-ry!,.012],.025,gold,branch)
    // Popcorn is threaded, not free-floating decoration.
    for(let i=0;i<7;i++){
      const a=(i/6)*Math.PI,x=rx!*.72*Math.cos(a),y=cy!+ry!*.72*Math.sin(a)
      ball('surva-popcorn-'+index+'-'+i,[x,y,.012],[.035,.032,.029],cream,branch)
    }
  }
  for(const [i,x,y] of [[0,-.28,.63],[1,.28,.63],[2,-.17,1.11],[3,.17,1.11]]){
    rod('surva-tassel-tie-'+i,[x!,y!,0],[x!,y!-.07,0],.009,thread,branch)
    const tassel=mesh(new THREE.ConeGeometry(.032,.13,12),i!%2?gold:red,branch,'surva-tassel-'+i);tassel.position.set(x!,y!-.13,0);tassel.rotation.z=Math.PI
  }
  const start=new THREE.Vector3(-.67,.16,.54),raised=new THREE.Vector3(-.67,.66,.54),ready=new THREE.Vector3(.50,.72,.53)
  const touchZ=.238 // stem front at .220, tangent to the back's outermost surface z=.220.
  const pose=(step:number,amount:number)=>{
    const t=Number.isFinite(amount)?THREE.MathUtils.clamp(amount,0,1):0
    branch.rotation.set(0,0,0)
    if(step===0){branch.position.lerpVectors(start,raised,t);if(t===1)branch.position.copy(raised)}
    else if(step===1){branch.position.lerpVectors(raised,ready,t);if(t===1)branch.position.copy(ready)}
    else if(step===2){
      // One gentle contact at t = 0.5, full withdrawal clear of the back, then settling back onto the side stand.
      if(t<=.5){
        const tap=Math.sin(Math.PI*t)**2
        branch.position.set(ready.x,ready.y,THREE.MathUtils.lerp(ready.z,touchZ,tap))
      }else if(t<=.68){
        const w=smooth((t-.5)/.18)
        branch.position.set(ready.x,ready.y,THREE.MathUtils.lerp(touchZ,ready.z,w))
      }else if(t<=.88){
        branch.position.lerpVectors(ready,raised,smooth((t-.68)/.20))
      }else{
        branch.position.lerpVectors(raised,start,smooth((t-.88)/.12))
        if(t===1)branch.position.copy(start)
      }
    }else{
      branch.position.copy(start)
    }
    root.updateMatrixWorld(true)
  }
  pose(0,0)
  return {root,subject,stand,targets:[grip,grip,grip],roots:[branch,branch,branch],anchors:[[0,0,.025],[0,0,.025],[0,0,.025]] as [number,number,number][],pose,branch,back,head,touchZ,ready}
}
