import * as THREE from 'three';

const configured = new WeakSet<THREE.Material>();

/** The source cards carry outward clump normals, independent of card winding. */
export function softenTreeFoliage(material: THREE.Material) {
  if (configured.has(material)) return;
  configured.add(material);
  material.userData.treeClusterNormals = true;
  const compile = material.onBeforeCompile, cacheKey = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    compile.call(material, shader, renderer);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', '// Keep outward source clump normals on both sides of a leaf card.'))
      .replace('#include <color_fragment>', THREE.ShaderChunk.color_fragment.replace('diffuseColor.rgb *= vColor;', 'diffuseColor.rgb *= mix( vec3( 1.0 ), vColor, 0.68 );'));
    // Broad, matte light wraps around a leaf clump instead of cutting each card
    // at the Lambert terminator. Keep the deliberately banded ink styles intact.
    const wrappedIncidence = '0.72 * saturate( ( dot( geometryNormal, directLight.direction ) + 0.55 ) / 1.55 )';
    shader.fragmentShader = shader.fragmentShader
      // GGX must use the real incidence. With outward clump normals, both
      // N.L and N.V can be zero; feeding wrapped light into its grazing-angle
      // visibility term creates enormous specular values and white patches.
      .replace('#include <lights_physical_pars_fragment>', THREE.ShaderChunk.lights_physical_pars_fragment.replace(
        'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );',
        `reflectedLight.directDiffuse += ${wrappedIncidence} * directLight.color * BRDF_Lambert( material.diffuseColor );`,
      ))
      .replace('#include <lights_lambert_pars_fragment>', THREE.ShaderChunk.lights_lambert_pars_fragment.replace(
        'float dotNL = saturate( dot( geometryNormal, directLight.direction ) );',
        `float dotNL = ${wrappedIncidence};`,
      ));
  };
  material.customProgramCacheKey = () => `tree-clump-soft-v2:${cacheKey()}`;
  material.needsUpdate = true;
}
