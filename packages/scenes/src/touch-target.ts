import * as THREE from 'three'

export function insideCanvas(canvas: HTMLCanvasElement, x: number, y: number) {
  const r = canvas.getBoundingClientRect()
  return Number.isFinite(x) && Number.isFinite(y) && r.width > 0 && r.height > 0
    && x >= r.left && x <= r.left + r.width && y >= r.top && y <= r.top + r.height
}

export function projectTouchPoint(canvas: HTMLCanvasElement, camera: THREE.Camera, object: THREE.Object3D, anchor: [number, number, number] = [0, 0, 0]) {
  object.updateWorldMatrix(true, false); camera.updateWorldMatrix(true, false)
  const p = object.localToWorld(new THREE.Vector3(...anchor)).project(camera), r = canvas.getBoundingClientRect()
  if (![p.x, p.y, p.z].every(Number.isFinite) || Math.abs(p.z) > 1) return null
  const x = r.left + (p.x + 1) * r.width / 2, y = r.top + (1 - p.y) * r.height / 2
  return insideCanvas(canvas, x, y) ? { x, y } : null
}

type TouchOptions = { ignore?: THREE.Object3D | THREE.Object3D[]; radius?: number }
const list = (objects: THREE.Object3D | THREE.Object3D[]) => Array.isArray(objects) ? objects : [objects]
const belongs = (object: THREE.Object3D, roots: THREE.Object3D[]) => {
  for (let p: THREE.Object3D | null = object; p; p = p.parent) if (roots.includes(p)) return true
  return false
}

/** A bounded CSS-pixel margin around real, visible geometry. Samples never
 * bypass a nearer opaque surface under the fingertip. Held objects may be
 * excluded for drop tests; every other visible surface still occludes them. */
export function createTouchTarget(canvas: HTMLCanvasElement, camera: THREE.Camera, scene: THREE.Object3D) {
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), depth = new THREE.Vector3()
  return {
    /** Before checking a carried object's contact anchor, keep the fingertip
     * from bypassing a nearer unrelated foreground object at another point. */
    occluded(x: number, y: number, targets: THREE.Object3D | THREE.Object3D[], options: TouchOptions = {}) {
      if (!insideCanvas(canvas, x, y)) return true
      scene.updateWorldMatrix(true, true); camera.updateWorldMatrix(true, false)
      const roots = list(targets), ignored = options.ignore ? list(options.ignore) : [], meshes: THREE.Object3D[] = []
      scene.traverseVisible(o => {
        const mesh = o as THREE.Mesh
        if (!mesh.isMesh || belongs(o, ignored)) return
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        if (materials.some(m => m.visible && (!m.transparent || m.opacity >= .5))) meshes.push(o)
      })
      const r = canvas.getBoundingClientRect()
      ndc.set((x - r.left) / r.width * 2 - 1, -(y - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, camera)
      const first = ray.intersectObjects(meshes, false)[0]
      if (!first || belongs(first.object, roots)) return false
      const fingerDepth = depth.copy(first.point).applyMatrix4(camera.matrixWorldInverse).z
      let front = -Infinity
      for (const root of roots) {
        const box = new THREE.Box3().setFromObject(root)
        for (const bx of [box.min.x, box.max.x]) for (const by of [box.min.y, box.max.y]) for (const bz of [box.min.z, box.max.z])
          front = Math.max(front, depth.set(bx, by, bz).applyMatrix4(camera.matrixWorldInverse).z)
      }
      return fingerDepth > front + .002
    },
    hit(x: number, y: number, targets: THREE.Object3D | THREE.Object3D[], options: TouchOptions = {}) {
      if (!insideCanvas(canvas, x, y)) return false
      const roots = list(targets), ignored = options.ignore ? list(options.ignore) : [], meshes: THREE.Object3D[] = []
      scene.updateWorldMatrix(true, true); camera.updateWorldMatrix(true, false)
      const radius = THREE.MathUtils.clamp(options.radius ?? 22, 0, 22), rect = canvas.getBoundingClientRect()
      // Most move events are far from a destination. Reject those before any
      // scene raycasts, using cached geometry bounds rather than its vertices.
      const bounds: { minX: number; maxX: number; minY: number; maxY: number }[] = []
      const nearby = roots.map(root => {
        const box = new THREE.Box3().setFromObject(root)
        if (box.isEmpty()) return false
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
        for (const bx of [box.min.x, box.max.x]) for (const by of [box.min.y, box.max.y]) for (const bz of [box.min.z, box.max.z]) {
          const p = depth.set(bx, by, bz).project(camera)
          if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || Math.abs(p.z) > 1) continue
          const px = rect.left + (p.x + 1) * rect.width / 2, py = rect.top + (1 - p.y) * rect.height / 2
          minX = Math.min(minX, px); maxX = Math.max(maxX, px); minY = Math.min(minY, py); maxY = Math.max(maxY, py)
        }
        bounds.push({ minX, maxX, minY, maxY })
        return x >= minX - radius && x <= maxX + radius && y >= minY - radius && y <= maxY + radius
      }).some(Boolean)
      if (!nearby) return false
      scene.traverseVisible(o => {
        const mesh = o as THREE.Mesh
        if (!mesh.isMesh || belongs(o, ignored)) return
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        if (materials.some(m => m.visible && (!m.transparent || m.opacity >= .5))) meshes.push(o)
      })
      const first = (px: number, py: number) => {
        if (!insideCanvas(canvas, px, py)) return undefined
        ndc.set((px - rect.left) / rect.width * 2 - 1, -(py - rect.top) / rect.height * 2 + 1)
        ray.setFromCamera(ndc, camera)
        return ray.intersectObjects(meshes, false)[0]
      }
      const underFinger = first(x, y)
      if (underFinger && belongs(underFinger.object, roots)) return true
      const fingerDepth = underFinger ? depth.copy(underFinger.point).applyMatrix4(camera.matrixWorldInverse).z : -Infinity
      const accepts = (px: number, py: number) => {
        if (Math.hypot(px - x, py - y) > radius + 1e-6) return false
        const hit = first(px, py)
        if (!hit || !belongs(hit.object, roots)) return false
        const targetDepth = depth.copy(hit.point).applyMatrix4(camera.matrixWorldInverse).z
        return !underFinger || fingerDepth <= targetDepth + .002
      }
      // Tiny beads get a stable central sample, including at the viewport edge.
      for (const root of roots) {
        const p = projectTouchPoint(canvas, camera, root)
        if (p && accepts(p.x, p.y)) return true
      }
      // A thin ring's visible edge can fall between the fixed pointer rings.
      // Sample its own projected extents as well, rather than requiring a ray
      // through the empty centre of a cup rim or flower marker.
      for (const b of bounds) {
        const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2
        for (const fraction of [.35, .7, .9]) for (const sign of [-1, 1]) {
          if (accepts(cx + sign * (b.maxX - b.minX) / 2 * fraction, cy)
            || accepts(cx, cy + sign * (b.maxY - b.minY) / 2 * fraction)) return true
        }
      }
      for (const scale of [.36, .72, 1]) for (let n = 0; n < 16; n++) {
        const angle = n * Math.PI / 8
        if (accepts(x + Math.cos(angle) * radius * scale, y + Math.sin(angle) * radius * scale)) return true
      }
      return false
    },
  }
}
