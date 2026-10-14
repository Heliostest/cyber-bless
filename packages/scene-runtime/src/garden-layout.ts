export type GardenKind = "garden" | "courtyard" | "veranda" | "table" | "river";
export type Planting = { model: string; x: number; z: number; scale: number; turn: number; lift?: number };

/** Small, repeatable edge gardens. The central craft area stays open. */
export function gardenLayout(kind: GardenKind, id: string): Planting[] {
  const result: Planting[] = [];
  let seed = Array.from(id).reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 17);
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const add = (model: string, x: number, z: number, scale: number, lift = 0) =>
    result.push({ model, x, z, scale, turn: random() * Math.PI * 2, lift });
  const riverside = kind === "river";
  const trees: [string, number, number, number][] = [
    ["tree-branching", -5.4, -6.9, 2.7], ["tree-round", 5.9, -7.8, 3.2],
    ["tree-round", -8.4, -12, 4.0], ["tree-slender", 8.1, -13.5, 3.6],
    ["tree-round", -4.2, -13.2, 2.7], ["tree-branching", 4.7, -17, 3.3],
  ];
  trees.forEach(([model, x, z, scale]) => add(model, x + (random() - .5) * .6, z, scale));
  // Groups of different heights read as planted beds, rather than evenly spaced props.
  const beds = riverside
    ? [[-3.15, -3.25], [3.45, -3.5], [-4.5, -6.3], [4.9, -7.3], [-6.9, -10.2], [6.8, -11.8]]
    : [[-2.3, -2.9], [2.65, -3.2], [-3.5, -5.2], [3.9, -6.3], [-5.2, -9.2], [5.4, -10.8]];
  beds.forEach(([x, z], i) => {
    const lift = riverside ? .07 : 0;
    add(i % 2 ? "bush" : "bush-detailed", x + Math.sign(x) * .35, z - .65, 1.65 + i * .06, lift);
    add(riverside ? "shore-leaves" : "ground-leaves", x, z, 1.25 + random() * .25, lift);
    for (let n = 0; n < 3; n++) add("grass", x + (n - 1) * .36, z + .15 + random() * .3, .8 + random() * .35, lift);
    if (!riverside) {
      add(i % 2 ? "flowers-purple" : "flowers", x - .3, z + .45, 2.1, lift);
      add(i % 2 ? "flowers" : "flowers-purple", x + .27, z + .12, 1.65, lift);
    }
    add("rock-flat", x + Math.sign(x) * .55, z + .12, 1.2, lift);
  });
  if (riverside) {
    for (const side of [-1, 1]) for (let i = 0; i < 5; i++) {
      add("shore-leaves", side * (2.85 + (i % 2) * .18), -.8 - i * 1.9, 1.55 + (i % 3) * .18, .07);
      add("rock-flat", side * (2.75 + (i % 2) * .12), -1.2 - i * 2.0, 1.25 + (i % 2) * .25, .06);
    }
  } else if (kind === "courtyard") {
    // Continue the existing curved path behind the subject, away from authored steps.
    for (let i = 0; i < 10; i++) {
      const z = -3.8 - i * 1.15, t = (4 - z) / 36;
      add("rock-flat", Math.sin(t * Math.PI * 1.5) * 1.6, z, 1.35 - i * .035, .012);
    }
  } else if (kind === "garden") {
    for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
      add(i % 2 ? "flowers" : "flowers-purple", side * (2.8 + i * .12), -.25 - i * .48, 1.7 + i * .12);
      add("grass", side * (2.85 + i * .13), -.65 - i * .45, .85);
    }
  }
  return result;
}
