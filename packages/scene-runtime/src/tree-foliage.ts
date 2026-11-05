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
    for (const chunk of ['lights_physical_pars_fragment', 'lights_lambert_pars_fragment'] as const) {
      shader.fragmentShader = shader.fragmentShader.replace(`#include <${chunk}>`, THREE.ShaderChunk[chunk].replace(
        'float dotNL = saturate( dot( geometryNormal, directLight.direction ) );',
        'float dotNL = 0.72 * saturate( ( dot( geometryNormal, directLight.direction ) + 0.55 ) / 1.55 );',
      ));
    }
  };
  material.customProgramCacheKey = () => `tree-clump-soft-v1:${cacheKey()}`;
  material.needsUpdate = true;
}
