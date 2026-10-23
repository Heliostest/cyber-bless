export type PathPoint = readonly [number, number]

/** Ordered geometric coverage of the segments between input events. Corrections
 * keep the gates already covered; event frequency is never a success condition. */
export function createPathSweep(points: readonly PathPoint[], radius: number) {
  let previous: PathPoint | null = points[0]!, next = 1
  const finite = (p: PathPoint) => p.every(Number.isFinite)
  const distance = (a: PathPoint, b: PathPoint) => Math.hypot(a[0] - b[0], a[1] - b[1])
  return {
    get next() { return next },
    get progress() { return (next - 1) / Math.max(1, points.length - 1) },
    reset(start: PathPoint = points[0]!) { previous = finite(start) ? start : null; next = 1 },
    sample(point: PathPoint) {
      if (!finite(point)) { previous = null; next = 1; return }
      if (previous) {
        const dx = point[0] - previous[0], dy = point[1] - previous[1], lengthSq = dx * dx + dy * dy
        let cursor = 0
        while (next < points.length) {
          const gate = points[next]!
          const t = lengthSq ? Math.max(cursor, Math.min(1, ((gate[0] - previous[0]) * dx + (gate[1] - previous[1]) * dy) / lengthSq)) : 0
          if (distance([previous[0] + dx * t, previous[1] + dy * t], gate) > radius + 1e-8) break
          cursor = t; next++
        }
      }
      previous = point
    },
    complete(point: PathPoint | null = previous, tolerance = radius * 1.5) { return next === points.length && point !== null && finite(point) && distance(point, points[points.length - 1]!) <= tolerance + 1e-8 },
  }
}
