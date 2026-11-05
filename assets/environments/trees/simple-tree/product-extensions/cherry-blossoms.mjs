// Product-authored flowering-cherry art extension for the pinned MIT tree
// engine. This is not an upstream species, botanical cultivar model or
// external asset conversion. Geometry/scatter/AO still come from the engine.

// One five-petal flower, with a shallow notch cut into every petal tip.
// Canvas paths are white because upstream glb.js turns the red channel into
// the alpha mask; the source's three-band uniforms supply the pink/white.
export function cherryBlossom(ctx, radius) {
  for (let petal = 0; petal < 5; petal++) {
    ctx.save();
    ctx.rotate(petal * Math.PI * 2 / 5);
    ctx.moveTo(0, -radius * 0.03);
    ctx.bezierCurveTo(-radius * 0.48, -radius * 0.25, -radius * 0.48, -radius * 0.91, -radius * 0.19, -radius);
    ctx.quadraticCurveTo(-radius * 0.08, -radius * 1.03, 0, -radius * 0.79);
    ctx.quadraticCurveTo(radius * 0.08, -radius * 1.03, radius * 0.19, -radius);
    ctx.bezierCurveTo(radius * 0.48, -radius * 0.91, radius * 0.48, -radius * 0.25, 0, -radius * 0.03);
    ctx.closePath();
    ctx.restore();
  }
  ctx.moveTo(radius * 0.18, 0);
  ctx.arc(0, 0, radius * 0.18, 0, Math.PI * 2);
}

// Used as one cell by the original source paintAtlas(seed=42). It produces
// four deterministic 256px blossom sprays in the same 512px atlas format.
// Small notched flowers and a few buds form irregular, softly overlapping
// sprays rather than pointed leaves or an opaque polygon canopy.
export function cherryBlossomCluster(ctx, random) {
  ctx.fillStyle = '#fff';
  for (let flower = 0; flower < 46; flower++) {
    const distance = Math.sqrt(random()) * 98;
    const bearing = random() * Math.PI * 2;
    ctx.save();
    ctx.translate(Math.cos(bearing) * distance, Math.sin(bearing) * distance);
    ctx.rotate(random() * Math.PI * 2);
    ctx.beginPath();
    cherryBlossom(ctx, 11 + random() * 8);
    ctx.fill();
    ctx.restore();
  }
}
