import { Pass } from "postprocessing";
import * as THREE from "three";
import { RenderPixelatedPass } from "three/addons/postprocessing/RenderPixelatedPass.js";
import { MoebiusNormals } from "./moebius-normals";

/** Bridge the installed Three.js pixel shader into pmndrs, preserving source face
 * sides and alpha. No camera snapping: pointer rays keep the authored camera.
 */
export class PixelArtPass extends Pass {
  private readonly pixels: RenderPixelatedPass;
  private readonly normals: MoebiusNormals;
  private width = 1;
  private height = 1;
  /** Size in CSS pixels, independent of the renderer's device pixel ratio. */
  pixelSize = 3;

  constructor(private readonly worldScene: THREE.Scene, private readonly viewCamera: THREE.Camera) {
    super("PixelArt");
    this.pixels = new RenderPixelatedPass(3,worldScene,viewCamera,{ normalEdgeStrength: 0.25, depthEdgeStrength: 0.4 });
    // r170 multiplies alpha by edge brightness; dark outlines must stay opaque.
    this.pixels.pixelatedMaterial.fragmentShader = `uniform sampler2D tSubjectDepth;\n` + this.pixels.pixelatedMaterial.fragmentShader.replace(
      "gl_FragColor = texel * Strength;", "gl_FragColor = vec4(texel.rgb * Strength, texel.a);",
    ).replace(
      "return texture2D( tNormal, vUv + vec2(x, y) * resolution.zw ).rgb * 2.0 - 1.0;",
      `vec2 coord = vUv + vec2(x, y) * resolution.zw;
       vec4 sampleNormal = texture2D(tNormal, coord);
       float visibleDepth = texture2D(tDepth, coord).r;
       float subjectDepth = texture2D(tSubjectDepth, coord).r;
       if (sampleNormal.a < 0.5 || abs(visibleDepth - subjectDepth) > 0.000002) return vec3(0.0, 0.0, 1.0);
       return sampleNormal.rgb * 2.0 - 1.0;`,
    );
    this.normals = new MoebiusNormals(worldScene,viewCamera);
    // Subject normals alone would leak highlights through nonselected occluders.
    this.pixels.pixelatedMaterial.uniforms.tSubjectDepth = new THREE.Uniform(this.normals.target.depthTexture);
  }

  setSize(width: number, height: number) {
    this.width = width; this.height = height;
    this.pixels.setSize(Math.max(width,this.pixels.pixelSize),Math.max(height,this.pixels.pixelSize));
    this.normals.setSize(this.pixels.renderResolution.x,this.pixels.renderResolution.y);
  }

  render(renderer: THREE.WebGLRenderer, _input: THREE.WebGLRenderTarget | null, output: THREE.WebGLRenderTarget | null) {
    const autoClear = renderer.autoClear, target = renderer.getRenderTarget();
    try {
      const size = this.pixelSize*renderer.getPixelRatio();
      if (this.pixels.pixelSize !== size) { this.pixels.pixelSize = size; this.setSize(this.width,this.height); }
      renderer.autoClear = true;
      renderer.setRenderTarget(this.pixels.beautyRenderTarget);
      renderer.render(this.worldScene,this.viewCamera);
      const subjects: THREE.Mesh[] = [];
      this.worldScene.traverse(object => {
        if (!(object instanceof THREE.Mesh) || object.userData.toonSurface?.outline === false) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        if (materials.some(material => !material.transparent && (material instanceof THREE.MeshStandardMaterial ||
          material instanceof THREE.MeshPhongMaterial || material instanceof THREE.MeshLambertMaterial || material instanceof THREE.MeshToonMaterial))) subjects.push(object);
      });
      this.normals.selection.set(subjects);
      this.normals.render(renderer);
      const uniforms = this.pixels.pixelatedMaterial.uniforms;
      uniforms.tDiffuse.value = this.pixels.beautyRenderTarget.texture;
      uniforms.tDepth.value = this.pixels.beautyRenderTarget.depthTexture;
      uniforms.tNormal.value = this.normals.target.texture;
      uniforms.normalEdgeStrength.value = this.pixels.normalEdgeStrength;
      uniforms.depthEdgeStrength.value = this.pixels.depthEdgeStrength;
      renderer.setRenderTarget(output);
      this.pixels.fsQuad.render(renderer);
    } finally { renderer.autoClear = autoClear; renderer.setRenderTarget(target); }
  }

  dispose() { this.normals.dispose(); this.pixels.dispose(); }
}
