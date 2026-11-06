export const TREE_RENDER_METHODS = ['original', 'scene', 'quaternius', 'simple-tree', 'komorebi', 'cherry', 'cypress', 'willow', 'conifer', 'toona', 'acer', 'maple'] as const;
export type TreeRenderMethod = typeof TREE_RENDER_METHODS[number];
export type TreeSpecies = 'original' | 'cherry' | 'cypress' | 'willow' | 'conifer' | 'toona' | 'acer' | 'maple';
export type TreeModelSet = { round: string; cluster: string };
const pair = (directory: string, prefix = ''): TreeModelSet => ({ round: `${directory}/${prefix}round.glb`, cluster: `${directory}/${prefix}cluster.glb` });
const sets: Record<Exclude<TreeRenderMethod, 'original' | 'scene'>, TreeModelSet> = {
  quaternius: pair('quaternius'),
  'simple-tree': pair('simple-tree'),
  komorebi: pair('komorebi'),
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

export function resolveTreeModelSet(method: TreeRenderMethod, recommendation: TreeSpecies = 'original'): TreeModelSet | undefined {
  const selected = method === 'scene' ? recommendation : method;
  return selected === 'original' ? undefined : sets[selected];
}
