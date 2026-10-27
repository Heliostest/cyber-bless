import { getLocale, subscribeLocale, translate, translateScene, type MessageValues } from '@wbr/i18n'
import { addInteractionCue as addRuntimeInteractionCue, type InteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { Object3D } from 'three'

const trustedParameter = Symbol('trusted scene parameter')
type ProductParameter = { [trustedParameter]: true; copy: Copy }
type SceneValues = Record<string, MessageValues[string] | ProductParameter>
type Copy = { source: string; values?: SceneValues } | { parts: Copy[] }
type Binding = { copy: Copy; render(value: string): void }
const bindings = new WeakMap<HTMLElement, Map<string, Binding>>()
// Descriptors only originate in trusted scene code. Inputs and user content are never registered.
const compositions = new Map<string, Copy>()
function remember(source: string, copy: Copy): string {
  compositions.delete(source); compositions.set(source, copy)
  if (compositions.size > 512) compositions.delete(compositions.keys().next().value!)
  return source
}
const descriptor = (source: string): Copy => compositions.get(source) ?? { source }
const isProductParameter = (value: SceneValues[string]): value is ProductParameter =>
  !!value && typeof value === 'object' && trustedParameter in value
const rawCopy = (copy: Copy): string => 'parts' in copy ? copy.parts.map(rawCopy).join('')
  : copy.values ? rawValues(copy.source, copy.values) : copy.source
const rawValues = (source: string, values: SceneValues): string => source.replace(/\{(\w+)\}/g, (match, key) =>
  key in values ? isProductParameter(values[key]) ? rawCopy(values[key].copy) : String(values[key] ?? '') : match)

/** Keep template provenance while scene logic, copy assertions and legacy saves retain source text. */
export function sceneTemplate(source: string, values: SceneValues): string {
  return remember(rawValues(source, values), { source, values: { ...values } })
}
/** Mark a known product clause explicitly. Ordinary string parameters always remain verbatim. */
export function sceneProductCopy(source: string): ProductParameter {
  return { [trustedParameter]: true, copy: descriptor(source) }
}
/** Compose complete trusted clauses, preserving each clause's translation descriptor. */
export function sceneJoin(...parts: string[]): string {
  return remember(parts.join(''), { parts: parts.map(descriptor) })
}
function renderCopy(copy: Copy): string {
  if ('parts' in copy) return copy.parts.map(renderCopy).join('')
  const values = copy.values && Object.fromEntries(Object.entries(copy.values).map(([key, value]) =>
    [key, isProductParameter(value) ? renderCopy(value.copy) : value]))
  return translateScene(copy.source, values)
}
export const sceneCopy = (source: string): string => renderCopy(descriptor(source))

function register(el: HTMLElement, key: string, copy: Copy, render: Binding['render']) {
  let entries = bindings.get(el)
  if (!entries) { entries = new Map(); bindings.set(el, entries) }
  entries.set(key, { copy, render }); render(renderCopy(copy))
}
function explicitAction(el: HTMLElement) {
  return Array.from(el.classList).some(name => name.includes('finish'))
}
function renderText(el: HTMLElement, value: string) {
  if (el.classList.contains('scene-bow-tap') && !explicitAction(el)) {
    let helper = el.querySelector<HTMLElement>(':scope > .scene-helper-label')
    let action = el.querySelector<HTMLElement>(':scope > .scene-helper-action')
    if (!helper || !action) {
      helper = document.createElement('span'); helper.className = 'scene-helper-label'; helper.setAttribute('aria-hidden', 'true')
      action = document.createElement('span'); action.className = 'scene-helper-action'; action.setAttribute('aria-hidden', 'true')
      el.replaceChildren(helper, action)
    }
    helper.textContent = translate('辅助'); action.textContent = value; el.setAttribute('aria-label', value)
  } else {
    el.textContent = value
    if (el.classList.contains('scene-bow-tap')) el.setAttribute('aria-label', value)
  }
}
/** Register a trusted product text sink. Never call this for user-authored text. */
export function bindSceneText(el: HTMLElement, source: string) {
  register(el, 'text', descriptor(source), value => renderText(el, value))
}
export function bindSceneAttribute(el: HTMLElement, name: 'aria-label' | 'placeholder' | 'title', source: string) {
  register(el, name, descriptor(source), value => el.setAttribute(name, value))
}
export function sceneTextSource(el: HTMLElement): string | undefined {
  const copy = bindings.get(el)?.get('text')?.copy
  return copy && 'source' in copy ? copy.values ? rawValues(copy.source, copy.values) : copy.source : undefined
}
/** Drop feedback can restore its exact descriptor, rather than storing a translated display string. */
export function captureSceneText(el: HTMLElement): () => void {
  const binding = bindings.get(el)?.get('text')
  const fallback = el.textContent ?? ''
  return () => binding ? register(el, 'text', binding.copy, binding.render) : bindSceneText(el, fallback)
}

/** Repaint registered sinks only. Node identity, listeners, focus, drafts and engine state stay intact. */
export function localizeSceneOverlay(root: HTMLElement): () => void {
  const refresh = () => {
    root.lang = getLocale()
    for (const el of [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))]) {
      for (const binding of bindings.get(el)?.values() ?? []) binding.render(renderCopy(binding.copy))
    }
  }
  refresh()
  return subscribeLocale(refresh)
}

/** Cue labels are read every frame; getters preserve live locale and scene-owned mutable specs. */
export function addInteractionCue(object: Object3D, cue: InteractionCue) {
  let label = cue.label, labelCopy = descriptor(label)
  let targetLabel = cue.targetLabel, targetCopy = targetLabel ? descriptor(targetLabel) : undefined
  return addRuntimeInteractionCue(object, {
    ...cue,
    get label() {
      if (cue.label !== label) { label = cue.label; labelCopy = descriptor(label) }
      return renderCopy(labelCopy)
    },
    get targetLabel() {
      if (cue.targetLabel !== targetLabel) { targetLabel = cue.targetLabel; targetCopy = targetLabel ? descriptor(targetLabel) : undefined }
      return targetCopy ? renderCopy(targetCopy) : undefined
    },
  })
}
export type { InteractionCue }
