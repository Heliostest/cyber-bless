import * as THREE from 'three';

/** Product ornament from this scene's icon: two coral, four-petal flowers.
 * Opaque paint follows the glass surface; it does not share its transmission.
 */
export function createFurinPaintedFlowers(radius: number) {
  const root = new THREE.Group(); root.name = 'furin-painted-flowers';
  const coral = new THREE.MeshStandardMaterial({ color: 0xf48b81, roughness: .78, metalness: 0, side: THREE.DoubleSide });
  const pink = new THREE.MeshStandardMaterial({ color: 0xf59a8d, roughness: .78, metalness: 0, side: THREE.DoubleSide });
  const petal = new THREE.Shape();
  petal.moveTo(0, .009);
  petal.bezierCurveTo(-.014, .017, -.024, .033, -.016, .050);
  petal.bezierCurveTo(-.012, .061, -.004, .065, 0, .058);
  petal.bezierCurveTo(.004, .065, .012, .061, .016, .050);
  petal.bezierCurveTo(.024, .033, .014, .017, 0, .009);
  petal.closePath();
  const dot = new THREE.Shape(); dot.absarc(0, 0, .0055, 0, Math.PI * 2, false);
  for (const [name, x, y, size, turn] of [
    ['right-upper', .52, .43, 1, .18],
    ['left-lower', -.58, .12, .66, -.15],
  ] as const) {
    const flower = new THREE.Group(); flower.name = `furin-flower-${name}`;
    const normal = new THREE.Vector3(x, y, Math.sqrt(1 - x * x - y * y));
    const right = new THREE.Vector3(1, 0, 0).addScaledVector(normal, -normal.x).normalize();
    const up = new THREE.Vector3().crossVectors(normal, right).normalize();
    const scale = size * radius / .26;
    function paintedPart(shape: THREE.Shape, angle: number, material: THREE.MeshStandardMaterial, name: string) {
      const flat = new THREE.ShapeGeometry(shape, 12);
      const positions = flat.getAttribute('position'), indices = flat.getIndex()!;
      const vertices: number[] = [], normals: number[] = [];
      const point = new THREE.Vector3();
      const project = (v: THREE.Vector2) => {
        const a = (v.x * Math.cos(angle) - v.y * Math.sin(angle)) * scale;
        const b = (v.x * Math.sin(angle) + v.y * Math.cos(angle)) * scale;
        point.copy(normal).multiplyScalar(radius).addScaledVector(right, a).addScaledVector(up, b).normalize();
        normals.push(point.x, point.y, point.z);
        vertices.push(point.x * (radius + .0015), point.y * (radius + .0015), point.z * (radius + .0015));
      };
      for (let i = 0; i < indices.count; i += 3) {
        const triangle = [0, 1, 2].map(n => new THREE.Vector2(positions.getX(indices.getX(i + n)), positions.getY(indices.getX(i + n))));
        const [a, b, c] = triangle;
        const ab = a.clone().add(b).multiplyScalar(.5), bc = b.clone().add(c).multiplyScalar(.5), ca = c.clone().add(a).multiplyScalar(.5);
        // Subdivide before projection so even triangle interiors hug the dome.
        [a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca].forEach(project);
      }
      flat.dispose();
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      const mesh = new THREE.Mesh(geometry, material); mesh.name = name;
      mesh.userData.toonSurface = { outline: false, shading: 'smooth' };
      flower.add(mesh);
    }
    for (let i = 0; i < 4; i++) paintedPart(petal, turn + i * Math.PI / 2, i % 2 ? pink : coral, `furin-painted-petal-${i}`);
    paintedPart(dot, 0, coral, 'furin-painted-flower-center');
    root.add(flower);
  }
  return root;
}
