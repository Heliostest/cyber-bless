import { Pass, RenderPass, Selection } from "postprocessing";
import * as THREE from "three";

/** Subject-only normal/depth buffer; grass and large backdrops stay out of the ink. */
export class MoebiusNormals extends Pass {
  readonly selection = new Selection();
  readonly target = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedIntType),
  });
  private readonly materials = new Map<THREE.Material, THREE.MeshNormalMaterial>();
  private readonly draw: RenderPass;

  constructor(scene: THREE.Scene, camera: THREE.Camera) {
    super("MoebiusNormals");
    this.needsSwap = false;
    this.draw = new RenderPass(scene, camera);
    this.draw.selection = this.selection;
    this.draw.ignoreBackground = true;
    this.draw.skipShadowMapUpdate = true;
    this.draw.clearPass.overrideClearColor = new THREE.Color(0);
    this.draw.clearPass.overrideClearAlpha = 0;
  }

  setSize(width: number, height: number) { this.target.setSize(width, height); }
  render(renderer: THREE.WebGLRenderer) {
    const swaps: [THREE.Mesh, THREE.Material | THREE.Material[]][] = [];
    const live = new Set<THREE.Material>();
    const normalFor = (source: THREE.Material) => {
      live.add(source);
      let normal = this.materials.get(source);
      const surface = source as THREE.MeshStandardMaterial;
      if (!normal) {
        normal = new THREE.MeshNormalMaterial({
          side: source.side,
          flatShading: surface.flatShading ?? false,
          displacementMap: surface.displacementMap ?? null,
          displacementScale: surface.displacementScale ?? 1,
          displacementBias: surface.displacementBias ?? 0,
          polygonOffset: source.polygonOffset,
          polygonOffsetFactor: source.polygonOffsetFactor,
          polygonOffsetUnits: source.polygonOffsetUnits,
        });
        this.materials.set(source, normal);
      }
      if (normal.side !== source.side) { normal.side = source.side; normal.needsUpdate = true; }
      normal.visible = source.visible && !source.transparent;
      return normal;
    };
    try {
      for (const object of this.selection) {
        if (!(object instanceof THREE.Mesh)) continue;
        const source = object.material;
        swaps.push([object, source]);
        // Preserve group-specific face sides: a paper mesh can have front, back
        // and double-sided groups. A single override silently loses paper faces.
        object.material = Array.isArray(source) ? source.map(normalFor) : normalFor(source);
      }
      this.draw.render(renderer, this.target, null);
    } finally {
      for (const [mesh, source] of swaps) mesh.material = source;
      for (const [source, normal] of this.materials) {
        if (!live.has(source)) { normal.dispose(); this.materials.delete(source); }
      }
    }
  }
  dispose() {
    this.selection.clear();
    this.draw.dispose();
    this.materials.forEach(material => material.dispose());
    this.materials.clear();
    this.target.dispose();
  }
}
