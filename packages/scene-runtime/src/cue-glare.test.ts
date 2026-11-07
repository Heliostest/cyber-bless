// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createCueGlare } from './cue-glare'

const handles: ReturnType<typeof createCueGlare>[]=[]
beforeEach(()=>vi.useFakeTimers({toFake:['setTimeout','clearTimeout','performance']}))
afterEach(()=>{handles.splice(0).forEach(h=>h.dispose());vi.useRealTimers()})
function mount() {
  const uniform={value:-1},rendered: number[]=[]
  const glare=createCueGlare(uniform,()=>rendered.push(uniform.value));handles.push(glare)
  return {uniform,rendered,glare}
}
it('waits quietly, wakes an on-demand owner for one sweep, then rests before repeating',()=>{
  const {uniform,rendered,glare}=mount();glare.update(true)
  vi.advanceTimersByTime(3000);expect(uniform.value).toBe(-1);expect(rendered).toEqual([])
  vi.advanceTimersByTime(500);expect(glare.animating).toBe(true);expect(rendered).toEqual([0])
  glare.update(true);expect(uniform.value).toBeGreaterThan(0);expect(uniform.value).toBeLessThan(1)
  vi.advanceTimersByTime(1200);glare.update(true)
  expect(uniform.value).toBe(-1);expect(glare.animating).toBe(false)
  vi.advanceTimersByTime(4000);expect(rendered).toEqual([0])
  vi.advanceTimersByTime(5000);expect(rendered).toEqual([0,0]);expect(glare.animating).toBe(true)
})
it('cancels waiting and in-flight sweeps, and resumes with a fresh reading delay',()=>{
  const {uniform,rendered,glare}=mount();glare.update(true)
  vi.advanceTimersByTime(1000);glare.update(false);vi.advanceTimersByTime(20000)
  expect(rendered).toEqual([]);expect(uniform.value).toBe(-1)
  glare.update(true);vi.advanceTimersByTime(3500);glare.update(true)
  expect(uniform.value).toBeGreaterThan(0)
  glare.update(false);expect(uniform.value).toBe(-1);expect(glare.animating).toBe(false)
  vi.advanceTimersByTime(20000);expect(rendered).toEqual([0])
  glare.update(true);vi.advanceTimersByTime(1000);expect(rendered).toEqual([0])
})
it('never wakes after disposal and releases its pending timeout idempotently',()=>{
  const {uniform,rendered,glare}=mount();glare.update(true);glare.dispose();glare.dispose()
  vi.advanceTimersByTime(20000);glare.update(true)
  expect(uniform.value).toBe(-1);expect(rendered).toEqual([]);expect(vi.getTimerCount()).toBe(0)
})
