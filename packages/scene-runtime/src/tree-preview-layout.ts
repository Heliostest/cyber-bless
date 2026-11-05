import * as THREE from 'three';
import type { TreePlacement } from './stylized-trees';

export type TreePreviewShape = { anchor: THREE.Vector3; points: Float32Array; woodPoints: Float32Array; canopyBase: number; lean: number };
export type TreePreviewPlacement = TreePlacement & { orientation?: THREE.Quaternion };

/** Camera-aware planting for the local tree preview; the authored garden stays intact. */
export function treePreviewLayout(camera: THREE.Camera, groundY: number, { anchor, points, woodPoints, canopyBase, lean }: TreePreviewShape) {
  if (!(camera instanceof THREE.PerspectiveCamera || camera instanceof THREE.OrthographicCamera)) return undefined;
  camera.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(), base = new THREE.Vector3();
  const down = -camera.getWorldDirection(new THREE.Vector3()).y;
  // A tabletop camera looks down: plant beside the work instead of immediately
  // below the lens, where a full tree would surround the camera with branches.
  const rootY = THREE.MathUtils.lerp(-1.20, -.05, THREE.MathUtils.smoothstep(down, .12, .60));
  ray.setFromCamera(new THREE.Vector2(0, rootY), camera);
  const ground = groundY + .014;
  if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -ground), base)) return undefined;
  const viewBase = base.clone().applyMatrix4(camera.matrixWorldInverse);
  const up = new THREE.Vector3(0, 1, 0).transformDirection(camera.matrixWorldInverse);
  const projection = camera.projectionMatrix.elements;
  const perspective = camera instanceof THREE.PerspectiveCamera;
  // The crown continues above the picture while its grounded trunk is cropped
  // at the side/bottom. Fit the lower crown to the upper frame.
  const canopyY = 1.0;
  const heightAtCanopy = perspective
    ? (-canopyY * viewBase.z - projection[5] * viewBase.y) / (projection[5] * up.y + canopyY * up.z)
    : (canopyY - projection[5] * viewBase.y - projection[13]) / (projection[5] * up.y);
  const scale = heightAtCanopy / canopyBase;
  if (!Number.isFinite(scale) || scale <= 0 || viewBase.z >= -camera.near) return undefined;
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0); right.y = 0; right.normalize();
  return (item: TreePlacement, index: number): TreePreviewPlacement => {
    if (index >= 2) return { ...item, x: item.x * .90, z: item.z * .82, scale: item.scale * 1.05 };
    const side = index === 0 ? -1 : 1;
    const upAxis = new THREE.Vector3(0, 1, 0), axis = right.clone().cross(upAxis).normalize();
    const tilt = new THREE.Quaternion().setFromAxisAngle(axis, side * lean);
    const stem = base.clone().add(new THREE.Vector3(0, scale * .20, 0).applyQuaternion(tilt));
    const viewStem = stem.clone().applyMatrix4(camera.matrixWorldInverse);
    const x = stem.project(camera).x;
    const shift = (side * 1.02 - x) * (perspective ? -viewStem.z : 1) / projection[0];
    let best: TreePreviewPlacement | undefined, bestScore = -Infinity;
    // Turn the same asymmetric source tree to expose a partial trunk and an
    // overhanging bough. This changes planting orientation, never its geometry.
    for (let turn = 0; turn < 4; turn++) {
      const orientation = tilt.clone().multiply(new THREE.Quaternion().setFromAxisAngle(upAxis, item.turn + turn * Math.PI / 2));
      const position = base.clone().addScaledVector(right, shift);
      const offset = anchor.clone().applyQuaternion(orientation).multiplyScalar(scale);
      position.sub(offset); position.y = ground;
      const transform = new THREE.Matrix4().compose(position, orientation, new THREE.Vector3(scale, scale, scale));
      const view = camera.matrixWorldInverse.clone().multiply(transform), point = new THREE.Vector3(), screen = new THREE.Vector3();
      let clearance = 0;
      // An asymmetric bough must not cover the work just because its trunk fits.
      for (let i = 0; i < points.length; i += 3) {
        point.fromArray(points, i).applyMatrix4(view);
        if (point.z >= -camera.near || point.z <= -camera.far) continue;
        screen.copy(point).applyMatrix4(camera.projectionMatrix);
        if (screen.y < -1.1 || screen.y > .35) continue;
        const move = (side * .52 - screen.x) * (perspective ? -point.z : 1) / projection[0];
        clearance = side < 0 ? Math.min(clearance, move) : Math.max(clearance, move);
      }
      position.addScaledVector(right, clearance); transform.setPosition(position);
      view.multiplyMatrices(camera.matrixWorldInverse, transform);
      let score = 0;
      for (const [vertices, wood] of [[points, false], [woodPoints, true]] as const) {
        for (let i = 0; i < vertices.length; i += 3) {
          point.fromArray(vertices, i).applyMatrix4(view);
          if (point.z >= -camera.near || point.z <= -camera.far) continue;
          point.applyMatrix4(camera.projectionMatrix);
          if (Math.abs(point.x) > 1 || Math.abs(point.y) > 1) continue;
          score += wood ? (point.y < .65 ? 8 : 3) : point.y > .35 && Math.abs(point.x) < .85 ? 2 : .2;
        }
      }
      if (score > bestScore) {
        bestScore = score; best = { ...item, x: position.x, z: position.z, scale, lift: 0, orientation };
      }
    }
    return best!;
  };
}
