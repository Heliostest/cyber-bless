type DirectionalDrag = {
  /** Last sampled move and release, projected onto the instructed direction. */
  along: number
  end: number
  maxAlong: number
  minAlong: number
  backtrack: number
  maxCross: number
  cross: number
  travel: number
}

/** A completed pose must remain completable when the player keeps dragging.
 * Direction and deliberate reversal still matter; absolute overtravel does not.
 */
export function completesDirectionalDrag(drag: DirectionalDrag, minimum = 40, fullDistance = 60) {
  if (!Object.values(drag).every(Number.isFinite)) return false
  // The model clamps at fullDistance. Once both the last pose and release are
  // still fully extended in the intended direction, an earlier correction or
  // wobbly path must not make that completed pose spring back.
  if (drag.along + 1e-6 >= fullDistance && drag.end + 1e-6 >= fullDistance && drag.minAlong >= -8
    && Math.abs(drag.cross) <= Math.max(18, drag.end * .4) + 1e-6) return true
  const extent = Math.max(drag.maxAlong, drag.end)
  const correction = Math.max(12, extent * .2) + 1e-6
  const crossLimit = Math.max(18, extent * .3) + 1e-6
  return drag.along >= minimum && drag.end >= minimum
    && drag.minAlong >= -8 && drag.backtrack <= correction && drag.maxAlong - drag.end <= correction
    && drag.maxCross <= crossLimit && Math.abs(drag.cross) <= crossLimit
    // Scale the path budget with the intended movement instead of imposing
    // the old 90px ceiling. A repeated sideways scribble is still rejected.
    && drag.travel <= Math.max(90, extent * 2) + 1e-6
}
