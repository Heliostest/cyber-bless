import { describe, expect, it } from 'vitest'
import { builtInScenes, isSceneVisibleInApp, WISH_SCENE_IDS } from '@wbr/core/daily-scenes'
import { wishObjectFeedback } from './wish-object-feedback'

describe('collected object touch feedback', () => {
  it.each([
    ['furin-wind-chime', 'chime'], ['crane', 'paper'], ['daruma-eye-painting', 'hollow'],
    ['tanzaku-tanabata', 'paper'], ['uchide-wishing-mallet', 'woodTap'],
    ['alasita-miniature-house', 'hollow'], ['turkish-nazar-bead', 'glass'],
    ['venetian-glass-bead', 'glass'], ['bai-indigo-cloth', 'fabric'],
    ['italian-ex-voto', 'ceramic'], ['barcelos-clay-rooster', 'ceramic'],
    ['sumiyoshi-godairiki', 'stone'], ['milagros', 'metal'], ['woodfish', 'woodfish'],
    ['zeniarai-coin-washing', 'water'], ['slavic-wreath', 'air'],
    ['ema-votive-plaque', 'woodTap'], ['omamori-cycle', 'fabric'],
    ['lantern', 'paper'], ['votive-candle-catholic', 'air'],
  ])('touching %s selects its displayed surface cue %s', (id, sound) => {
    expect(wishObjectFeedback(id).sound).toBe(sound)
  })

  it.each([
    ['hindu-coconut-offering', 'hollow', 'rotate(-4deg)'],
    ['mezuzah-doorpost', 'metal', 'translateY(1px)'],
    ['sri-lankan-bodhi-puja', 'ceramic', 'translateY(1px)'],
    ['ukrainian-didukh', 'air', 'rotate(-3deg) translateY(-1px)'],
  ])('gives the displayed %s object its authored %s sound and settling motion', (id, sound, reaction) => {
    const profile = wishObjectFeedback(id)
    expect(profile.sound).toBe(sound)
    expect(profile.motion[1].transform).toBe(reaction)
    expect(profile.motion[0].transform).toBe(profile.motion.at(-1)!.transform)
    expect(profile).not.toEqual(wishObjectFeedback('future-object'))
  })

  it('gives every current shelf object and compatible saved wish object a deliberate response', () => {
    const fallback = wishObjectFeedback('future-object')
    const ids = new Set([...builtInScenes.filter(isSceneVisibleInApp).map(entry => entry.id), ...WISH_SCENE_IDS])
    for (const id of ids) {
      const profile = wishObjectFeedback(id)
      expect(profile, id).not.toEqual(fallback)
      expect(profile.motion.length, id).toBeGreaterThanOrEqual(3)
      expect(profile.motion[0].transform, id).toBe(profile.motion.at(-1)!.transform)
      expect(profile.motion[0].filter, id).toBe(profile.motion.at(-1)!.filter)
      expect(profile.timing.duration, id).toBeGreaterThanOrEqual(250)
      expect(profile.timing.duration, id).toBeLessThanOrEqual(1200)
      expect(profile.timing.iterations ?? 1, id).toBe(1)
    }
  })

  it('swings a chime from its top and settles a daruma from its base', () => {
    const chime = wishObjectFeedback('furin-wind-chime'), daruma = wishObjectFeedback('daruma-eye-painting')
    expect(chime.motion.every(frame => frame.transformOrigin === '50% 0%')).toBe(true)
    expect(daruma.motion.every(frame => frame.transformOrigin === '50% 100%')).toBe(true)
    expect(chime.motion.some(frame => String(frame.transform).includes('rotate(-'))).toBe(true)
    expect(chime.motion.some(frame => /rotate\([1-9]/.test(String(frame.transform)))).toBe(true)
    expect(daruma.motion).not.toEqual(chime.motion)
  })

  it('lifts the paper crane and lantern gently without applying a shared rocking rotation', () => {
    for (const id of ['crane', 'lantern']) {
      const profile = wishObjectFeedback(id)
      expect(profile.motion.some(frame => /translateY\(-[1-3]px\)/.test(String(frame.transform)))).toBe(true)
      expect(profile.motion.every(frame => !String(frame.transform).includes('rotate'))).toBe(true)
    }
    expect(wishObjectFeedback('crane').motion).not.toEqual(wishObjectFeedback('lantern').motion)
  })

  it('keeps a heavy miniature house grounded and lets a candle brighten in place', () => {
    const house = wishObjectFeedback('alasita-miniature-house'), candle = wishObjectFeedback('votive-candle-catholic')
    expect(house.motion.some(frame => frame.transform === 'translateY(-1px)')).toBe(true)
    expect(house.motion.every(frame => !String(frame.transform).includes('rotate'))).toBe(true)
    expect(candle.motion.every(frame => frame.transform === 'none')).toBe(true)
    expect(candle.motion.some(frame => frame.filter !== 'brightness(1)')).toBe(true)
  })

  it.each(['future-object', '', '__proto__', 'constructor'])('uses a quiet neutral response for unknown id %s', id => {
    const profile = wishObjectFeedback(id)
    expect(profile.sound).toBe('air')
    expect(profile.motion.every(frame => !String(frame.transform).includes('rotate'))).toBe(true)
    expect(profile.timing.duration).toBeLessThan(700)
  })

  it('returns independent frames and timing so a preview cannot alter another object response', () => {
    const first = wishObjectFeedback('crane')
    first.motion[1].transform = 'none'
    first.timing.duration = 1
    const second = wishObjectFeedback('crane')
    expect(second.motion[1].transform).not.toBe('none')
    expect(second.timing.duration).toBeGreaterThanOrEqual(250)
  })
})
