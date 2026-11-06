import * as THREE from 'three';
import type { GardenKind } from './garden-layout';
import type { EnvironmentTone } from './debug-environment-tone';
import { canMeadowGrow } from './stylized-meadow';
import { createMeadowGrass, meadowInstanceTint, meadowSurfaceTint } from './komorebi/meadow-grass';
import { sampleMeadowField } from './komorebi/meadow-field';
import { environmentHash as hash } from './komorebi/meadow-layout';
import { createKomorebiSurface } from './komorebi-surface';

/** Original Komorebi ribbon geometry and coherent growth field, placed in Cyber Bless's garden. */
export function createKomorebiMeadow({ kind, floor, id }: { kind: GardenKind; floor: number; id: string }) {
  const root = new THREE.Group(); root.name = 'komorebi-meadow';
  const seed = Array.from(id).reduce((n, char) => (n * 31 + char.charCodeAt(0)) >>> 0, 91);
  const time = { value: 0 }, color = new THREE.Color(), transform = new THREE.Object3D();
  const material = createKomorebiSurface(); material.vertexColors = true; material.side = THREE.DoubleSide;
  material.name = 'Komorebi meadow ribbons'; material.userData.komorebiPigment = true;
  material.userData.komorebiGrass = true;
  const compileSurface = material.onBeforeCompile;
  material.onBeforeCompile = (shader,renderer) => {
    compileSurface.call(material,shader,renderer);
    shader.uniforms.kmGrassTime = time;
    shader.vertexShader = 'uniform float kmGrassTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vec3 kmOrigin = (modelMatrix * instanceMatrix * vec4(0.0,0.0,0.0,1.0)).xyz;
      float kmTip = pow(clamp(position.y / .35,0.0,1.0),2.0);
      transformed.xz += vec2(sin(kmGrassTime*.85+kmOrigin.x*.57+kmOrigin.z*.31),
        cos(kmGrassTime*.71+kmOrigin.z*.43)) * .045 * kmTip;
    `);
    // Preserve the source's upward, soft normals on both sides of each ribbon.
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', 'normal *= 1.0;'));
  };
  material.customProgramCacheKey = () => 'komorebi-meadow-v1';
  const batches: { mesh: THREE.InstancedMesh; points: [number, number][] }[] = [];
  for (let variant = 0; variant < 3; variant++) {
    const data = createMeadowGrass(variant, '#74a951', 'meadow'), geometry = new THREE.BufferGeometry(), colors: number[] = [];
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
    for (let i = 0; i < data.colors.length; i += 4) {
      colors.push(...data.colors.slice(i, i + 3));
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.setIndex(data.indices); geometry.computeVertexNormals();
    const normals = geometry.getAttribute('normal');
    for (let i = 0; i < normals.count; i++) { color.setRGB(normals.getX(i) * .3, .85 + normals.getY(i) * .15, normals.getZ(i) * .3); const length = Math.hypot(color.r,color.g,color.b); normals.setXYZ(i,color.r/length,color.g/length,color.b/length); }
    const points: [number, number][] = [];
    for (let z = -24; z < 3; z += .58) for (let x = -12; x < 12; x += .58) {
      if (Math.floor(hash(x,z,seed) * 3) !== variant) continue;
      const px = x + hash(x,z,seed+1) * .35, pz = z + hash(x,z,seed+2) * .35;
      const field = sampleMeadowField(px,pz,seed);
      // Check the entire .34m tuft plus the maximum wind excursion against hard surfaces.
      const margin = .43;
      if ([-margin,0,margin].some(dx => [-margin,0,margin].some(dz => !canMeadowGrow(kind,px+dx,pz+dz))) || hash(x,z,seed+3) > .44 + field.density * .53) continue;
      points.push([px,pz]);
    }
    const mesh = new THREE.InstancedMesh(geometry, material, points.length);
    mesh.name = `komorebi-grass-${variant}`; mesh.receiveShadow = true; mesh.userData.komorebiGrass = true;
    mesh.userData.toonSurface = { outline: false, shading: 'smooth' };
    points.forEach(([x,z],i) => {
      transform.position.set(x, floor + (kind === 'river' ? .08 : .006), z);
      transform.rotation.y = hash(x,z,seed+7) * Math.PI * 2;
      transform.scale.set(1, sampleMeadowField(x,z,seed).height, 1); transform.updateMatrix(); mesh.setMatrixAt(i,transform.matrix);
    });
    mesh.computeBoundingSphere(); if (mesh.boundingSphere) mesh.boundingSphere.radius += .1;
    batches.push({ mesh,points }); root.add(mesh);
  }
  const size = 256, bytes = new Uint8Array(size * size * 4), groundMap = new THREE.DataTexture(bytes,size,size);
  groundMap.name = 'painted-meadow-patches'; groundMap.colorSpace = THREE.SRGBColorSpace;
  groundMap.magFilter = THREE.LinearFilter; groundMap.minFilter = THREE.LinearMipmapLinearFilter; groundMap.generateMipmaps = true;
  let disposed = false;
  let deliveryPalette: boolean | undefined;
  function setTone(tone: EnvironmentTone) {
    if (disposed) return;
    const delivery = tone === 'tiny-delivery';
    if (deliveryPalette === delivery) return;
    deliveryPalette = delivery;
    for (let row=0;row<size;row++) for (let col=0;col<size;col++) {
      const x=(col/(size-1)-.5)*100,z=(.5-row/(size-1))*100-12;
      const value=meadowSurfaceTint(x,z,seed);
      if (delivery) color.set(0x83bf3b).multiplyScalar(.78+value*.27);
      else color.setRGB(0x74/255*(.82+value*.35),0xa9/255*(.7+value*.22),0x51/255*(.6+value*.16));
      const rgb=color.getRGB({r:0,g:0,b:0},THREE.SRGBColorSpace), at=(row*size+col)*4;
      bytes.set([rgb.r*255,rgb.g*255,rgb.b*255,255],at);
    }
    groundMap.needsUpdate = true;
    for (const {mesh,points} of batches) {
      points.forEach(([x,z],i) => { const tint=meadowInstanceTint(x,z,seed); color.setRGB(tint[0],tint[1],tint[2]); if (delivery) color.multiply(new THREE.Color(1.07,1.02,.8)); mesh.setColorAt(i,color); });
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }
  setTone('original');
  return { root, groundMap, setTone,
    update(value: number) { time.value = value; },
    dispose() {
      if (disposed) return; disposed = true; root.removeFromParent();
      batches.forEach(({mesh})=>{ mesh.dispose(); mesh.geometry.dispose(); }); material.dispose(); groundMap.dispose();
    },
  };
}
