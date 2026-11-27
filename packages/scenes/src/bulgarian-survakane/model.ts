import { getEnvironmentSurfaceY } from '@wbr/scene-runtime'
import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
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
  const bark=mat(0x936038),wood=mat(0xba8652),legWood=mat(0x9e6d40),sideWood=mat(0xa87647),standWood=mat(0xb27e4c),coat=mat(0x4e8791),cloth=mat(0x385b6a),skin=mat(0xd4a075),hair=mat(0xdbd5be),shoe=mat(0x625344)
  const red=mat(0xc65e55),gold=mat(0xe7ba64),cream=mat(0xf2e5bc),green=mat(0x648b62),thread=mat(0xbfa97b)
  applyCraftSurface(wood,{kind:'wood',strength:.4,axis:'x'})
  applyCraftSurface(legWood,{kind:'wood',strength:.42,axis:'y'})
  applyCraftSurface(sideWood,{kind:'wood',strength:.40,axis:'z'})
  applyCraftSurface(standWood,{kind:'wood',strength:.40,axis:'x'})
  ;[coat,cloth].forEach(material=>applyCraftSurface(material,{kind:'fabric',strength:.28}))
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

  for(const [i,x] of [.33,.67].entries()){
    rod('surva-thigh-'+i,[x,.80,-.02],[x,.77,-.56],.11,cloth)
    rod('surva-lower-leg-'+i,[x,.77,-.56],[x,GROUND_Y+.11,-.58],.085,cloth)
    ball('surva-shoe-'+i,[x,GROUND_Y+.075,-.64],[.12,.075,.22],shoe)
  }
  ball('surva-hips',[.50,.83,-.04],[.31,.18,.24],coat)
  const back=ball('surva-relative-back',[.50,1.13,-.04],[.32,.40,.26],coat)
  rod('surva-neck',[.50,1.46,-.04],[.50,1.60,-.04],.085,skin)
  const head=ball('surva-head',[.50,1.73,-.04],[.19,.23,.185],skin)
  // Close-fitting hair leaves face and ears visible from the side, without a floating cap.
  ball('surva-hair',[.50,1.80,-.005],[.196,.175,.182],hair)
  for(const [i,x] of [.305,.695].entries())ball('surva-ear-'+i,[x,1.72,-.05],[.035,.055,.035],skin)
  ball('surva-nose',[.50,1.71,-.235],[.045,.055,.07],skin)
  for(const [i,x] of [.17,.83].entries()){
    rod('surva-sleeve-'+i,[x,1.34,-.04],[x,1.00,-.19],.095,coat)
    rod('surva-forearm-'+i,[x,1.00,-.19],[x,.84,-.43],.075,coat)
    ball('surva-hand-'+i,[x,.82,-.47],[.08,.065,.10],skin)
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
