import * as THREE from 'three';

/** Source StandardMaterial response: matte diffuse, clamped lighting before pigment, no HDR reflection. */
export function createKomorebiSurface(source?: THREE.MeshStandardMaterial) {
  const material = new THREE.MeshPhongMaterial({
    color: source?.color ?? 0xffffff, map: source?.map ?? null,
    vertexColors: source?.vertexColors ?? false, side: source?.side ?? THREE.FrontSide,
    transparent: source?.transparent ?? false, opacity: source?.opacity ?? 1,
    alphaTest: source?.alphaTest ?? 0, shininess: 64,
  });
  material.specular.setRGB(.025,.025,.025);
  material.name = source?.name ?? 'Komorebi diffuse surface';
  material.userData = { ...source?.userData, komorebiSurface: true, komorebiPigment: true };
  material.onBeforeCompile = shader => {
    // Babylon clamps the light sum before multiplying texture/vertex colors.
    // PBR's added environment reflection and unclamped irradiance wash out these pigments.
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <color_fragment>', '')
      .replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''))
      .replace('#include <lights_phong_fragment>', THREE.ShaderChunk.lights_phong_fragment.replace('material.diffuseColor = diffuseColor.rgb;', 'material.diffuseColor = vec3( 1.0 );'))
      .replace('vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;', /* glsl */ `
        vec3 kmPigment=diffuseColor.rgb;
        #if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
          kmPigment*=vColor.rgb;
        #endif
        vec3 outgoingLight=clamp(reflectedLight.directDiffuse+reflectedLight.indirectDiffuse,0.0,1.0)*kmPigment
          +reflectedLight.directSpecular+totalEmissiveRadiance;
      `)
      // StandardMaterial's default.fragment explicitly calls toLinearSpace
      // after its legacy light/pigment multiplication and before image processing.
      // Treating that result as linear directly lifts dark greens into cyan/pastel.
      .replace('#include <opaque_fragment>', 'outgoingLight=pow(max(outgoingLight,vec3(0.0)),vec3(2.2));\n#include <opaque_fragment>');
  };
  material.customProgramCacheKey = () => 'komorebi-source-diffuse-v1';
  return material;
}

/** Convert before load ownership is recorded, so transaction disposal includes the adapted materials. */
export function adaptKomorebiModel(root: THREE.Group) {
  const replacements = new Map<THREE.MeshStandardMaterial, THREE.MeshPhongMaterial>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const adapt = (material: THREE.Material) => {
      if (!(material instanceof THREE.MeshStandardMaterial)) return material;
      if (!replacements.has(material)) replacements.set(material,createKomorebiSurface(material));
      return replacements.get(material)!;
    };
    object.material=Array.isArray(object.material)?object.material.map(adapt):adapt(object.material);
  });
  replacements.forEach((_next,source)=>source.dispose());
}
