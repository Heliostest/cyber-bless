import * as THREE from 'three'
import type { createFirstFootingModel } from './model'
import { createPosePlacement } from '../pose-placement'
type Model = ReturnType<typeof createFirstFootingModel>
type Pose = { position: THREE.Vector3; quaternion: THREE.Quaternion }

export function createFirstFootingCarry(canvas: HTMLCanvasElement, camera: THREE.Camera, model: Model, scene: THREE.Object3D) {
  const anchor=new THREE.Vector3(...model.anchors[2]!),hover=model.seat.clone().add(new THREE.Vector3(0,.38,0))
  const placement=createPosePlacement(canvas,camera,model,scene,{planeNormal:new THREE.Vector3(0,1,0),destination:(_step,goal)=>goal.add(new THREE.Vector3(0,.38,0))})
  model.root.updateWorldMatrix(true,true)
  const solids=model.solids.map(mesh=>new THREE.Box3().setFromObject(mesh,true))
  const named=(name:string)=>new THREE.Box3().setFromObject(model.root.getObjectByName(name)!,true)
  const left=named('door-post-left'),right=named('door-post-right'),threshold=named('stone-threshold'),lintel=named('door-lintel')
  const gate={left:left.max.x,right:right.min.x,front:left.max.z,back:left.min.z,bottom:threshold.max.y,top:lintel.min.y}
  const localBox=model.coal.geometry.boundingBox!.clone(),matrix=new THREE.Matrix4(),box=new THREE.Box3()
  const ray=new THREE.Raycaster(),plane=new THREE.Plane(),ndc=new THREE.Vector2(),point=new THREE.Vector3(),offset=new THREE.Vector3()
  const identity=new THREE.Quaternion(),coal=model.coal,epsilon=.0001
  let entered=false,assisted:Pose[]|null=null,lengths:number[]=[],total=0
  const pose=():Pose=>({position:coal.position.clone(),quaternion:coal.quaternion.clone()})
  const apply=(p:Pose)=>{coal.position.copy(p.position);coal.quaternion.copy(p.quaternion);coal.updateWorldMatrix(true,true)}
  const boxAt=(p:Pose)=>{
    matrix.compose(p.position,p.quaternion,coal.scale)
    if(coal.parent)matrix.premultiply(coal.parent.matrixWorld)
    return box.copy(localBox).applyMatrix4(matrix)
  }
  const clearPose=(p:Pose)=>{
    const b=boxAt(p)
    // The cutaway has no broad outside wall. Still require the *entire* lump to
    // cross the real jamb interval whenever it overlaps the doorway thickness.
    if(b.min.z<gate.front-epsilon&&b.max.z>gate.back+epsilon
      &&(b.min.x<gate.left-epsilon||b.max.x>gate.right+epsilon||b.min.y<gate.bottom-epsilon||b.max.y>gate.top+epsilon))return false
    return solids.every(s=>Math.min(b.max.x,s.max.x)-Math.max(b.min.x,s.min.x)<=epsilon
      ||Math.min(b.max.y,s.max.y)-Math.max(b.min.y,s.min.y)<=epsilon
      ||Math.min(b.max.z,s.max.z)-Math.max(b.min.z,s.min.z)<=epsilon)
  }
  const inside=(p:Pose)=>boxAt(p).max.z<gate.back-epsilon
  const sweep=(from:Pose,to:Pose)=>{
    const count=Math.max(1,Math.ceil(from.position.distanceTo(to.position)/.025),Math.ceil(from.quaternion.angleTo(to.quaternion)/.06))
    let last=from
    for(let i=1;i<=count;i++){
      const p={position:from.position.clone().lerp(to.position,i/count),quaternion:from.quaternion.clone().slerp(to.quaternion,i/count)}
      if(!clearPose(p))return{clear:false,last}
      last=p
    }
    return{clear:true,last}
  }
  const project=(value:THREE.Vector3)=>{
    camera.updateWorldMatrix(true,false);const p=value.clone().project(camera),rect=canvas.getBoundingClientRect()
    return{x:rect.left+(p.x+1)*rect.width/2,y:rect.top+(1-p.y)*rect.height/2}
  }
  function begin(_step:number,x:number,y:number){
    const home=pose();assisted=null;coal.updateWorldMatrix(true,false)
    if(Math.abs(coal.position.y-.5)>epsilon){
      const contact=coal.localToWorld(anchor.clone()),screen=project(contact),rect=canvas.getBoundingClientRect()
      offset.copy(contact).sub(coal.getWorldPosition(new THREE.Vector3()))
      const carryY=model.root.localToWorld(new THREE.Vector3(0,.5,0)).y+offset.y
      plane.set(new THREE.Vector3(0,1,0),-carryY);ndc.set((screen.x-rect.left)/rect.width*2-1,1-(screen.y-rect.top)/rect.height*2)
      ray.setFromCamera(ndc,camera)
      if(!ray.ray.intersectPlane(plane,point))return false
      const position=point.clone().sub(offset);if(coal.parent)coal.parent.worldToLocal(position)
      const lifted={position,quaternion:coal.quaternion.clone()},path=sweep(home,lifted)
      if(!path.clear)return false
      apply(lifted);entered ||= inside(lifted)
    }
    if(!placement.begin(2,x,y)){apply(home);return false}
    return true
  }
  const safeSeat=()=>sweep(pose(),{position:model.seat.clone(),quaternion:identity.clone()}).clear
  const ready=(x:number,y:number)=>entered&&coal.position.z<-.3&&placement.ready(x,y)&&safeSeat()
  function move(x:number,y:number){
    const before=pose();placement.move(x,y);const candidate=pose(),path=sweep(before,candidate)
    if(!path.clear){apply(path.last);entered ||= inside(path.last);placement.rebase(x,y);return false}
    entered ||= inside(candidate)
    return ready(x,y)
  }
  function rotate(yaw:number,_pitch:number){
    if(!Number.isFinite(yaw))return false
    const before=pose()
    // Keep the authored planar coal base upright. Yaw offers a complete view
    // while pitch/roll would need unsupported contact/gravity simulation.
    const count=Math.max(1,Math.ceil(Math.abs(yaw)/.06))
    for(let i=0;i<count;i++){
      const previous=pose()
      if(!placement.rotate(yaw/count,0)||!sweep(previous,pose()).clear){apply(before);return false}
    }
    return true
  }
  function assist(){
    const original=pose(),wasEntered=entered,contact=project(coal.localToWorld(anchor.clone()))
    if(!begin(0,contact.x,contact.y))return false
    const start=pose(),nodes=[start.position.clone(),new THREE.Vector3(.45,.5,.85),new THREE.Vector3(.45,.5,.40),new THREE.Vector3(.45,.5,-.02),new THREE.Vector3(-.75,.5,-.02),hover.clone(),new THREE.Vector3(-1.8,.5,.06),new THREE.Vector3(.9,.5,-.02)]
    const orientation=[start.quaternion,identity],queue=[0],parents=new Map<number,number>([[0,-1]]),goal=5*2+1
    const statePose=(state:number):Pose=>({position:nodes[Math.floor(state/2)]!.clone(),quaternion:orientation[state%2]!.clone()})
    for(let head=0;head<queue.length&&!parents.has(goal);head++){
      const state=queue[head]!,node=Math.floor(state/2),mode=state%2,from=statePose(state)
      const candidates=nodes.map((_,i)=>i*2+mode)
      if(mode===0)candidates.push(node*2+1)
      for(const next of candidates){
        if(parents.has(next))continue
        if(sweep(from,statePose(next)).clear){parents.set(next,state);queue.push(next)}
      }
    }
    if(!parents.has(goal)||!sweep(statePose(goal),{position:model.seat.clone(),quaternion:identity.clone()}).clear){placement.release();apply(original);entered=wasEntered;return false}
    const states:number[]=[];for(let state=goal;state!==-1;state=parents.get(state)!)states.push(state)
    assisted=states.reverse().map(statePose);assisted.push({position:model.seat.clone(),quaternion:identity.clone()})
    placement.release();lengths=[0];total=0
    for(let i=1;i<assisted.length;i++){total+=assisted[i]!.position.distanceTo(assisted[i-1]!.position)+assisted[i]!.quaternion.angleTo(assisted[i-1]!.quaternion)*.18;lengths.push(total)}
    return true
  }
  return {
    destination: (_step?:number)=>placement.destination(2),begin,move,ready,rotate,
    rebase:(x:number,y:number)=>placement.rebase(x,y),release(){placement.release()},
    cancel(){placement.cancel();assisted=null},reset(at:number){placement.cancel();assisted=null;entered=at>=2},
    capture(){placement.capture()},settle(amount:number){placement.settle(amount)},assist,
    animateAssisted(amount:number){
      if(!assisted)return
      const t=THREE.MathUtils.clamp(Number.isFinite(amount)?amount:0,0,1),distance=t*total
      let at=1;while(at<lengths.length-1&&lengths[at]!<distance)at++
      const from=assisted[at-1]!,to=assisted[at]!,n=(distance-lengths[at-1]!)/Math.max(lengths[at]!-lengths[at-1]!,.000001)
      apply({position:from.position.clone().lerp(to.position,n),quaternion:from.quaternion.clone().slerp(to.quaternion,n)})
      entered ||= inside(pose())
    },
    get entered(){return entered},
  }
}
