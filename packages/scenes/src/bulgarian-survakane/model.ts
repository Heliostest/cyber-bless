import * as THREE from 'three'

/** Cornel branch, looped twigs and a seated relative. Geometry is an illustrative composition. */
export function createSurvakaneModel() {
  const root=new THREE.Group();root.name='surva-root'
  const subject=new THREE.Group();subject.name='surva-subject';root.add(subject)
  const mat=(color:number,roughness=.85)=>new THREE.MeshStandardMaterial({color,roughness})
  const bark=mat(0x936038),wood=mat(0xba8652),coat=mat(0x4e8791),cloth=mat(0x385b6a),skin=mat(0xd4a075),hair=mat(0xdbd5be),shoe=mat(0x625344)
  const red=mat(0xc65e55),gold=mat(0xe7ba64),cream=mat(0xf2e5bc),green=mat(0x648b62),thread=mat(0xbfa97b)
  const mesh=(g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D,name:string)=>{const o=new THREE.Mesh(g,m);o.name=name;o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
  const ball=(name:string,p:[number,number,number],scale:[number,number,number],m:THREE.Material,parent:THREE.Object3D=subject)=>{const o=mesh(new THREE.SphereGeometry(1,24,16),m,parent,name);o.position.set(...p);o.scale.set(...scale);return o}
  const rod=(name:string,a:[number,number,number],b:[number,number,number],radius:number,m:THREE.Material,parent:THREE.Object3D=subject)=>{
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),d=end.clone().sub(start),o=mesh(new THREE.CylinderGeometry(radius,radius,d.length(),12),m,parent,name)
    o.position.copy(start).add(end).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return o
  }
  const base=mesh(new THREE.CylinderGeometry(1.55,1.58,.09,48),mat(0xc7c5a8),subject,'surva-paving');base.position.set(0,-.02,0)
  // The stool supports the person; there is no separate display board or work table.
  const seat=mesh(new THREE.CylinderGeometry(.40,.38,.10,32),wood,subject,'surva-stool-seat');seat.position.set(.50,.60,-.10)
  for(const [i,x,z] of [[0,.23,-.35],[1,.77,-.35],[2,.23,.15],[3,.77,.15]])rod('surva-stool-leg-'+i,[x!,.025,z!],[x!,.55,z!],.045,wood)
  for(const [i,x] of [.33,.67].entries()){
    rod('surva-thigh-'+i,[x,.80,-.02],[x,.77,-.56],.11,cloth)
    rod('surva-lower-leg-'+i,[x,.77,-.56],[x,.17,-.58],.085,cloth)
    ball('surva-shoe-'+i,[x,.10,-.64],[.12,.075,.22],shoe)
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
    else {
      branch.position.copy(ready)
      // One gentle contact, followed by a full withdrawal; no implicit traditional tap count.
      const tap=step===2?Math.sin(Math.PI*t)**2:0
      branch.position.z=THREE.MathUtils.lerp(ready.z,touchZ,tap)
    }
    root.updateMatrixWorld(true)
  }
  pose(0,0)
  return {root,subject,targets:[grip,grip,grip],roots:[branch,branch,branch],anchors:[[0,0,.025],[0,0,.025],[0,0,.025]] as [number,number,number][],pose,branch,back,head,touchZ,ready}
}
