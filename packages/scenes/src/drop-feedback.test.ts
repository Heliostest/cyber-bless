// @vitest-environment jsdom
import { expect, it, vi } from 'vitest'
import { createDropFeedback } from './drop-feedback'

it('previews a ready drop, restores its own hint and never overwrites a new scene hint', () => {
  const hint = document.createElement('div'), safe = vi.fn()
  hint.textContent = '把木勺放上展托。'
  const feedback = createDropFeedback(hint, safe)
  feedback.setReady(true)
  expect(hint.textContent).toContain('可以松手'); expect(hint.dataset.dropReady).toBe('true')
  feedback.clear(); expect(hint.textContent).toBe('把木勺放上展托。')
  feedback.setReady(true); hint.textContent = '木勺正轻轻落稳。'
  feedback.clear(); expect(hint.textContent).toBe('木勺正轻轻落稳。')
  feedback.dispose(); expect(hint.dataset.dropReady).toBeUndefined()
})
