import * as THREE from 'three';
import type { GardenKind } from './garden-layout';
import type { EnvironmentTone } from './debug-environment-tone';
import { canMeadowGrow } from './stylized-meadow';
import { createMeadowGrass, meadowInstanceTint, meadowSurfaceTint } from './komorebi/meadow-grass';
import { sampleMeadowField } from './komorebi/meadow-field';
import { environmentHash as hash } from './komorebi/meadow-layout';
import { createKomorebiSurface } from './komorebi-surface';

/** 0 away from the workbench; towards 1 within about 1–1.5 m of it, where props sit. */
export function meadowCalm(x: number, z: number) {
  const dx = Math.max(Math.abs(x) - 2.2, 0), dz = Math.max(-2.2 - z, z - 3.2, 0);
  return 1 - THREE.MathUtils.smoothstep(Math.hypot(dx, dz), .4, 1.5);
}

/** Low-contrast short strokes (mean .5) that read as close-cropped grass on the bare ground. */
function createGroundStrokes(seed: number) {
  const size = 256, field = new Float32Array(size * size);
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  for (let n = 0; n < 420; n++) {
    const cx = random() * size, cy = random() * size, length = 5 + random() * 7, angle = Math.PI / 2 + (random() - .5) * .9;
    const value = random() < .6 ? -1 : .8, dx = Math.cos(angle), dy = Math.sin(angle);
    for (let step = -length / 2; step <= length / 2; step += .5) {
      const taper = 1 - Math.abs(step) / (length / 2) * .6;
      for (let oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) {
        const px = Math.floor(cx + dx * step) + ox, py = Math.floor(cy + dy * step) + oy;
        const across = Math.abs((px + .5 - cx) * dy - (py + .5 - cy) * dx), weight = Math.max(0, 1 - across / 1.1) * taper;
        if (weight <= 0) continue;
        const at = ((py % size + size) % size) * size + ((px % size + size) % size);
        field[at] = Math.max(-1, Math.min(1, field[at] + value * weight * .35));
      }
    }
  }
  const mean = field.reduce((sum, value) => sum + value, 0) / field.length, bytes = new Uint8Array(size * size * 4);
  field.forEach((value, i) => { const v = Math.round(THREE.MathUtils.clamp(.5 + (value - mean) * .5, 0, 1) * 255); bytes.set([v, v, v, 255], i * 4); });
  const texture = new THREE.DataTexture(bytes, size, size);
  texture.name = 'komorebi-ground-strokes'; texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/** Adds the stroke detail to a Komorebi ground surface in world space, so stretched UVs never smear it. */
export function decorateMeadowGround(material: THREE.MeshPhongMaterial, strokes: THREE.Texture) {
  const compileSurface = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    compileSurface.call(material, shader, renderer);
    shader.uniforms.kmGroundStrokes = { value: strokes };
    shader.vertexShader = 'varying vec2 kmGroundXZ;\n' + shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nkmGroundXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
    shader.fragmentShader = 'uniform sampler2D kmGroundStrokes;\nvarying vec2 kmGroundXZ;\n' + shader.fragmentShader.replace('vec3 outgoingLight=clamp(', `
        // Two rotated scales hide the tile; mipmaps return the neutral mean in the distance.
        float kmStrokeA=texture2D(kmGroundStrokes,kmGroundXZ/1.37).r;
        float kmStrokeB=texture2D(kmGroundStrokes,mat2(.8,-.6,.6,.8)*kmGroundXZ/2.03+vec2(.31,.17)).r;
        kmPigment*=1.0+(kmStrokeA+kmStrokeB-1.0)*vec3(.30,.26,.20);
        vec3 outgoingLight=clamp(`);
  };
  material.customProgramCacheKey = () => 'komorebi-meadow-ground-v1';
  material.userData.komorebiGroundStrokes = strokes;
  return material;
}

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
    shader.vertexShader = 'uniform float kmGrassTime;\nattribute float kmCalm;\nvarying float kmTipCalm;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      // Near the workbench, quieter tips and gentler sway keep small props legible; the far meadow is unchanged.
      kmTipCalm = kmCalm * smoothstep(.04,.22,position.y);
      vec3 kmOrigin = (modelMatrix * instanceMatrix * vec4(0.0,0.0,0.0,1.0)).xyz;
      float kmTip = pow(clamp(position.y / .35,0.0,1.0),2.0);
      transformed.xz += vec2(sin(kmGrassTime*.85+kmOrigin.x*.57+kmOrigin.z*.31),
        cos(kmGrassTime*.71+kmOrigin.z*.43)) * .045 * kmTip * (1.0 - .55 * kmCalm);
    `);
    // Preserve the source's upward, soft normals on both sides of each ribbon.
    shader.fragmentShader = 'varying float kmTipCalm;\n' + shader.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', 'normal *= 1.0;'))
      .replace('vec3 outgoingLight=clamp(', 'kmPigment*=1.0-.2*kmTipCalm;\nvec3 outgoingLight=clamp(');
  };
  material.customProgramCacheKey = () => 'komorebi-meadow-v2';
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
      // About half as many tufts at the workbench edge, thinning out to the full field by 1.5 m.
      if (hash(x,z,seed+11) < meadowCalm(px,pz) * .5) continue;
      points.push([px,pz]);
    }
    geometry.setAttribute('kmCalm', new THREE.InstancedBufferAttribute(Float32Array.from(points, ([x,z]) => meadowCalm(x,z)), 1));
    const mesh = new THREE.InstancedMesh(geometry, material, points.length);
    mesh.name = `komorebi-grass-${variant}`; mesh.receiveShadow = true; mesh.userData.komorebiGrass = true;
    mesh.userData.toonSurface = { outline: false, shading: 'smooth' };
    points.forEach(([x,z],i) => {
      transform.position.set(x, floor + (kind === 'river' ? .08 : .006), z);
      transform.rotation.y = hash(x,z,seed+7) * Math.PI * 2;
      transform.scale.set(1, sampleMeadowField(x,z,seed).height * (1 - .2 * meadowCalm(x,z)), 1); transform.updateMatrix(); mesh.setMatrixAt(i,transform.matrix);
    });
    mesh.computeBoundingSphere(); if (mesh.boundingSphere) mesh.boundingSphere.radius += .1;
    batches.push({ mesh,points }); root.add(mesh);
  }
  const size = 256, bytes = new Uint8Array(size * size * 4), groundMap = new THREE.DataTexture(bytes,size,size);
  const groundStrokes = createGroundStrokes(seed);
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
  return { root, groundMap, groundStrokes, setTone,
    update(value: number) { time.value = value; },
    dispose() {
      if (disposed) return; disposed = true; root.removeFromParent();
      batches.forEach(({mesh})=>{ mesh.dispose(); mesh.geometry.dispose(); }); material.dispose(); groundMap.dispose(); groundStrokes.dispose();
    },
  };
}
