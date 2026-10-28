import * as THREE from 'three'
import { insideCanvas } from './touch-target'

type Anchor = [number, number, number]
type PoseModel = {
  root?: THREE.Object3D
  pose(step: number, amount: number): void
  roots: THREE.Object3D[]
  targets: THREE.Object3D[]
  anchors?: Anchor[]
}
type Transform = { position: THREE.Vector3; quaternion: THREE.Quaternion; scale: THREE.Vector3 }
const transform = (object: THREE.Object3D): Transform => ({
  position: object.position.clone(), quaternion: object.quaternion.clone(), scale: object.scale.clone(),
})
const apply = (object: THREE.Object3D, value: Transform) => {
  object.position.copy(value.position); object.quaternion.copy(value.quaternion); object.scale.copy(value.scale)
  object.updateWorldMatrix(true, true)
}
const belongs = (object: THREE.Object3D, root: THREE.Object3D) => {
  for (let node: THREE.Object3D | null = object; node; node = node.parent) if (node === root) return true
  return false
}

/** Spatial input for rigid movable parts, not an inference that every pose is
 * a placement. Scenes explicitly choose the applicable checkpoints. Construct
 * at the canonical initial pose; the end poses provide real target anchors. */
export function createPosePlacement(canvas: HTMLCanvasElement, camera: THREE.Camera, model: PoseModel, scene?: THREE.Object3D,
  options: { destination?(step: number, defaultGoal: THREE.Vector3): THREE.Vector3; planeNormal?: THREE.Vector3; requireDeparture?: boolean | ((step: number) => boolean) } = {}) {
  const goals: THREE.Vector3[] = [], ends: Transform[] = [], anchors: THREE.Vector3[] = []
  const checkpointTransforms: Map<THREE.Object3D,Transform>[]=[]
  const objects=new Set<THREE.Object3D>()
  if(model.root)model.root.traverse(object=>objects.add(object))
  else model.roots.forEach(root=>root.traverse(object=>objects.add(object)))
  const snapshot=(step:number)=>{checkpointTransforms[step]=new Map([...objects].map(object=>[object,transform(object)]))}
  for (let step = 0; step < model.roots.length; step++) {
    const root = model.roots[step]!, target = model.targets[step] ?? root
    model.pose(step, 0); root.updateWorldMatrix(true, true);snapshot(step)
    const contact = target.localToWorld(new THREE.Vector3(...(model.anchors?.[step] ?? [0, 0, 0])))
    anchors.push(root.worldToLocal(contact))
    model.pose(step, 1); root.updateWorldMatrix(true, true)
    const goal = target.localToWorld(new THREE.Vector3(...(model.anchors?.[step] ?? [0, 0, 0])))
    goals.push(options.destination?.(step, goal.clone()).clone() ?? goal)
    ends.push(transform(root))
    snapshot(step+1)
  }
  model.pose(0, 0)
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(), ndc = new THREE.Vector2()
  const normal = new THREE.Vector3(), point = new THREE.Vector3(), offset = new THREE.Vector3()
  const local = new THREE.Vector3(), world = new THREE.Vector3(), projected = new THREE.Vector3()
  const rotation = new THREE.Quaternion(), parentRotation = new THREE.Quaternion(), turn = new THREE.Quaternion()
  const up = new THREE.Vector3(), right = new THREE.Vector3()
  const inspections=new Map<THREE.Object3D,{center:THREE.Vector3;pivot:THREE.Vector3;floor:number;lastPosition:THREE.Vector3;lastRotation:THREE.Quaternion}>()
  const bounds=new THREE.Box3()
  const setWorldPosition=(root:THREE.Object3D,position:THREE.Vector3)=>{
    root.position.copy(root.parent?root.parent.worldToLocal(position.clone()):position);root.updateWorldMatrix(true,true)
  }
  let held: { step: number; root: THREE.Object3D; home: Transform; radius: number; x: number; y: number; moved: boolean; departed: boolean } | null = null
  let settling: { step: number; root: THREE.Object3D; from: Transform } | null = null
  function aim(x: number, y: number) {
    const rect = canvas.getBoundingClientRect()
    ndc.set((x - rect.left) / rect.width * 2 - 1, 1 - (y - rect.top) / rect.height * 2)
    camera.updateWorldMatrix(true, false); ray.setFromCamera(ndc, camera)
  }
  function project(value: THREE.Vector3) {
    const rect = canvas.getBoundingClientRect()
    projected.copy(value).project(camera)
    if (![projected.x, projected.y, projected.z].every(Number.isFinite) || Math.abs(projected.z) > 1) return null
    return { x: rect.left + (projected.x + 1) * rect.width / 2, y: rect.top + (1 - projected.y) * rect.height / 2 }
  }
  function clearPath(x: number, y: number, root: THREE.Object3D, goal: THREE.Vector3) {
    if (!scene) return true
    scene.updateWorldMatrix(true, true); camera.updateWorldMatrix(true, false)
    const meshes: THREE.Object3D[] = []
    scene.traverseVisible(object => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh || belongs(object, root)) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      if (materials.some(material => material.visible && (!material.transparent || material.opacity >= .5))) meshes.push(object)
    })
    aim(x, y)
    const first = ray.intersectObjects(meshes, false)[0]
    if (!first) return true
    const goalDepth = world.copy(goal).applyMatrix4(camera.matrixWorldInverse).z
    const hitDepth = world.copy(first.point).applyMatrix4(camera.matrixWorldInverse).z
    // Contact anchors can sit just inside a supporting surface. A distinct
    // foreground object, rather than that contact skin, still blocks arrival.
    return hitDepth <= goalDepth + .08
  }
  function ready(x: number, y: number) {
    if (!held?.moved || !held.departed || !insideCanvas(canvas, x, y)) return false
    const goal = goals[held.step]!, target = project(goal)
    held.root.updateWorldMatrix(true, false)
    const contact = project(held.root.localToWorld(local.copy(anchors[held.step]!)))
    if (!target || !contact || !insideCanvas(canvas, contact.x, contact.y)) return false
    return Math.hypot(contact.x - target.x, contact.y - target.y) <= held.radius
      && clearPath(x, y, held.root, goal) && clearPath(contact.x, contact.y, held.root, goal)
  }
  return {
    destination: (step: number) => goals[step]!.clone(),
    begin(step: number, x: number, y: number) {
      if (!insideCanvas(canvas, x, y) || !model.roots[step]) return false
      const root = model.roots[step]!
      root.updateWorldMatrix(true, false); camera.updateWorldMatrix(true, false)
      const contact = root.localToWorld(local.copy(anchors[step]!)), from = project(contact), to = project(goals[step]!)
      if (!from || !to) return false
      if (options.planeNormal) normal.copy(options.planeNormal).normalize()
      else camera.getWorldDirection(normal)
      plane.setFromNormalAndCoplanarPoint(normal, contact)
      aim(x, y)
      if (!ray.ray.intersectPlane(plane, point)) return false
      offset.subVectors(root.getWorldPosition(world), point)
      // A short final seating step must not start inside its own acceptance
      // circle. This is a destination tolerance, never a drag-distance test.
      const requireDeparture = typeof options.requireDeparture === 'function' ? options.requireDeparture(step) : options.requireDeparture
      const radius = requireDeparture ? 22 : Math.min(22, Math.hypot(to.x - from.x, to.y - from.y) * .42)
      held = { step, root, home: transform(root), radius, x, y, moved: false, departed: !requireDeparture }; settling = null
      return true
    },
    move(x: number, y: number) {
      if (!held || !Number.isFinite(x) || !Number.isFinite(y)) return false
      aim(x, y)
      if (!ray.ray.intersectPlane(plane, point)) return false
      point.add(offset)
      if (held.root.parent) held.root.parent.worldToLocal(point)
      held.root.position.copy(point); held.root.updateWorldMatrix(true, true)
      const inspection=inspections.get(held.root)
      if(inspection){const position=held.root.getWorldPosition(new THREE.Vector3()),delta=position.clone().sub(inspection.lastPosition);inspection.pivot.add(delta);inspection.floor+=delta.y;inspection.lastPosition.copy(position)}
      held.moved ||= x !== held.x || y !== held.y
      held.departed ||= Math.hypot(x-held.x,y-held.y) >= 24
      return ready(x, y)
    },
    /** Rotate the physical asset about its geometric center. A fixed per-view
     * pivot/support baseline prevents bottom-pivot assets entering the support
     * or ratcheting upwards during repeated keyboard/touch inspection. */
    rotate(yaw: number, pitch: number) {
      if (!held || !Number.isFinite(yaw) || !Number.isFinite(pitch)) return false
      const root = held.root
      root.updateWorldMatrix(true, false); camera.updateWorldMatrix(true, false)
      const position=root.getWorldPosition(new THREE.Vector3()),currentRotation=root.getWorldQuaternion(new THREE.Quaternion())
      let inspection=inspections.get(root)
      if(!inspection||inspection.lastPosition.distanceTo(position)>1e-8||inspection.lastRotation.angleTo(currentRotation)>1e-7){
        bounds.setFromObject(root,true)
        const pivot=bounds.isEmpty()?position.clone():bounds.getCenter(new THREE.Vector3())
        inspection={center:root.worldToLocal(pivot.clone()),pivot,floor:bounds.isEmpty()?-Infinity:bounds.min.y,lastPosition:position.clone(),lastRotation:currentRotation.clone()}
        inspections.set(root,inspection)
      }
      root.getWorldQuaternion(rotation)
      up.copy(camera.up).normalize(); right.setFromMatrixColumn(camera.matrixWorld, 0).normalize()
      rotation.premultiply(turn.setFromAxisAngle(right, pitch))
      rotation.premultiply(turn.setFromAxisAngle(up, yaw))
      if (root.parent) {
        root.parent.getWorldQuaternion(parentRotation)
        rotation.premultiply(parentRotation.invert())
      }
      root.quaternion.copy(rotation.normalize()); root.updateWorldMatrix(true, true)
      const center=root.localToWorld(inspection.center.clone())
      setWorldPosition(root,root.getWorldPosition(new THREE.Vector3()).add(inspection.pivot.clone().sub(center)))
      bounds.setFromObject(root,true)
      if(!bounds.isEmpty()&&bounds.min.y<inspection.floor)setWorldPosition(root,root.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,inspection.floor-bounds.min.y,0)))
      inspection.lastPosition.copy(root.getWorldPosition(new THREE.Vector3()));inspection.lastRotation.copy(root.getWorldQuaternion(new THREE.Quaternion()))
      return true
    },
    /** Rebuild the pointer plane/offset after changing the inspection fingers or
     * modifier mode. The next pointer sample cannot jump or inherit readiness. */
    rebase(x: number, y: number) {
      if (!held || !Number.isFinite(x) || !Number.isFinite(y)) return false
      const root = held.root
      root.updateWorldMatrix(true, false); camera.updateWorldMatrix(true, false)
      const contact = root.localToWorld(local.copy(anchors[held.step]!))
      if (options.planeNormal) normal.copy(options.planeNormal).normalize()
      else camera.getWorldDirection(normal)
      plane.setFromNormalAndCoplanarPoint(normal, contact)
      aim(x,y)
      if (!ray.ray.intersectPlane(plane, point)) return false
      offset.subVectors(root.getWorldPosition(world), point)
      held.x = x; held.y = y; held.moved = false
      return true
    },
    /** A deliberate inspection release keeps the current view available for
     * another grab, without accepting a placement or restoring its home. */
    release() { held = null; settling = null },
    ready,
    capture(step?: number) {
      if (!held) {
        if (step !== undefined && Number.isInteger(step) && model.roots[step] && ends[step]) {
          const root = model.roots[step]!
          inspections.delete(root)
          settling = { step, root, from: transform(root) }
        }
        return
      }
      inspections.delete(held.root);settling = { step: held.step, root: held.root, from: transform(held.root) }; held = null
    },
    /** Call after the scene's ordinary pose update: the held rigid part takes
     * only the short remaining journey, not the original scripted trajectory. */
    settle(amount: number) {
      if (!settling) return
      const { root, from, step } = settling, end = ends[step]!, t = THREE.MathUtils.clamp(amount, 0, 1)
      root.position.lerpVectors(from.position, end.position, t)
      root.quaternion.slerpQuaternions(from.quaternion, end.quaternion, t)
      root.scale.lerpVectors(from.scale, end.scale, t); root.updateWorldMatrix(true, true)
      if (t === 1) settling = null
    },
    /** Call after model.pose(checkpoint,0): some authored poses only update y or
     * position. Restore every canonical transform, including released views. */
    restoreCheckpoint(checkpoint:number){
      const saved=checkpointTransforms[checkpoint];if(!saved)return
      for(const[object,state]of saved){object.position.copy(state.position);object.quaternion.copy(state.quaternion);object.scale.copy(state.scale)}
      inspections.clear();(model.root??model.roots[0])?.updateWorldMatrix(true,true)
    },
    cancel() { if (held) apply(held.root, held.home); held = null; settling = null;inspections.clear() },
  }
}
