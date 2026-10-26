import * as THREE from 'three'

/** A carried object's contact anchor owns arrival. The fingertip can be offset
 * from it, and reaching the target with that fingertip alone is not placement. */
export function placementHit(
  canvas: HTMLCanvasElement,
  camera: THREE.Camera,
  grip: THREE.Object3D,
  x: number,
  y: number,
  hit: (x: number, y: number) => boolean,
  anchor: [number, number, number] = [0, 0, 0],
) {
  // Captured release outside the stage is an abandoned drop; a clamped object
  // or a ray that missed the drag plane can otherwise retain a stale valid pose.
  const rect = canvas.getBoundingClientRect()
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < rect.left || x > rect.left + rect.width || y < rect.top || y > rect.top + rect.height) return false
  grip.updateWorldMatrix(true, false); camera.updateWorldMatrix(true, false)
  const point = grip.localToWorld(new THREE.Vector3(...anchor)).project(camera)
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || Math.abs(point.z) > 1) return false
  return hit(rect.left + (point.x + 1) * rect.width / 2, rect.top + (1 - point.y) * rect.height / 2)
}
