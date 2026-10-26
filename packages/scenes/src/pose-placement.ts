import * as THREE from 'three'
import { insideCanvas } from './touch-target'

type Anchor = [number, number, number]
type PoseModel = {
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
  options: { destination?(step: number, defaultGoal: THREE.Vector3): THREE.Vector3; planeNormal?: THREE.Vector3 } = {}) {
  const goals: THREE.Vector3[] = [], ends: Transform[] = [], anchors: THREE.Vector3[] = []
  for (let step = 0; step < model.roots.length; step++) {
    const root = model.roots[step]!, target = model.targets[step] ?? root
    model.pose(step, 0); root.updateWorldMatrix(true, true)
    const contact = target.localToWorld(new THREE.Vector3(...(model.anchors?.[step] ?? [0, 0, 0])))
    anchors.push(root.worldToLocal(contact))
    model.pose(step, 1); root.updateWorldMatrix(true, true)
    const goal = target.localToWorld(new THREE.Vector3(...(model.anchors?.[step] ?? [0, 0, 0])))
    goals.push(options.destination?.(step, goal.clone()).clone() ?? goal)
    ends.push(transform(root))
  }
  model.pose(0, 0)
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(), ndc = new THREE.Vector2()
  const normal = new THREE.Vector3(), point = new THREE.Vector3(), offset = new THREE.Vector3()
  const local = new THREE.Vector3(), world = new THREE.Vector3(), projected = new THREE.Vector3()
  let held: { step: number; root: THREE.Object3D; home: Transform; radius: number; x: number; y: number; moved: boolean } | null = null
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
    if (!held?.moved || !insideCanvas(canvas, x, y)) return false
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
      const radius = Math.min(22, Math.hypot(to.x - from.x, to.y - from.y) * .42)
      held = { step, root, home: transform(root), radius, x, y, moved: false }; settling = null
      return true
    },
    move(x: number, y: number) {
      if (!held || !Number.isFinite(x) || !Number.isFinite(y)) return false
      aim(x, y)
      if (!ray.ray.intersectPlane(plane, point)) return false
      point.add(offset)
      if (held.root.parent) held.root.parent.worldToLocal(point)
      held.root.position.copy(point); held.root.updateWorldMatrix(true, true)
      held.moved ||= x !== held.x || y !== held.y
      return ready(x, y)
    },
    ready,
    capture() {
      if (!held) return
      settling = { step: held.step, root: held.root, from: transform(held.root) }; held = null
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
    cancel() { if (held) apply(held.root, held.home); held = null; settling = null },
  }
}
