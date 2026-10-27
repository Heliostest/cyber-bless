import { bindSceneText } from './scene-localization'

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

/** The same screen-space direction drives the visible arrow and the input axes. */
export function directionalAxes(direction: [number, number], dx: number, dy: number): [number, number] {
  const length = Math.hypot(...direction)
  return [(dx * direction[0] + dy * direction[1]) / length, (-dx * direction[1] + dy * direction[0]) / length]
}

/** Product feedback only: readiness follows the actual release rule. */
export function updateDirectionalDragHint(hint: HTMLElement, ready: boolean, fallback: string, assertSafeCopy: (text: string) => void) {
  const text = ready ? '动作已到位，可以松手。' : fallback
  assertSafeCopy(text)
  if (ready) hint.dataset.ready = 'true'
  else delete hint.dataset.ready
  bindSceneText(hint, text)
}

/** A completed pose must remain completable when the player keeps dragging.
 * Direction and deliberate reversal still matter; absolute overtravel does not.
 */
export function completesDirectionalDrag(drag: DirectionalDrag, minimum = 40, fullDistance = 60) {
  if (!Object.values(drag).every(Number.isFinite)) return false
  // The model clamps at fullDistance. Once both the last pose and release are
  // still fully extended in the intended direction, an earlier correction or
  // wobbly path must not make that completed pose spring back.
  if (drag.along + 1e-6 >= fullDistance && drag.end + 1e-6 >= fullDistance && drag.minAlong >= -24
    && Math.abs(drag.cross) <= Math.max(24, drag.end * .5) + 1e-6) return true
  const extent = Math.max(drag.maxAlong, drag.end)
  const correction = Math.max(24, extent * .2) + 1e-6
  const crossLimit = Math.max(24, extent * .5) + 1e-6
  return drag.along + 1e-6 >= minimum && drag.end + 1e-6 >= minimum
    && drag.minAlong >= -24 && drag.backtrack <= correction && drag.maxAlong - drag.end <= correction
    && drag.maxCross <= crossLimit && Math.abs(drag.cross) <= crossLimit
    // Scale the path budget with the intended movement instead of imposing
    // the old 90px ceiling. A repeated sideways scribble is still rejected.
    && drag.travel <= Math.max(90, extent * 2) + 1e-6
}
