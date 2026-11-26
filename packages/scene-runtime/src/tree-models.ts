export type TreePlacement = {
  x: number;
  z: number;
  /** Tree height in world units: imported models are normalized to grounded unit height. */
  scale: number;
  turn: number;
  lift?: number;
  variant?: 'round' | 'cluster';
};

export const TREE_SPECIES = ['oak', 'cherry', 'cypress', 'willow', 'conifer', 'toona', 'acer', 'maple'] as const;
export type TreeSpecies = typeof TREE_SPECIES[number];

export const TREE_RENDER_METHODS = ['scene', 'quaternius', 'simple-tree', 'komorebi', 'oak', 'cherry', 'cypress', 'willow', 'conifer', 'toona', 'acer', 'maple'] as const;
export type TreeRenderMethod = typeof TREE_RENDER_METHODS[number];

export type TreeModelSet = { round: string; cluster: string };
const pair = (directory: string, prefix = ''): TreeModelSet => ({ round: `${directory}/${prefix}round.glb`, cluster: `${directory}/${prefix}cluster.glb` });
const sets: Record<Exclude<TreeRenderMethod, 'scene'>, TreeModelSet> = {
  quaternius: pair('quaternius'),
  'simple-tree': pair('simple-tree'),
  komorebi: pair('komorebi'),
  oak: pair('simple-tree'),
  // Flowering cherry is a product adaptation of the pinned generator's oak
  // branches and foliage pipeline, with a spreading crown and blossom atlas.
  cherry: pair('simple-tree', 'cherry-'),
  cypress: pair('simple-tree', 'cypress-'),
  willow: pair('simple-tree', 'willow-'),
  // The upstream key is pine; its documented silhouette is fir-like, not a
  // botanical identification of Japanese garden pines or another Pinus species.
  conifer: pair('simple-tree', 'pine-'),
  // Product adaptations of the pinned oak/foliage pipeline with distinct leaf
  // atlases and branch parameters; these are not native upstream species.
  toona: pair('simple-tree', 'toona-'),
  acer: pair('simple-tree', 'acer-'),
  maple: pair('simple-tree', 'maple-'),
};

export function resolveTreeModelSet(method: TreeRenderMethod, recommendation: TreeSpecies = 'oak'): TreeModelSet {
  const selected = method === 'scene' ? recommendation : method;
  return sets[selected];
}
