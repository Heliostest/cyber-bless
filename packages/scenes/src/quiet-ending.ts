import * as THREE from 'three'
import type { SceneContext } from './contract'
import type { StepOverlay } from './procedural-kit'
import { bindSceneAttribute, bindSceneText } from './scene-localization'

const COPY = {
  status: '正在收尾，片刻后自动完成。',
  writing: '写好后点「写好了」继续。',
  progress: '收尾进度',
}
type Context = Pick<SceneContext, 'overlay' | 'isActive' | 'isReducedMotion'>
type EmissiveMaterial = THREE.Material & { emissive: THREE.Color; emissiveIntensity: number }
type Options = {
  ui: Pick<StepOverlay, 'hitLayer' | 'actionBtn' | 'hintEl'>
  isActive?(): boolean
  duration?: number
  motion: 'glow' | 'sway' | 'bob'
  targets(): THREE.Object3D[]
  cancelInput?(): void
  complete(): void
  onFrame?(progress: number, elapsed: number, reduced: boolean): void
}

/** Product animation time, never a traditional observance or wall-clock deadline. */
export function createQuietEnding(ctx: Context, options: Options) {
  const { overlay } = ctx, { ui } = options
  const status = document.createElement('div'), progress = document.createElement('progress')
  status.className = 'scene-ending-status'; status.setAttribute('aria-hidden', 'true'); status.hidden = true
  progress.max = 1; progress.value = 0; bindSceneAttribute(progress, 'aria-label', COPY.progress)
  status.append(progress); overlay.append(status)
  let phase: 'idle' | 'running' | 'finished' = 'idle', elapsed = 0, disposed = false, initialized = false, completing = false, focused = true
  const composing = new Set<EventTarget>()
  const poses: { object: THREE.Object3D; y: number; quaternion: THREE.Quaternion }[] = []
  const materials = new Map<EmissiveMaterial, { color: THREE.Color; intensity: number }>()
  const warm = new THREE.Color(0xffdca6), turn = new THREE.Quaternion(), axis = new THREE.Vector3(0, 0, 1)
  const active = () => !disposed && focused && document.visibilityState !== 'hidden' && (ctx.isActive?.() ?? true) && (options.isActive?.() ?? true)
  function restore() {
    for (const pose of poses) {
      if (options.motion === 'sway') pose.object.quaternion.copy(pose.quaternion)
      if (options.motion === 'bob') pose.object.position.y = pose.y
    }
    for (const [material, value] of materials) { material.emissive.copy(value.color); material.emissiveIntensity = value.intensity }
  }
  function initialize() {
    initialized = true
    options.cancelInput?.()
    if (disposed || phase !== 'running') return
    for (const object of options.targets()) {
      poses.push({ object, y: object.position.y, quaternion: object.quaternion.clone() })
      object.traverse(child => {
        const value = (child as THREE.Mesh).material
        for (const material of Array.isArray(value) ? value : value ? [value] : []) {
          if ('emissive' in material && (material as EmissiveMaterial).emissive?.isColor && !materials.has(material as EmissiveMaterial)) {
            const emissive = material as EmissiveMaterial
            materials.set(emissive, { color: emissive.emissive.clone(), intensity: emissive.emissiveIntensity })
          }
        }
      })
    }
  }
  function editing() {
    return composing.size > 0 || Array.from(overlay.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]),textarea'))
      .some(input => !input.disabled && !input.readOnly && !input.closest('[hidden],[inert]') &&
        (document.activeElement === input || !!input.value.trim()))
  }
  function showUI(writing = editing()) {
    if (disposed || phase !== 'running') return
    overlay.dataset.quietEnding = 'true'; status.hidden = false
    ui.actionBtn.hidden = true; ui.actionBtn.disabled = true; ui.actionBtn.setAttribute('aria-disabled', 'true')
    ui.hitLayer.style.pointerEvents = 'none'
    bindSceneText(ui.hintEl, writing ? COPY.writing : COPY.status)
  }
  function isEditor(target: EventTarget | null) {
    return target instanceof Element && !!target.closest('form,input,textarea')
  }
  function block(event: Event) {
    if (phase !== 'running' || disposed || completing || isEditor(event.target)) return
    if (event.target instanceof Node && (ui.hitLayer.contains(event.target) || ui.actionBtn.contains(event.target))) {
      event.preventDefault(); event.stopImmediatePropagation()
    }
  }
  const startComposition = (event: Event) => { if (isEditor(event.target) && event.target) composing.add(event.target) }
  const endComposition = (event: Event) => { if (event.target) composing.delete(event.target) }
  const blur = () => { focused = false }
  const focus = () => { focused = true }
  const events = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'click', 'keydown']
  for (const event of events) overlay.addEventListener(event, block, true)
  overlay.addEventListener('compositionstart', startComposition, true); overlay.addEventListener('compositionend', endComposition, true)
  window.addEventListener('blur', blur); window.addEventListener('focus', focus)
  return {
    get running() { return phase === 'running' },
    get completing() { return completing },
    sync(quiet: boolean) {
      if (disposed) return
      if (!quiet) {
        restore(); phase = 'idle'; elapsed = 0; initialized = false; poses.length = 0; materials.clear()
        status.hidden = true; delete overlay.dataset.quietEnding
        return
      }
      if (phase === 'idle') { phase = 'running'; elapsed = 0; initialized = false; progress.value = 0 }
      showUI()
    },
    update(dt: number) {
      if (disposed || phase !== 'running') return
      const writing = editing(); showUI(writing)
      if (!active() || writing) return
      if (!initialized) initialize()
      if (!active() || phase !== 'running') return
      const reduced = ctx.isReducedMotion?.() ?? false
      const duration = reduced ? .6 : options.duration ?? 3
      elapsed = Math.min(duration, elapsed + (Number.isFinite(dt) ? Math.max(0, Math.min(dt, .05)) : 0))
      const p = Math.min(1, elapsed / duration), envelope = Math.sin(Math.PI * p), shimmer = envelope * envelope
      progress.value = p
      for (const pose of poses) {
        if (options.motion === 'sway') pose.object.quaternion.copy(pose.quaternion).multiply(turn.setFromAxisAngle(axis, reduced ? 0 : Math.sin(p * Math.PI * 4) * envelope * .055))
        if (options.motion === 'bob') pose.object.position.y = pose.y + (reduced ? 0 : Math.sin(p * Math.PI * 2) * envelope * .07)
      }
      for (const [material, base] of materials) {
        material.emissive.copy(base.color).lerp(warm, shimmer * (reduced ? .045 : .12))
        material.emissiveIntensity = base.intensity + shimmer * .12
      }
      options.onFrame?.(p, elapsed, reduced)
      if (!active() || phase !== 'running' || p < 1) return
      // Set the terminal phase before callbacks which may reenter, pause or dispose.
      phase = 'finished'; completing = true; restore(); status.hidden = true; delete overlay.dataset.quietEnding
      try { options.complete() } finally { completing = false }
    },
    dispose() {
      if (disposed) return
      disposed = true; restore(); phase = 'finished'; poses.length = 0; materials.clear(); composing.clear()
      for (const event of events) overlay.removeEventListener(event, block, true)
      overlay.removeEventListener('compositionstart', startComposition, true); overlay.removeEventListener('compositionend', endComposition, true)
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus)
      status.remove(); delete overlay.dataset.quietEnding
    },
  }
}
