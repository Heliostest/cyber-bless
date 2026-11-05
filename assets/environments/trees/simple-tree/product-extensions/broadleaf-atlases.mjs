// Product-authored leaf silhouettes for the pinned MIT source engine.
// These Canvas masks are botanical art studies, not species-certified models.
// All wood, clump scatter, card curvature/normals, AO and GLB export stay in
// the original engine. No photographs, geometry or external textures used.

function leaflet(ctx, length, width) {
  ctx.moveTo(0, length * 0.08);
  ctx.bezierCurveTo(-width, -length * 0.1, -width * 0.7, -length * 0.7, 0, -length);
  ctx.bezierCurveTo(width * 0.7, -length * 0.7, width, -length * 0.1, 0, length * 0.08);
  ctx.closePath();
}

// An entire pinnate leaf: six opposing pairs and a terminal leaflet. Broad
// oval leaflets taper gently; the rachis is visible through the open gaps.
// Thirteen leaflets is a product simplification within the reference range.
function compoundLeaf(ctx, length, random) {
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(0, length * 0.5);
  ctx.quadraticCurveTo(length * 0.035, 0, 0, -length * 0.49);
  ctx.stroke();
  for (let pair = 0; pair < 6; pair++) {
    const at = pair / 5;
    const y = length * (0.35 - at * 0.7);
    const size = length * (0.19 + Math.sin(at * Math.PI) * 0.075) * (0.92 + random() * 0.16);
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * 0.5, y + side * length * 0.012);
      ctx.rotate(side * (0.93 + random() * 0.12));
      ctx.beginPath();
      leaflet(ctx, size, size * 0.31);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.save();
  ctx.translate(0, -length * 0.42);
  ctx.beginPath();
  leaflet(ctx, length * 0.23, length * 0.07);
  ctx.fill();
  ctx.restore();
}

export function toonaCompoundCluster(ctx, random) {
  ctx.fillStyle = '#fff';
  for (let sprig = 0; sprig < 10; sprig++) {
    const bearing = random() * Math.PI * 2;
    const distance = Math.sqrt(random()) * 68;
    ctx.save();
    ctx.translate(Math.cos(bearing) * distance, Math.sin(bearing) * distance);
    ctx.rotate(bearing + (random() - 0.5) * 1.2);
    compoundLeaf(ctx, 65 + random() * 24, random);
    ctx.restore();
  }
}

// Round every corner slightly while retaining the lobe/sinus silhouette.
// This avoids saw-toothed star cards and makes the small leaf edges soft.
function softOutline(ctx, points, rounding = 0.1) {
  const toward = (a, b, amount) => [a[0] + (b[0] - a[0]) * amount, a[1] + (b[1] - a[1]) * amount];
  const first = toward(points[0], points.at(-1), rounding);
  ctx.moveTo(...first);
  for (let i = 0; i < points.length; i++) {
    const p = points[i], prev = points[(i + points.length - 1) % points.length], next = points[(i + 1) % points.length];
    ctx.lineTo(...toward(p, prev, rounding));
    ctx.quadraticCurveTo(...p, ...toward(p, next, rounding));
  }
  ctx.closePath();
}

// Acer palmatum-inspired seven deep lobes. The actual tips and deep sinuses
// are in the alpha silhouette, independent of the summer green palette.
function sevenLobe(ctx, size) {
  const radii = [0.62, 0.85, 1, 1.08, 1, 0.85, 0.62];
  const polar = (angle, radius) => [Math.cos(angle) * radius * size, Math.sin(angle) * radius * size];
  ctx.moveTo(-size * 0.12, size * 0.45);
  for (let lobe = 0; lobe < 7; lobe++) {
    const angle = (-165 + lobe * 25) * Math.PI / 180;
    const radius = radii[lobe];
    const shoulder = 9 * Math.PI / 180;
    const capLeft = polar(angle, radius * 0.84);
    const capRight = [...capLeft];
    const across = [-Math.sin(angle) * radius * size * 0.125, Math.cos(angle) * radius * size * 0.125];
    for (let axis = 0; axis < 2; axis++) { capLeft[axis] -= across[axis]; capRight[axis] += across[axis]; }
    // A curved shoulder and one rounded cap per finger, never a polygon tip.
    ctx.quadraticCurveTo(...polar(angle - shoulder, radius * 0.64), ...capLeft);
    ctx.quadraticCurveTo(...polar(angle, radius * 1.1), ...capRight);
    if (lobe < 6) {
      const sinus = angle + 12.5 * Math.PI / 180;
      ctx.quadraticCurveTo(...polar(angle + shoulder, radius * 0.64), ...polar(sinus, 0.39));
    } else ctx.quadraticCurveTo(...polar(angle + shoulder, radius * 0.64), size * 0.12, size * 0.45);
  }
  ctx.closePath();
}

// Acer rubrum-inspired broader three/five-lobed leaves. Shallow basal lobes
// and broad shoulders distinguish these masks from the fine green Acer.
function broadLobe(ctx, size, five) {
  const points = [
    [-0.12, 0.55], [-0.42, 0.4],
    ...(five ? [[-0.79, 0.37], [-0.57, 0.04]] : []),
    [-0.98, -0.27], [-0.58, -0.32], [-0.31, -0.45],
    [0, -1.03], [0.31, -0.45], [0.58, -0.32], [0.98, -0.27],
    ...(five ? [[0.57, 0.04], [0.79, 0.37]] : []),
    [0.42, 0.4], [0.12, 0.55],
  ];
  softOutline(ctx, points.map(p => p.map(value => value * size)), 0.16);
}

function palmateCluster(ctx, random, broad) {
  ctx.fillStyle = ctx.strokeStyle = '#fff';
  const count = broad ? 28 : 31;
  for (let leaf = 0; leaf < count; leaf++) {
    const bearing = random() * Math.PI * 2;
    const distance = Math.sqrt(random()) * 85;
    const size = (broad ? 17 : 18) + random() * 9;
    ctx.save();
    ctx.translate(Math.cos(bearing) * distance, Math.sin(bearing) * distance);
    ctx.rotate(random() * Math.PI * 2);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, size * 0.83);
    ctx.lineTo(0, size * 0.25);
    ctx.stroke();
    ctx.beginPath();
    if (broad) broadLobe(ctx, size, leaf % 3 === 0);
    else sevenLobe(ctx, size);
    ctx.fill();
    ctx.restore();
  }
}

export const acerSevenLobeCluster = (ctx, random) => palmateCluster(ctx, random, false);
export const mapleBroadLobeCluster = (ctx, random) => palmateCluster(ctx, random, true);
