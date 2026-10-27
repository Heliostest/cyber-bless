// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { configureLocale } from '@wbr/i18n'
import { Object3D } from 'three'
import { addInteractionCue, bindSceneAttribute, bindSceneText, localizeSceneOverlay, sceneTemplate, sceneJoin, sceneProductCopy, type InteractionCue } from './scene-localization'

afterEach(() => { configureLocale('zh-Hans'); document.body.replaceChildren() })

describe('explicit scene copy bindings', () => {
  it('updates existing trusted text and attributes without changing inputs, identity or callbacks', () => {
    configureLocale('zh-Hans')
    const root = document.createElement('div'), button = document.createElement('button'), input = document.createElement('input')
    const userNote = document.createElement('p')
    input.value = '写好了'; userNote.textContent = '写好了'
    const action = vi.fn(); button.addEventListener('click', action)
    root.append(button, input, userNote); document.body.append(root)
    bindSceneText(button, '写好了'); bindSceneAttribute(input, 'placeholder', '写一句想说的话…')
    const stop = localizeSceneOverlay(root)
    input.focus(); input.setSelectionRange(1, 2)
    configureLocale('en')
    expect(button.textContent).not.toBe('写好了')
    expect(input.placeholder).not.toBe('写一句想说的话…')
    expect(input.value).toBe('写好了'); expect(userNote.textContent).toBe('写好了')
    expect(document.activeElement).toBe(input); expect(input.selectionStart).toBe(1)
    button.click(); expect(action).toHaveBeenCalledTimes(1)
    stop(); const last = button.textContent; configureLocale('zh-Hans'); expect(button.textContent).toBe(last)
  })

  it('keeps the latest dynamic trusted hint when the language changes', () => {
    configureLocale('zh-Hans')
    const root = document.createElement('div'), hint = document.createElement('p'); root.append(hint)
    const stop = localizeSceneOverlay(root)
    bindSceneText(hint, sceneTemplate('刷印 {p0}%，抬手后也可以接着擦。', { p0: 42 }))
    configureLocale('en')
    expect(hint.textContent).toContain('42'); expect(hint.textContent).not.toContain('刷印')
    configureLocale('zh-Hans'); expect(hint.textContent).toBe('刷印 42%，抬手后也可以接着擦。')
    bindSceneText(hint, sceneJoin('已完成', ' ', '结束仪式'))
    stop()
  })

  it('renders a visible translated helper label and retains a full accessible action', () => {
    configureLocale('zh-Hans')
    const button = document.createElement('button'); button.className = 'scene-bow-tap'
    bindSceneText(button, '折一下')
    expect(button.querySelector('.scene-helper-label')?.textContent).toBe('辅助')
    expect(button.querySelector('.scene-helper-action')?.textContent).toBe('折一下')
    expect(button.getAttribute('aria-label')).toBe('折一下')
    button.classList.add('scene-continuous-finish'); bindSceneText(button, '结束仪式')
    expect(button.querySelector('.scene-helper-label')).toBeNull()
    expect(button.textContent).toBe('结束仪式')
  })

  it('reads mutable scene cue specs in the current locale without replacing the cue', () => {
    configureLocale('zh-Hans')
    const object = new Object3D(), spec: InteractionCue = { kind: 'tap', label: '写好了', enabled: () => true }
    const remove = addInteractionCue(object, spec)
    const cue = object.userData.interactionCues[0] as InteractionCue
    expect(cue.label).toBe('写好了')
    configureLocale('en'); expect(cue.label).toBe('Done writing')
    spec.label = '写一句想说的话'; expect(cue.label).toBe('Write a few words')
    expect(object.userData.interactionCues[0]).toBe(cue)
    remove(); expect(object.userData.interactionCues).toHaveLength(0)
  })

  it('never translates a raw template parameter that happens to equal trusted product copy', () => {
    configureLocale('en')
    const note = document.createElement('p')
    bindSceneText(note, sceneTemplate('选择{p0}小符', { p0: '写好了' }))
    expect(note.textContent).toContain('写好了')
    expect(note.textContent).not.toContain('Done writing')
    bindSceneText(note, sceneTemplate('选择{p0}小符', { p0: sceneProductCopy('写好了') }))
    expect(note.textContent).toContain('Done writing')
  })

  it('retains a cue template after unrelated compositions leave the bounded registry', () => {
    configureLocale('zh-Hans')
    const object = new Object3D()
    const remove = addInteractionCue(object, { kind: 'tap', label: sceneTemplate('移到前行 {p0} 格的落点', { p0: 42 }), enabled: () => true })
    for (let i = 0; i < 600; i++) sceneTemplate('刷印 {p0}%，抬手后也可以接着擦。', { p0: i })
    configureLocale('en')
    const cue = object.userData.interactionCues[0] as InteractionCue
    expect(cue.label).toContain('42')
    expect(cue.label).not.toContain('移到')
    remove()
  })

  it('uses the scene meaning when Chinese source copy is also used by app navigation', () => {
    configureLocale('en')
    const button = document.createElement('button')
    bindSceneText(button, '留在这里')
    expect(button.textContent).toBe('Leave it here')
    const root = document.createElement('div'); root.append(button)
    const stop = localizeSceneOverlay(root)
    configureLocale('es')
    expect(button.textContent).toBe('Dejarlo aquí')
    stop()
  })
})
