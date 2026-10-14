import * as THREE from 'three'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '@wbr/scene-runtime/interaction-cues'
import { createStylizedWater } from '@wbr/scene-runtime/stylized-water'
import type { GestureHandle } from '@wbr/gestures'
import type { SceneContext, SceneInstance } from '../contract'
import { claimObjectTouches } from '../procedural-kit'

type Step = 'gyro' | 'drag' | 'wishWrite' | 'done'

const STEP_ORDER: Step[] = ['gyro', 'drag', 'wishWrite']

const COPY = {
  title: '泉边一念',
  hintGyro: '点按泉沿，俯身一礼；也可将手机向前倾、再竖起停驻片刻，或用辅助按钮（练习）。',
  hintDrag: '按住信物，拖向泉面后松开。',
  hintWish: '泉边静下来，在输入框写下短句后提交（练习，非法效）。',
  hintHolding: '停驻片刻…',
  bowTap: '点按以鞠躬',
  dropTap: '放到泉面',
  done: '这一念已留下（练习结束）。',
  stepsAria: '步骤',
  cueCarry: '拖动信物',
  cueWater: '放到泉面',
  cueBow: '点按泉沿一礼',
} as const

function setSafeText(
  el: HTMLElement,
  text: string,
  assertSafeCopy: (t: string) => void,
) {
  assertSafeCopy(text)
  el.textContent = text
  if (el.classList.contains('scene-bow-tap')) el.setAttribute('aria-label', text)
}

export function createCelticFolkSpring(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, gestures, shared } = ctx
  const { assertSafeCopy } = shared

  for (const t of Object.values(COPY)) assertSafeCopy(t)

  let step: Step = 'gyro'
  let disposed = false
  let started = false
  let restoring = true

  const handles: GestureHandle[] = []
  let gyroHandle: GestureHandle | null = null
  let dragHandle: GestureHandle | null = null
  let wishHandle: GestureHandle | null = null
  let resizeObserver: ResizeObserver | null = null
  let stopClaim = () => {}

  overlay.replaceChildren()
  overlay.classList.add('scene-overlay', 'scene-overlay--stage')

  const hitLayer = document.createElement('div')
  hitLayer.className = 'scene-hit-layer'
  hitLayer.setAttribute('aria-hidden', 'true')

  const titleEl = document.createElement('div')
  titleEl.className = 'scene-title'
  setSafeText(titleEl, COPY.title, assertSafeCopy)

  const dotsEl = document.createElement('div')
  dotsEl.className = 'scene-step-dots'
  dotsEl.setAttribute('role', 'list')
  dotsEl.setAttribute('aria-label', COPY.stepsAria)

  const hintEl = document.createElement('div')
  hintEl.className = 'scene-hint'
  hintEl.setAttribute('aria-live', 'polite')

  const bowBtn = document.createElement('button')
  bowBtn.type = 'button'
  bowBtn.className = 'scene-bow-tap'
  bowBtn.dataset.gyroFallback = '1'
  setSafeText(bowBtn, COPY.bowTap, assertSafeCopy)

  const wishSlot = document.createElement('div')
  wishSlot.className = 'scene-wish-slot'

  overlay.append(hitLayer, titleEl, dotsEl, hintEl, bowBtn, wishSlot)

  const renderDots = () => {
    dotsEl.replaceChildren()
    const activeIdx =
      step === 'done' ? STEP_ORDER.length : STEP_ORDER.indexOf(step)
    STEP_ORDER.forEach((_, i) => {
      const dot = document.createElement('span')
      dot.className = 'scene-step-dot'
      dot.setAttribute('role', 'listitem')
      if (step === 'done' || i < activeIdx) dot.dataset.state = 'done'
      else if (i === activeIdx) dot.dataset.state = 'active'
      else dot.dataset.state = 'todo'
      dotsEl.appendChild(dot)
    })
  }

  const setHint = (text: string) => setSafeText(hintEl, text, assertSafeCopy)

  const syncOverlayForStep = () => {
    renderDots()
    bowBtn.hidden = step === 'wishWrite' || step === 'done'
    setSafeText(bowBtn, step === 'drag' ? COPY.dropTap : COPY.bowTap, assertSafeCopy)
    wishSlot.hidden = step !== 'wishWrite'
    hitLayer.style.pointerEvents = step === 'gyro' || step === 'drag' ? 'auto' : 'none'
    if (step === 'gyro') setHint(COPY.hintGyro)
    else if (step === 'drag') setHint(COPY.hintDrag)
    else if (step === 'wishWrite') setHint(COPY.hintWish)
    else setHint(COPY.done)
  }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.outputColorSpace = THREE.SRGBColorSpace
  const scene = new THREE.Scene()
  const bgColor = new THREE.Color(0x081420)
  scene.background = bgColor
  scene.fog = new THREE.FogExp2(bgColor.getHex(), 0.09)

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
  const cameraHome = new THREE.Vector3(0, 3.2, 5.7)
  camera.position.copy(cameraHome)
  const cameraLookAt = new THREE.Vector3(0, 0.15, 0)
  camera.lookAt(cameraLookAt)
  const styleRenderer = createDebugRenderStyle(renderer, scene, camera, {
    id: ctx.sceneId ?? 'celtic-folk-spring', label: '泉边一念',
  })

  const ambient = new THREE.AmbientLight(0x4a6a8a, 0.4)
  const hemi = new THREE.HemisphereLight(0x8fd0ff, 0x0a1420, 0.5)
  const key = new THREE.DirectionalLight(0xdcefff, 0.95)
  key.position.set(2, 4, 3)
  const rim = new THREE.PointLight(0xffc98a, 0.9, 6, 2)
  rim.position.set(0, 1.1, 0)
  scene.add(ambient, hemi, key, rim)

  const waterEffect = createStylizedWater({
    geometry: new THREE.CircleGeometry(1.35, 48),
    radius: 1.35, depth: 0.20, color: 0x63c8c1, bedColor: 0xa9b78c,
  })
  const water = waterEffect.surface
  water.rotation.x = -Math.PI / 2
  water.position.y = 0.02
  scene.add(water)

  const bank = new THREE.Mesh(
    new THREE.RingGeometry(1.35, 2.1, 48),
    new THREE.MeshStandardMaterial({ color: 0x91a877, roughness: 0.95 }),
  )
  bank.rotation.x = -Math.PI / 2
  scene.add(bank)

  const token = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 24, 16),
    new THREE.MeshStandardMaterial({
      color: 0xc9a46a,
      emissive: 0x8a5a1e,
      emissiveIntensity: 0.5,
      metalness: 0.4,
      roughness: 0.35,
    }),
  )
  token.position.set(1.1, 0.2, 1.1)
  scene.add(token)

  const moteCount = 60
  const motePositions = new Float32Array(moteCount * 3)
  for (let i = 0; i < moteCount; i++) {
    const angle = Math.random() * Math.PI * 2
    const radius = 0.6 + Math.random() * 2.2
    motePositions[i * 3] = Math.cos(angle) * radius
    motePositions[i * 3 + 1] = 0.15 + Math.random() * 1.6
    motePositions[i * 3 + 2] = Math.sin(angle) * radius
  }
  const moteGeometry = new THREE.BufferGeometry()
  moteGeometry.setAttribute('position', new THREE.BufferAttribute(motePositions, 3))
  const moteMaterial = new THREE.PointsMaterial({
    color: 0x9fd8ff,
    size: 0.028,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const motes = new THREE.Points(moteGeometry, moteMaterial)
  scene.add(motes)

  const tokenHome = token.position.clone()
  const dragTarget = tokenHome.clone()
  let grabbed = false
  const raycaster = new THREE.Raycaster()
  const pointerNdc = new THREE.Vector2()
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const hitPoint = new THREE.Vector3()
  const waterLocalRay = new THREE.Ray()
  const waterLocalHit = new THREE.Vector3()
  const waterInverse = new THREE.Matrix4()
  const waterLocalPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)

  const canAct = () => restoring || !ctx.isActive || ctx.isActive()
  addInteractionCue(bank, {
    kind: 'tap',
    label: COPY.cueBow,
    // Stay inside a face: the x=0 radial seam can miss at some camera drift phases.
    anchor: [.12, -1.65, 0],
    enabled: () => started && !disposed && !restoring && canAct() && step === 'gyro',
  })

  addInteractionCue(token, {
    kind: 'drag',
    label: COPY.cueCarry,
    enabled: () => started && !disposed && !restoring &&
      (!ctx.isActive || ctx.isActive()) && step === 'drag',
    destination: water,
    targetLabel: COPY.cueWater,
  })

  const resize = () => {
    const parent = canvas.parentElement
    const w = canvas.clientWidth || parent?.clientWidth || 1
    const h = canvas.clientHeight || parent?.clientHeight || 1
    renderer.setSize(w, h, false)
    styleRenderer.resize(w, h)
    camera.aspect = w / Math.max(h, 1)
    camera.updateProjectionMatrix()
  }

  const clientToNdc = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect()
    pointerNdc.x = ((clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1
    pointerNdc.y = -((clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1
  }

  const waterHitTest = (clientX: number, clientY: number) => {
    clientToNdc(clientX, clientY)
    raycaster.setFromCamera(pointerNdc, camera)
    water.updateWorldMatrix(true, false)
    waterLocalRay.copy(raycaster.ray).applyMatrix4(waterInverse.copy(water.matrixWorld).invert())
    // The CircleGeometry centre is shared by every fan triangle; a projected
    // centre ray can fall through their numerical seams. Test the water disk.
    const hit = waterLocalRay.intersectPlane(waterLocalPlane, waterLocalHit)
    const radius = water.geometry.parameters.radius
    return hit !== null && hit.x * hit.x + hit.y * hit.y <= radius * radius
  }

  const hitsObject = (object: THREE.Object3D, clientX: number, clientY: number) => {
    clientToNdc(clientX, clientY)
    raycaster.setFromCamera(pointerNdc, camera)
    object.updateWorldMatrix(true, false)
    return raycaster.intersectObject(object, false).length > 0
  }
  const onToken = (x: number, y: number) => hitsObject(token, x, y)
  const onBank = (x: number, y: number) => hitsObject(bank, x, y)
  const onInteractiveObject = (x: number, y: number) => !disposed && canAct() &&
    (step === 'gyro' ? onBank(x, y) : step === 'drag' && onToken(x, y))

  const moveTokenTo = (clientX: number, clientY: number) => {
    clientToNdc(clientX, clientY)
    raycaster.setFromCamera(pointerNdc, camera)
    if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
      dragTarget.set(hitPoint.x, 0.2, hitPoint.z)
    }
  }

  const completeScene = () => {
    if (!restoring && ctx.isActive && !ctx.isActive()) return
    if (step === 'done') return
    step = 'done'
    gyroHandle?.setEnabled(false)
    dragHandle?.setEnabled(false)
    wishHandle?.setEnabled(false)
    if (!restoring) ctx.onProgress?.(3)
    syncOverlayForStep()
    overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
  }

  const goDrag = () => {
    if (!restoring && ctx.isActive && !ctx.isActive()) return
    if (step !== 'gyro') return
    step = 'drag'
    gyroHandle?.setEnabled(false)
    bowBtn.hidden = true
    dragHandle?.setEnabled(true)
    if (!restoring) ctx.onProgress?.(1)
    syncOverlayForStep()
  }

  const goWish = () => {
    if (!restoring && ctx.isActive && !ctx.isActive()) return
    if (step !== 'drag') return
    step = 'wishWrite'
    dragHandle?.setEnabled(false)
    grabbed = false
    dragTarget.set(0, 0.15, 0)
    token.position.copy(dragTarget)
    wishHandle?.setEnabled(true)
    if (!restoring) ctx.onProgress?.(2)
    syncOverlayForStep()
  }

  /** Keyboard/tap fallback performs the same current physical object action. */
  const onActionTap = () => {
    if (disposed || !canAct()) return
    if (step === 'gyro') goDrag()
    else if (step === 'drag') goWish()
  }

  let downX = 0
  let downY = 0
  let tappedBank = false
  let bankPointerId: number | null = null
  const onOverlayDown = (e: PointerEvent) => {
    if (bankPointerId !== null) return
    downX = e.clientX
    downY = e.clientY
    tappedBank = canAct() && step === 'gyro' && onBank(e.clientX, e.clientY)
    bankPointerId = tappedBank ? e.pointerId : null
    grabbed = canAct() && step === 'drag' && onToken(e.clientX, e.clientY)
  }
  const onOverlayMove = (e: PointerEvent) => {
    if (!canAct() || step !== 'drag' || !grabbed || e.buttons === 0) return
    moveTokenTo(e.clientX, e.clientY)
  }

  const onOverlayUp = (e: PointerEvent) => {
    if (bankPointerId !== null && e.pointerId !== bankPointerId) return
    if (tappedBank && Math.hypot(e.clientX - downX, e.clientY - downY) < 12 &&
      onBank(e.clientX, e.clientY)) onActionTap()
    tappedBank = false
    bankPointerId = null
    grabbed = false
  }
  const onOverlayCancel = (e?: PointerEvent) => {
    if (bankPointerId !== null && e && e.pointerId !== bankPointerId) return
    tappedBank = false
    bankPointerId = null
    grabbed = false
  }

  const wireGestures = () => {
    hitLayer.addEventListener('pointerdown', onOverlayDown)
    hitLayer.addEventListener('pointercancel', onOverlayCancel)
    stopClaim = claimObjectTouches(hitLayer, onInteractiveObject)
    gyroHandle = gestures.createGyro({
      // Lean forward, come back near upright and hold: a deliberate move, so
      // a phone simply held to read (beta ≈ 45–90°) never ends the step.
      bowBetaDeg: 60,
      riseDeg: 30,
      holdMs: 800,
      fallbackTapSelector: '[data-gyro-fallback]',
      onBow: () => {
        if (step !== 'gyro') return
        setHint(COPY.hintHolding)
      },
      onHold: () => {
        goDrag()
      },
    })
    gyroHandle.mount(overlay, {})
    handles.push(gyroHandle)

    bowBtn.addEventListener('click', onActionTap)

    dragHandle = gestures.createDrag({
      startsOn: (x, y) => canAct() && step === 'drag' && onToken(x, y),
      hitTest: waterHitTest,
      onDrop: (hit) => {
        if (step !== 'drag' || !grabbed) return
        grabbed = false
        if (hit) goWish()
        else dragTarget.copy(tokenHome)
      },
    })
    dragHandle.mount(hitLayer, {})
    dragHandle.setEnabled(false)
    handles.push(dragHandle)

    hitLayer.addEventListener('pointermove', onOverlayMove)
    hitLayer.addEventListener('pointerup', onOverlayUp)

    wishHandle = gestures.createWishWrite({
      maxLen: 40,
      saves: ctx.saveWish !== undefined,
      onSubmit: (text) => {
        if (step !== 'wishWrite' || (ctx.isActive && !ctx.isActive())) return
        ctx.saveWish?.(text)
        completeScene()
      },
    })
    wishHandle.mount(wishSlot, {})
    wishHandle.setEnabled(false)
    handles.push(wishHandle)
  }

  syncOverlayForStep()

  return {
    start() {
      if (disposed || started) return
      started = true
      resize()
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          if (!disposed) resize()
        })
        resizeObserver.observe(canvas.parentElement ?? canvas)
      }
      wireGestures()
      if ((ctx.initialProgress ?? 0) >= 1) goDrag()
      if ((ctx.initialProgress ?? 0) >= 2) goWish()
      if ((ctx.initialProgress ?? 0) >= 3) completeScene()
      restoring = false
      syncOverlayForStep()
    },
    update(dt: number) {
      if (disposed || !started) return
      if (!canAct()) {
        onOverlayCancel()
        gyroHandle?.setEnabled(false)
        dragHandle?.setEnabled(false)
        return
      }
      gyroHandle?.setEnabled(step === 'gyro')
      dragHandle?.setEnabled(step === 'drag')
      for (const h of handles) h.update(dt)
      const reduced = ctx.isReducedMotion?.() ?? false
      const t = reduced ? 0 : performance.now() * 0.001
      const visualDt = reduced ? 0 : dt
      waterEffect.update(dt, reduced)
      motes.rotation.y += visualDt * 0.02

      const followRate = 1 - Math.exp(-dt * 14)
      if (step === 'drag') {
        token.position.lerp(dragTarget, followRate)
      } else if (step === 'gyro') {
        token.position.y = tokenHome.y + Math.sin(t * 1.6) * 0.025
        token.rotation.y += visualDt * 0.5
      }
      const scaleTarget = grabbed ? 1.25 : 1
      token.scale.setScalar(
        THREE.MathUtils.lerp(token.scale.x, scaleTarget, 1 - Math.exp(-dt * 12)),
      )

      camera.position.set(
        cameraHome.x + Math.sin(t * 0.15) * 0.12,
        cameraHome.y + Math.sin(t * 0.11) * 0.05,
        cameraHome.z + Math.cos(t * 0.15) * 0.12,
      )
      camera.lookAt(cameraLookAt)

      styleRenderer.render()
    },
    dispose() {
      if (disposed) return
      disposed = true
      resizeObserver?.disconnect()
      resizeObserver = null
      stopClaim()
      bowBtn.removeEventListener('click', onActionTap)
      hitLayer.removeEventListener('pointerdown', onOverlayDown)
      hitLayer.removeEventListener('pointermove', onOverlayMove)
      hitLayer.removeEventListener('pointerup', onOverlayUp)
      hitLayer.removeEventListener('pointercancel', onOverlayCancel)
      for (const h of handles) h.dispose()
      handles.length = 0
      styleRenderer.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      waterEffect.dispose()
      bank.geometry.dispose()
      ;(bank.material as THREE.Material).dispose()
      token.geometry.dispose()
      ;(token.material as THREE.Material).dispose()
      moteGeometry.dispose()
      moteMaterial.dispose()
      overlay.replaceChildren()
      overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
