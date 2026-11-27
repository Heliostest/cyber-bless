import * as THREE from 'three'
import {
  createSoftSoundPlayer,
  type ContinuousBed,
  type ContinuousBedKind,
  type SoftSound,
  type SoftSoundOptions,
} from '@wbr/shared'
import type { SceneContext } from './contract'
import { bindSceneAttribute, bindSceneText } from './scene-localization'

/** Shared helpers for the warm C-grade procedural scenes on the island stage (Design A). */

export function setSafeText(
  el: HTMLElement,
  text: string,
  assertSafeCopy: (t: string) => void,
) {
  assertSafeCopy(text)
  bindSceneText(el, text)
}

export type StepOverlay = {
  hitLayer: HTMLDivElement
  titleEl: HTMLDivElement
  dotsEl: HTMLDivElement
  hintEl: HTMLDivElement
  actionBtn: HTMLButtonElement
  renderDots(activeIdx: number, total: number): void
}

/** Builds hit layer, title, step dots, aria-live hint and one tap button. */
export function createStepOverlay(
  overlay: HTMLElement,
  copy: { title: string; stepsAria: string; action: string },
  assertSafeCopy: (t: string) => void,
): StepOverlay {
  overlay.replaceChildren()
  overlay.classList.add('scene-overlay', 'scene-overlay--stage')

  const hitLayer = document.createElement('div')
  hitLayer.className = 'scene-hit-layer'
  hitLayer.setAttribute('aria-hidden', 'true')

  const titleEl = document.createElement('div')
  titleEl.className = 'scene-title'
  setSafeText(titleEl, copy.title, assertSafeCopy)

  const dotsEl = document.createElement('div')
  dotsEl.className = 'scene-step-dots'
  dotsEl.setAttribute('role', 'list')
  bindSceneAttribute(dotsEl, 'aria-label', copy.stepsAria)

  const hintEl = document.createElement('div')
  hintEl.className = 'scene-hint'
  hintEl.setAttribute('aria-live', 'polite')

  // Scenes listen for `click`, not `pointerup`: it also fires for Enter and
  // Space, and not when a finger slides off the button before lifting.
  const actionBtn = document.createElement('button')
  actionBtn.type = 'button'
  actionBtn.className = 'scene-bow-tap'
  bindSceneAttribute(actionBtn, 'title', '辅助操作：也可以直接操作场景里的物品')
  setSafeText(actionBtn, copy.action, assertSafeCopy)

  overlay.append(hitLayer, titleEl, dotsEl, hintEl, actionBtn)

  const renderDots = (activeIdx: number, total: number) => {
    dotsEl.replaceChildren()
    for (let i = 0; i < total; i++) {
      const dot = document.createElement('span')
      dot.className = 'scene-step-dot'
      dot.setAttribute('role', 'listitem')
      if (i < activeIdx) dot.dataset.state = 'done'
      else if (i === activeIdx) dot.dataset.state = 'active'
      else dot.dataset.state = 'todo'
      dotsEl.appendChild(dot)
    }
  }

  return { hitLayer, titleEl, dotsEl, hintEl, actionBtn, renderDots }
}

/** Soft, painted village look: rounded volume and restrained contours. */
export const CEL_STYLE = 'toon-soft' as const

/**
 * Renderer + scene for the warm palette. Like the woodfish, the canvas clears
 * fully transparent so the subject sits on the host's island stage itself —
 * no painted background, fog or fake stage in the canvas.
 */
export function createWarmStage(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setClearColor(0x000000, 0)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  renderer.outputColorSpace = THREE.SRGBColorSpace
  const scene = new THREE.Scene()
  return { renderer, scene }
}

export type CelLightOpts = {
  sky: number
  ground: number
  key: number
  rim: number
  keyIntensity?: number
  keyPosition?: [number, number, number]
  ambientIntensity?: number
  hemiIntensity?: number
  rimIntensity?: number
}

/**
 * Anime cel light rig: one clear key sets the lit/shade split, a warm sky/ground
 * bounce keeps shade bands soft (toon gradients step only direct light), and a
 * pale backlight draws a rim along silhouettes.
 */
export function addCelLights(
  scene: THREE.Scene,
  {
    sky,
    ground,
    key,
    rim,
    keyIntensity = 1.4,
    keyPosition = [2.5, 4, 3],
    ambientIntensity = 0.35,
    hemiIntensity = 0.75,
    rimIntensity = 0.7,
  }: CelLightOpts,
) {
  const ambient = new THREE.AmbientLight(sky, ambientIntensity)
  const hemi = new THREE.HemisphereLight(sky, ground, hemiIntensity)
  const keyLight = new THREE.DirectionalLight(key, keyIntensity)
  keyLight.position.set(...keyPosition)
  const rimLight = new THREE.DirectionalLight(rim, rimIntensity)
  rimLight.position.set(-keyPosition[0] * 0.6, keyPosition[1] * 0.5, -3)
  scene.add(ambient, hemi, keyLight, rimLight)
  return { ambient, hemi, key: keyLight, rim: rimLight }
}

/**
 * The cel rig for the host's night stage (navy sky, moon upper right): the
 * bounce drops to under half and turns cool, the key becomes pale moonlight
 * from the moon's side, and a cool rim keeps silhouettes reading against the
 * navy. A scene's own lamps (warm emissive, a point light, a halo) are then
 * the warmest, brightest things in frame, not the props they light.
 * Art direction: 画面风格为三渲二，强调浓厚的日式二次元动画氛围，材质表现干净，轮廓明确，色彩柔和但富有…
 */
export const NIGHT_CEL_LIGHTS: CelLightOpts = {
  sky: 0x8fa6d6,
  ground: 0x1f3446,
  key: 0xc6d4ff,
  rim: 0x9cc2ff,
  keyIntensity: 0.6,
  keyPosition: [2.5, 4, 2],
  ambientIntensity: 0.16,
  hemiIntensity: 0.36,
  rimIntensity: 0.55,
}

/** The scene's own warm rig by day, the moonlit one on the night stage. */
export function addStageLights(
  scene: THREE.Scene,
  stage: SceneContext['stage'],
  day: CelLightOpts,
) {
  return addCelLights(scene, stage === 'night' ? NIGHT_CEL_LIGHTS : day)
}

/** A silky, zero-ringing Gaussian-cubic warm radial aureole, in alpha only. */
function glowTexture(size = 128) {
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / (size / 2)
      const edge = Math.max(0, 1 - d)
      const a = edge > 0 ? Math.exp(-3.6 * d * d) * Math.pow(edge, 1.6) : 0
      const i = (y * size + x) * 4
      data[i] = data[i + 1] = data[i + 2] = 255
      data[i + 3] = Math.round(Math.min(1, a) * 255)
    }
  }
  const map = new THREE.DataTexture(data, size, size)
  // Data textures sample nearest by default: blocky once the halo is scaled up.
  map.magFilter = map.minFilter = THREE.LinearFilter
  map.needsUpdate = true
  return map
}

/**
 * A soft halo for a lamp on the night stage: an additive, camera-facing sprite
 * centred in the lamp, so the lamp's own front hides its middle and the glow
 * spills round its edges. Transparent, so the toon pass leaves it as it is
 * and draws no ink line round it. Drive `material.opacity` with the lamp;
 * `dispose` also frees the texture, which disposeTree does not reach.
 */
export function createLampHalo(color: number, size: number) {
  const map = glowTexture()
  const material = new THREE.SpriteMaterial({
    map,
    color,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const sprite = new THREE.Sprite(material)
  sprite.name = 'lamp-halo'
  sprite.scale.setScalar(size)
  return {
    sprite,
    material,
    dispose() {
      material.dispose()
      map.dispose()
    },
  }
}

/** Dispose every geometry/material reachable from `root`. */
export function disposeTree(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (mesh.geometry) geometries.add(mesh.geometry)
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
    if (Array.isArray(mat)) mat.forEach((m) => materials.add(m))
    else if (mat) materials.add(mat)
  })
  geometries.forEach((g) => g.dispose())
  materials.forEach((m) => m.dispose())
}

/** Closed-form damped spring impulse response (0 for t <= 0). */
export function dampedRing(t: number, freq = 3.2, damp = 6.5): number {
  if (!Number.isFinite(t) || t <= 0) return 0
  return Math.exp(-damp * t) * Math.sin(Math.PI * 2 * freq * t)
}

/**
 * C1-smooth physical settle curve on [0, 1] with exact endpoints (0 -> 0, 1 -> 1)
 * and a gentle cushioned arrival overshoot around t ≈ 0.72.
 */
export function springSettleEase(t: number, overshoot = 0.036): number {
  const u = THREE.MathUtils.clamp(Number.isFinite(t) ? t : 0, 0, 1)
  if (u === 0 || u === 1) return u
  const amp = Math.max(0, Number.isFinite(overshoot) ? overshoot : 0.036)
  const oneMinus = 1 - u
  const settle = 1 - Math.pow(oneMinus, 5) * (1 + 5 * u)
  if (amp === 0) return settle
  // u^3 * (1 - u)^2 vanishes with zero slope at u = 0 and u = 1; combined with
  // settle it peaks around u ≈ 0.72 at ~1 + amp before settling smoothly to 1.
  const bump = (u * u * u * oneMinus * oneMinus) / 0.03456
  const blend = Math.min(1, amp / 0.015)
  const lift = (amp + (1 - 0.9921) * blend) / 0.847
  return settle + lift * bump
}

type ToneOpts = {
  /** Fundamental frequencies (Hz) layered together. */
  freqs?: number[]
  duration?: number
  gain?: number
  type?: OscillatorType
  cue?: SoftSound
  cueStrength?: number
}

/**
 * One lazily created AudioContext per scene instance; call `play` only from a
 * user gesture. Missing Web Audio is a silent no-op.
 */
export function createChimeAudio(enabled: () => boolean = () => true) {
  let ac: AudioContext | null = null
  let closed = false
  const tones = new Set<OscillatorNode>()
  const cleanupNodes = new Set<AudioNode>()

  const ensure = (): AudioContext | null => {
    if (closed) return null
    if (ac) return ac
    const Ctor =
      typeof window !== 'undefined'
        ? (window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext)
        : undefined
    if (!Ctor) return null
    try {
      ac = new Ctor()
    } catch {
      ac = null
    }
    return ac
  }

  const soft = createSoftSoundPlayer({ context: ensure, enabled: () => !closed && enabled() })
  const stop = () => {
    soft.stop()
    for (const osc of tones) {
      try { osc.onended = null; osc.stop(); osc.disconnect?.() } catch { /* already ended */ }
    }
    tones.clear()
    for (const node of cleanupNodes) {
      try { node.disconnect?.() } catch { /* already disconnected */ }
    }
    cleanupNodes.clear()
  }

  return {
    /** Create/resume the context inside a user gesture (mobile autoplay). */
    unlock() {
      if (!enabled()) { stop(); return }
      const a = ensure()
      if (a?.state === 'suspended') void a.resume().catch(() => {})
    },
    play({ freqs, duration, gain = 0.12, type = 'sine', cue, cueStrength }: ToneOpts) {
      if (!enabled()) { stop(); return }
      if (cue) {
        const a = ensure()
        if (a?.state === 'suspended') void a.resume().catch(() => {})
        soft.play(cue, { duration, strength: cueStrength })
      }
      if (!freqs || freqs.length === 0) return
      const a = ensure()
      if (!a) return
      try {
        if (a.state === 'suspended') void a.resume().catch(() => {})
        const now = a.currentTime
        const dur = typeof duration === 'number' && Number.isFinite(duration) && duration > 0 ? duration : 0.32
        const master = a.createGain()
        const hasFilter = typeof a.createBiquadFilter === 'function'
        const attack = hasFilter ? Math.min(0.008, dur * 0.25) : Math.min(0.015, dur * 0.25)
        master.gain.setValueAtTime(0.0001, now)
        master.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), now + attack)
        master.gain.exponentialRampToValueAtTime(0.0001, now + dur)
        let filter: BiquadFilterNode | undefined
        if (hasFilter) {
          const maxFreq = Math.max(...freqs.filter((f) => Number.isFinite(f) && f > 0), 440)
          const startCutoff = Math.min(3200, maxFreq * 3.2)
          const endCutoff = Math.max(80, Math.min(1100, maxFreq * 1.45))
          filter = a.createBiquadFilter()
          filter.type = 'lowpass'
          filter.frequency.setValueAtTime(startCutoff, now)
          if (typeof filter.frequency.exponentialRampToValueAtTime === 'function') {
            filter.frequency.exponentialRampToValueAtTime(endCutoff, now + dur)
          }
          filter.Q.setValueAtTime(0.75, now)
          master.connect(filter)
          filter.connect(a.destination)
          cleanupNodes.add(filter)
        } else {
          master.connect(a.destination)
        }
        cleanupNodes.add(master)
        let remaining = freqs.length
        freqs.forEach((f, i) => {
          const osc = a.createOscillator()
          // Warm acoustic shaping when a lowpass filter is present: gentle triangle
          // overtones swept through the filter sound like plucked wood-harp/kalimba
          // rather than a sterile sine beep.
          osc.type = hasFilter && type === 'sine' ? 'triangle' : type
          const warmFreq = hasFilter && i > 0 ? f * (1 + (i % 2 === 1 ? 0.0018 : -0.0014)) : f
          if (hasFilter && warmFreq > 0 && typeof osc.frequency.exponentialRampToValueAtTime === 'function') {
            osc.frequency.setValueAtTime(warmFreq * 1.003, now)
            osc.frequency.exponentialRampToValueAtTime(warmFreq, now + Math.min(0.014, dur * 0.2))
          } else {
            osc.frequency.setValueAtTime(warmFreq, now)
          }
          const g = a.createGain()
          g.gain.value = 1 / (i + 1)
          osc.connect(g).connect(master)
          tones.add(osc)
          cleanupNodes.add(g)
          osc.onended = () => {
            tones.delete(osc)
            cleanupNodes.delete(g)
            try { osc.disconnect?.(); g.disconnect?.() } catch { /* already disconnected */ }
            if (--remaining <= 0) {
              cleanupNodes.delete(master)
              try { master.disconnect?.() } catch { /* already disconnected */ }
              if (filter) {
                cleanupNodes.delete(filter)
                try { filter.disconnect?.() } catch { /* already disconnected */ }
              }
            }
          }
          osc.start(now)
          osc.stop(now + dur + 0.05)
        })
      } catch {
        // audio is decorative; ignore failures
      }
    },
    /** Product-styled material cue; shares the gesture-unlocked context. */
    sound(cue: SoftSound, options?: SoftSoundOptions) {
      if (!enabled()) { stop(); return }
      const a = ensure()
      if (a?.state === 'suspended') void a.resume().catch(() => {})
      soft.play(cue, options)
    },
    /** Continuous velocity-modulated friction/flow sound bed tied to this audio lifecycle. */
    bed(kind: ContinuousBedKind): ContinuousBed {
      const inner = soft.bed(kind)
      return {
        setSpeed(speed01: number) {
          if (!enabled()) { inner.stop(); return }
          if (speed01 > 0.02) {
            const a = ensure()
            if (a?.state === 'suspended') void a.resume().catch(() => {})
          }
          inner.setSpeed(speed01)
        },
        stop() { inner.stop() },
        dispose() { inner.dispose() },
      }
    },
    stop,
    dispose() {
      if (closed) return
      closed = true
      stop()
      soft.dispose()
      if (ac) void ac.close().catch(() => {})
      ac = null
    },
  }
}

export type ChimeTone = ToneOpts

/**
 * Scene-side sound + haptics that follow the App's 音效/震动 toggles (same
 * settings the woodfish uses). Without an App host, chimes play and haptics
 * are skipped.
 */
export function createSceneFeedback(
  ctx: Pick<SceneContext, 'prepareFeedback' | 'haptic' | 'isSoundEnabled' | 'isActive'>,
) {
  let disposed = false, focused = true
  const soundOn = () => !disposed && focused && !(typeof document !== 'undefined' && document.hidden) && (ctx.isActive?.() ?? true) && (ctx.isSoundEnabled?.() ?? true)
  const audio = createChimeAudio(soundOn)
  const blur = () => { focused = false; audio.stop() }
  const focus = () => { focused = true }
  const visibility = () => { if (document.hidden) audio.stop() }
  if (typeof window !== 'undefined') { window.addEventListener('blur', blur); window.addEventListener('focus', focus) }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', visibility)
  return {
    /** Call at gesture start so audio may start on the later impact. */
    prepare() {
      if (disposed) return
      ctx.prepareFeedback?.()
      if (soundOn()) audio.unlock()
    },
    /** The impactful moment: haptic tick plus an optional chime. */
    impact(tone?: ChimeTone) {
      if (disposed) return
      ctx.haptic?.()
      if (tone && soundOn()) audio.play(tone)
    },
    /** Material feedback never adds a second haptic tick. */
    sound(cue: SoftSound, options?: SoftSoundOptions) { audio.sound(cue, options) },
    /** Continuous friction/flow sound bed tied to mute, blur, visibility, and disposal. */
    bed(kind: ContinuousBedKind): ContinuousBed { return audio.bed(kind) },
    stop() { audio.stop() },
    /** Scene updates observe mute/pause changes even while no new cue fires. */
    update() { if (!soundOn()) audio.stop() },
    dispose() {
      if (disposed) return
      disposed = true
      if (typeof window !== 'undefined') { window.removeEventListener('blur', blur); window.removeEventListener('focus', focus) }
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', visibility)
      audio.dispose()
    },
  }
}

/** Raycasts from `camera` through client-space pointer positions on `canvas`. */
export function createPointerRay(canvas: HTMLCanvasElement, camera: THREE.Camera) {
  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  const aim = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect()
    ndc.x = ((clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1
    ndc.y = -((clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1
    raycaster.setFromCamera(ndc, camera)
    return raycaster
  }
  return {
    aim,
    /** True when the ray through the pointer hits any of `objects`. */
    hits(clientX: number, clientY: number, objects: THREE.Object3D[]) {
      return aim(clientX, clientY).intersectObjects(objects, false).length > 0
    },
  }
}

/**
 * Legacy touch-event guard for touches that start on an object. The host's
 * canvas and hit layer use touch-action: none to reserve the entire canvas
 * for scene gestures, independently of this hit test. Page scrolling remains
 * available outside that surface. Returns a remover.
 */
export function claimObjectTouches(
  hitLayer: HTMLElement,
  onObject: (clientX: number, clientY: number) => boolean,
) {
  const onTouchStart = (e: TouchEvent) => {
    const touch = e.changedTouches[0]
    if (touch && onObject(touch.clientX, touch.clientY)) e.preventDefault()
  }
  hitLayer.addEventListener('touchstart', onTouchStart, { passive: false })
  return () => hitLayer.removeEventListener('touchstart', onTouchStart)
}

/**
 * Sizes renderer, style pass and camera to the canvas box. Returns the aspect
 * so scenes can pull the camera back on narrow portrait screens.
 */
export function sizeStage(
  canvas: HTMLCanvasElement,
  renderer: THREE.WebGLRenderer,
  styleRenderer: { resize(w: number, h: number): void },
  camera: THREE.PerspectiveCamera,
) {
  const parent = canvas.parentElement
  const w = canvas.clientWidth || parent?.clientWidth || 1
  const h = canvas.clientHeight || parent?.clientHeight || 1
  renderer.setSize(w, h, false)
  styleRenderer.resize(w, h)
  camera.aspect = w / Math.max(h, 1)
  camera.updateProjectionMatrix()
  return camera.aspect
}

/** Extra camera distance for portrait screens narrower than 0.8 aspect. */
export function portraitBoost(aspect: number, factor = 3) {
  return aspect < 0.8 ? (0.8 - aspect) * factor : 0
}

/** Track the rendered canvas box: a tray can change it without resizing its host. */
export function observeCanvasResize(canvas: HTMLCanvasElement, resize: () => void) {
  if (typeof ResizeObserver === 'undefined') return () => {}
  const ro = new ResizeObserver(() => resize())
  ro.observe(canvas)
  return () => ro.disconnect()
}
