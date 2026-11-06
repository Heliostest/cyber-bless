export const MEADOW_GRASS_RADIUS = .34;
export function environmentHash(x: number, z: number, seed = 0) {
  const n = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453;
  return n - Math.floor(n);
}
