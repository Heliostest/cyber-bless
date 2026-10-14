import * as THREE from "three";
import type { GardenKind } from "./garden-layout";

// Wind bending and root-to-tip lighting adapted from boona13's MIT-licensed
// threejs-grass-water-shaders. See assets/environments/meadow/ for provenance.
const vertex = /* glsl */ `
  #include <common>
  #include <shadowmap_pars_vertex>
  #include <fog_pars_vertex>
  uniform float meadowTime;
  varying vec3 bladeColor;
  varying float bladeHeight;
  varying vec3 bladeNormal;
  void main() {
    vec3 transformed = position;
    vec3 origin = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    float tipWeight = uv.y * uv.y;
    float gust = sin(origin.x * .57 + origin.z * .31 - meadowTime * .85);
    float rustle = sin(origin.x * 2.1 - origin.z * 1.3 + meadowTime * 1.8);
    transformed.x += (.09 + gust * .11 + rustle * .025) * tipWeight;
    transformed.z += (.08 + gust * .065) * tipWeight;
    mat3 im = mat3(instanceMatrix);
    vec3 objectNormal = normal;
    vec3 transformedNormal = objectNormal / vec3(dot(im[0], im[0]), dot(im[1], im[1]), dot(im[2], im[2]));
    transformedNormal = normalize(normalMatrix * im * transformedNormal);
    bladeNormal = normalize(inverseTransformDirection(transformedNormal, viewMatrix));
    bladeColor = instanceColor;
    bladeHeight = uv.y;
    #include <project_vertex>
    #include <worldpos_vertex>
    #include <shadowmap_vertex>
    #include <fog_vertex>
  }
`;

const fragment = /* glsl */ `
  #include <common>
  #include <packing>
  #include <lights_pars_begin>
  #include <shadowmap_pars_fragment>
  #include <shadowmask_pars_fragment>
  #include <fog_pars_fragment>
  varying vec3 bladeColor;
  varying float bladeHeight;
  varying vec3 bladeNormal;
  void main() {
    vec3 n = normalize(bladeNormal) * (gl_FrontFacing ? 1.0 : -1.0);
    float sunlight = .72 + .28 * abs(dot(n, normalize(vec3(-6.0, 9.0, 5.0))));
    float shadow = mix(.6, 1.0, getShadowMask());
    vec3 tip = bladeColor + vec3(.10, .115, .025);
    vec3 color = mix(bladeColor * .69, tip, smoothstep(0.0, 1.0, bladeHeight));
    gl_FragColor = vec4(color * sunlight * shadow * 1.65, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

/** Broad, slow variations keep the ground readable even between the grass blades. */
function patch(x: number, z: number) {
  return .5 + .23 * Math.sin(x * .56 + Math.sin(z * .41) * 1.7)
    + .18 * Math.cos(z * .67 - Math.sin(x * .27) * 1.8)
    + .06 * Math.sin(x * 1.43 + z * .82);
}
const shade = new THREE.Color(0x619c44), sun = new THREE.Color(0xabc657), middle = new THREE.Color(0x83b44b);
function grassColor(x: number, z: number, target: THREE.Color) {
  const value = THREE.MathUtils.smoothstep(patch(x, z), .15, .88);
  return value < .5 ? target.copy(shade).lerp(middle, value * 2) : target.copy(middle).lerp(sun, (value - .5) * 2);
}

function createGroundMap() {
  const size = 256, bytes = new Uint8Array(size * size * 4), color = new THREE.Color(), rgb = { r: 0, g: 0, b: 0 };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    grassColor((x / (size - 1) - .5) * 100, (.5 - y / (size - 1)) * 100 - 12, color).getRGB(rgb, THREE.SRGBColorSpace);
    const i = (y * size + x) * 4;
    bytes.set([Math.round(rgb.r * 255), Math.round(rgb.g * 255), Math.round(rgb.b * 255), 255], i);
  }
  const texture = new THREE.DataTexture(bytes, size, size);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true; texture.needsUpdate = true;
  texture.name = "painted-meadow-patches";
  return texture;
}

/** Two curved blades cross in each tuft, so a modest count reads from all cameras. */
function tuftGeometry() {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (let blade = 0; blade < 2; blade++) {
    const angle = blade * Math.PI * .55;
    for (let row = 0; row <= 3; row++) {
      const t = row / 3, width = .045 * (1 - t) + .002, bend = t * t * .07;
      for (const side of [-1, 1]) {
        const x = side * width + bend;
        positions.push(Math.cos(angle) * x, t, Math.sin(angle) * x);
        uvs.push((side + 1) / 2, t);
      }
      if (row < 3) {
        const i = blade * 8 + row * 2;
        indices.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

function canGrow(kind: GardenKind, x: number, z: number) {
  if (Math.abs(x) < 2.2 && z > -2.2 && z < 3.2) return false;
  if (kind === "river") return Math.abs(x) > 2.68 && Math.abs(x) < 7.25;
  if (kind === "veranda" && Math.abs(x) < 6.2 && z > -2.8) return false;
  if (kind === "table" && Math.abs(x) < 3.2 && z > -1.6) return false;
  if (kind === "garden" && (x / 3.2) ** 2 + (z / 2.5) ** 2 < 1) return false;
  if (kind === "courtyard") {
    const t = THREE.MathUtils.clamp((4 - z) / 36, 0, 1), center = Math.sin(t * Math.PI * 1.5) * 1.6;
    if (Math.abs(x - center) < 1.4 - t * .65) return false;
  }
  return true;
}

export function createStylizedMeadow({ kind, floor, id }: { kind: GardenKind; floor: number; id: string }) {
  let seed = Array.from(id).reduce((n, char) => (n * 31 + char.charCodeAt(0)) >>> 0, 91);
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const points: [number, number, number][] = [];
  for (let z = -24; z < 3; z += .32) for (let x = -12; x < 12; x += .32) {
    const px = x + random() * .28, pz = z + random() * .28;
    if (canGrow(kind, px, pz) && random() > .12) points.push([px, pz, .21 + random() * .23]);
  }
  const groundMap = createGroundMap(), geometry = tuftGeometry();
  const material = new THREE.ShaderMaterial({
    name: "sunlit-meadow-blades", vertexShader: vertex, fragmentShader: fragment,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.lights, THREE.UniformsLib.fog, { meadowTime: { value: 0 } }]),
    lights: true, fog: true, side: THREE.DoubleSide,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, points.length);
  mesh.name = "windswept-meadow"; mesh.userData.toonSurface = { outline: false };
  mesh.castShadow = false; mesh.receiveShadow = true;
  const transform = new THREE.Object3D(), color = new THREE.Color();
  points.forEach(([x, z, height], i) => {
    transform.position.set(x, floor + (kind === "river" ? .08 : .006), z);
    transform.rotation.y = random() * Math.PI * 2; transform.scale.set(1, height, 1); transform.updateMatrix();
    mesh.setMatrixAt(i, transform.matrix); mesh.setColorAt(i, grassColor(x, z, color).multiplyScalar(.94 + random() * .12));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  // Include the maximum shader bend in the culling bounds.
  if (mesh.boundingSphere) mesh.boundingSphere.radius += .3;
  let disposed = false;
  return {
    mesh, groundMap,
    update(time: number) { if (!disposed) material.uniforms.meadowTime.value = time; },
    dispose() {
      if (disposed) return; disposed = true;
      mesh.removeFromParent(); mesh.dispose(); geometry.dispose(); material.dispose(); groundMap.dispose();
    },
  };
}
