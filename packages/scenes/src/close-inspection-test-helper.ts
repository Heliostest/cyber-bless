import { expect } from 'vitest'
import type { SceneInstance } from './contract'

/** Reach the real placement controls through the same viewing buttons as users. */
export function enterPlacementAfterCloseInspection(instance: SceneInstance, overlay: HTMLElement) {
  const phase = overlay.getAttribute('data-close-inspection')
  if (phase === null || phase === 'done') return
  expect(phase).toBe('ready')
  const button = overlay.querySelector<HTMLButtonElement>('button')!
  expect(button).toBeTruthy()
  button.click()
  for (let frame = 0; frame < 28; frame++) instance.update(.025)
  expect(overlay.getAttribute('data-close-inspection')).toBe('viewing')
  button.click()
  for (let frame = 0; frame < 24; frame++) instance.update(.025)
  expect(overlay.getAttribute('data-close-inspection')).toBe('placement')
  expect(button.disabled).toBe(false)
}
