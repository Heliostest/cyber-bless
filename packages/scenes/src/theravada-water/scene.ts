import * as THREE from 'three'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '@wbr/scene-runtime/interaction-cues'
import { createStylizedWater } from '@wbr/scene-runtime/stylized-water'
import type { GestureHandle } from '@wbr/gestures'
import type { SceneContext, SceneInstance } from '../contract'
import { claimObjectTouches } from '../procedural-kit'

type Step = 'tilt' | 'drag' | 'anjali' | 'done'

const STEP_ORDER: Step[] = ['tilt', 'drag', 'anjali']

const COPY = {
  title: '花水位一倾',
  hintTilt: '按住水壶上下拖动，让清水注入水面。',
  hintDrag: '按住花瓣，拖向水面后松开。',
  hintAnjali: '点按水面，合十致意；也可用辅助按钮。',
  hintPouring: '倾注中…',
  anjaliTap: '点按以合十',
  pourTap: '倾注清水',
  dropTap: '放上花瓣',
  done: '这一倾已留下。',
  stepsAria: '步骤',
  cueTilt: '上下拖动水壶',
  cueCarry: '拖动花瓣',
  cueWater: '放到水面',
  cueAnjali: '点按水面合十',
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

export function createTheravadaWater(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, gestures, shared } = ctx
  const { assertSafeCopy } = shared

  for (const t of Object.values(COPY)) assertSafeCopy(t)

  let step: Step = 'tilt'
  let disposed = false
  let started = false
  let restoring = true
  let pourProgress = 0
  let tilting = false

  const handles: GestureHandle[] = []
  let tiltHandle: GestureHandle | null = null
  let dragHandle: GestureHandle | null = null
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

  const anjaliBtn = document.createElement('button')
  anjaliBtn.type = 'button'
  anjaliBtn.className = 'scene-bow-tap'
  anjaliBtn.hidden = true
  setSafeText(anjaliBtn, COPY.anjaliTap, assertSafeCopy)

  overlay.append(hitLayer, titleEl, dotsEl, hintEl, anjaliBtn)

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
    anjaliBtn.hidden = step === 'done'
    setSafeText(anjaliBtn, step === 'tilt' ? COPY.pourTap : step === 'drag' ? COPY.dropTap : COPY.anjaliTap, assertSafeCopy)
    hitLayer.style.pointerEvents =
      step === 'tilt' || step === 'drag' || step === 'anjali' ? 'auto' : 'none'
    if (step === 'tilt') setHint(COPY.hintTilt)
    else if (step === 'drag') setHint(COPY.hintDrag)
    else if (step === 'anjali') setHint(COPY.hintAnjali)
    else setHint(COPY.done)
  }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.outputColorSpace = THREE.SRGBColorSpace
  const scene = new THREE.Scene()
  const bgColor = new THREE.Color(0x150f1c)
  scene.background = bgColor
  scene.fog = new THREE.FogExp2(bgColor.getHex(), 0.085)

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
  const cameraBase = new THREE.Vector3(0, 2.4, 4.1)
  const cameraHome = cameraBase.clone()
  camera.position.copy(cameraHome)
  const cameraLookAt = new THREE.Vector3(0, 0.25, 0)
  camera.lookAt(cameraLookAt)
  const styleRenderer = createDebugRenderStyle(renderer, scene, camera, {
    id: ctx.sceneId ?? 'theravada-water', label: '花水位一倾',
  })

  const ambient = new THREE.AmbientLight(0x6a5468, 0.4)
  const hemi = new THREE.HemisphereLight(0xd8b8ff, 0x120a18, 0.45)
  const key = new THREE.DirectionalLight(0xfff0e0, 0.95)
  key.position.set(2.2, 4.2, 2.5)
  const fill = new THREE.PointLight(0x8ac8e0, 0.6, 6, 2)
  fill.position.set(-1.6, 1.4, 0.6)
  scene.add(ambient, hemi, key, fill)

  // Basin / water surface
  const basin = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.35, 0.35, 48, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0xc4a882,
      metalness: 0.35,
      roughness: 0.45,
      side: THREE.DoubleSide,
    }),
  )
  basin.position.y = 0.1
  scene.add(basin)

  const waterEffect = createStylizedWater({
    geometry: new THREE.CircleGeometry(1.1, 48),
    radius: 1.1, depth: 0.16, color: 0x7acbc8, bedColor: 0xb9b18b,
    opacity: 0.40, waveScale: 1.15, causticScale: 4.2,
  })
  const water = waterEffect.surface
  water.rotation.x = -Math.PI / 2
  water.position.y = 0.22
  scene.add(water)

  const anjaliGlow = new THREE.PointLight(0xffd9a0, 0, 5, 2)
  anjaliGlow.position.set(0, 0.9, 0)
  scene.add(anjaliGlow)

  // Pitcher / pour vessel (tilts with gesture)
  const pitcherGroup = new THREE.Group()
  pitcherGroup.position.set(-1.55, 1.1, 0.4)
  scene.add(pitcherGroup)

  const pitcher = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.28, 0.7, 24),
    new THREE.MeshStandardMaterial({
      color: 0xb8c4d0,
      metalness: 0.5,
      roughness: 0.35,
    }),
  )
  pitcher.position.y = 0
  pitcherGroup.add(pitcher)

  const spout = new THREE.Mesh(
    new THREE.ConeGeometry(0.08, 0.28, 12),
    new THREE.MeshStandardMaterial({ color: 0xa0aeb8, metalness: 0.45, roughness: 0.4 }),
  )
  spout.rotation.z = Math.PI / 2
  spout.position.set(0.35, 0.15, 0)
  pitcherGroup.add(spout)

  // Stream (stretches from the spout tip down to the water surface while pouring)
  const streamBaseHeight = 0.9
  const streamMat = new THREE.MeshStandardMaterial({
    color: 0x8ad0e8,
    emissive: 0x3a90b0,
    emissiveIntensity: 0.6,
    transparent: true,
    opacity: 0,
  })
  const stream = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.045, streamBaseHeight, 8),
    streamMat,
  )
  scene.add(stream)
  const spoutWorldPos = new THREE.Vector3()

  // Petal token to drag
  const petal = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 16, 12),
    new THREE.MeshStandardMaterial({
      color: 0xe8a0b8,
      emissive: 0x6a2a40,
      emissiveIntensity: 0.35,
      metalness: 0.15,
      roughness: 0.55,
    }),
  )
  petal.scale.set(1.2, 0.35, 0.9)
  petal.position.set(1.25, 0.35, 1.15)
  petal.visible = false
  scene.add(petal)

  const moteCount = 55
  const motePositions = new Float32Array(moteCount * 3)
  for (let i = 0; i < moteCount; i++) {
    const angle = Math.random() * Math.PI * 2
    const radius = 0.6 + Math.random() * 2.1
    motePositions[i * 3] = Math.cos(angle) * radius
    motePositions[i * 3 + 1] = 0.15 + Math.random() * 1.6
    motePositions[i * 3 + 2] = Math.sin(angle) * radius
  }
  const moteGeometry = new THREE.BufferGeometry()
  moteGeometry.setAttribute('position', new THREE.BufferAttribute(motePositions, 3))
  const moteMaterial = new THREE.PointsMaterial({
    color: 0xe0b8ff,
    size: 0.028,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const motes = new THREE.Points(moteGeometry, moteMaterial)
  scene.add(motes)

  const petalHome = petal.position.clone()
  const dragTarget = petalHome.clone()
  let grabbed = false
  let petalScale = 1
  const raycaster = new THREE.Raycaster()
  const pointerNdc = new THREE.Vector2()
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.22)
  const hitPoint = new THREE.Vector3()
  const waterLocalRay = new THREE.Ray()
  const waterLocalHit = new THREE.Vector3()
  const waterInverse = new THREE.Matrix4()
  const waterLocalPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)

  const canShowCue = () => started && !disposed && !restoring &&
    (!ctx.isActive || ctx.isActive())
  const canAct = () => restoring || !ctx.isActive || ctx.isActive()
  addInteractionCue(pitcherGroup, {
    kind: 'rotate',
    label: COPY.cueTilt,
    enabled: () => canShowCue() && step === 'tilt' && !tilting,
  })
  addInteractionCue(petal, {
    kind: 'drag',
    label: COPY.cueCarry,
    enabled: () => canShowCue() && step === 'drag',
    destination: water,
    targetLabel: COPY.cueWater,
  })
  addInteractionCue(water, {
    kind: 'tap',
    label: COPY.cueAnjali,
    enabled: () => canShowCue() && step === 'anjali',
  })

  const resize = () => {
    const parent = canvas.parentElement
    const w = canvas.clientWidth || parent?.clientWidth || 1
    const h = canvas.clientHeight || parent?.clientHeight || 1
    renderer.setSize(w, h, false)
    styleRenderer.resize(w, h)
    camera.aspect = w / Math.max(h, 1)
    camera.updateProjectionMatrix()
    // Pull back along the same view direction on portrait screens, keeping
    // the pitcher and petal within the frame while preserving desktop views.
    const distanceScale = camera.aspect < 1 ? 1.3 / camera.aspect : 1
    cameraHome.copy(cameraBase).sub(cameraLookAt).multiplyScalar(distanceScale).add(cameraLookAt)
    camera.position.copy(cameraHome)
    camera.lookAt(cameraLookAt)
    camera.updateMatrixWorld()
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
    // Avoid numerical gaps at the water mesh's shared centre vertex.
    const hit = waterLocalRay.intersectPlane(waterLocalPlane, waterLocalHit)
    const radius = water.geometry.parameters.radius
    return hit !== null && hit.x * hit.x + hit.y * hit.y <= radius * radius
  }

  const hitsObject = (object: THREE.Object3D, clientX: number, clientY: number) => {
    clientToNdc(clientX, clientY)
    raycaster.setFromCamera(pointerNdc, camera)
    object.updateWorldMatrix(true, true)
    return raycaster.intersectObject(object, true).length > 0
  }
  const onPitcher = (x: number, y: number) => hitsObject(pitcherGroup, x, y)
  const onPetal = (x: number, y: number) => hitsObject(petal, x, y)
  const onOffering = (x: number, y: number) => waterHitTest(x, y) || hitsObject(basin, x, y)
  const onInteractiveObject = (x: number, y: number) => !disposed && canAct() &&
    (step === 'tilt' ? onPitcher(x, y) : step === 'drag' ? onPetal(x, y) :
      step === 'anjali' && onOffering(x, y))

  const movePetalTo = (clientX: number, clientY: number) => {
    clientToNdc(clientX, clientY)
    raycaster.setFromCamera(pointerNdc, camera)
    if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
      dragTarget.set(hitPoint.x, 0.35, hitPoint.z)
    }
  }

  const completeScene = () => {
    if (!restoring && ctx.isActive && !ctx.isActive()) return
    if (step === 'done') return
    step = 'done'
    tiltHandle?.setEnabled(false)
    dragHandle?.setEnabled(false)
    if (!restoring) ctx.onProgress?.(3)
    syncOverlayForStep()
    overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
  }

  const goDrag = () => {
    if (!restoring && ctx.isActive && !ctx.isActive()) return
    if (step !== 'tilt') return
    step = 'drag'
    tilting = false
    tiltHandle?.setEnabled(false)
    pourProgress = 1
    streamMat.opacity = 0
    petal.visible = true
    dragHandle?.setEnabled(true)
    if (!restoring) ctx.onProgress?.(1)
    syncOverlayForStep()
  }

  const goAnjali = () => {
    if (!restoring && ctx.isActive && !ctx.isActive()) return
    if (step !== 'drag') return
    step = 'anjali'
    dragHandle?.setEnabled(false)
    grabbed = false
    dragTarget.set(0, 0.28, 0)
    petal.position.copy(dragTarget)
    if (!restoring) ctx.onProgress?.(2)
    syncOverlayForStep()
  }

  const onActionTap = () => {
    if (disposed || !canAct()) return
    if (step === 'tilt') goDrag()
    else if (step === 'drag') goAnjali()
    else if (step === 'anjali') completeScene()
  }

  let downX = 0
  let downY = 0
  let tappedOffering = false
  let interactionPointerId: number | null = null
  const resetUnfinishedPour = () => {
    if (step !== 'tilt') return
    pourProgress = 0
    pitcherGroup.rotation.z = 0
    streamMat.opacity = 0
    setHint(COPY.hintTilt)
  }
  const onHitDown = (e: PointerEvent) => {
    if (interactionPointerId !== null) return
    downX = e.clientX
    downY = e.clientY
    tilting = canAct() && step === 'tilt' && onPitcher(e.clientX, e.clientY)
    grabbed = canAct() && step === 'drag' && onPetal(e.clientX, e.clientY)
    tappedOffering = canAct() && step === 'anjali' && onOffering(e.clientX, e.clientY)
    interactionPointerId = tappedOffering || tilting || grabbed ? e.pointerId : null
  }
  const onHitMove = (e: PointerEvent) => {
    if (!canAct() || e.pointerId !== interactionPointerId || step !== 'drag' || !grabbed || e.buttons === 0) return
    movePetalTo(e.clientX, e.clientY)
  }

  const onHitUp = (e: PointerEvent) => {
    if (e.pointerId !== interactionPointerId) return
    if (tappedOffering && Math.hypot(e.clientX - downX, e.clientY - downY) < 12 &&
      onOffering(e.clientX, e.clientY)) onActionTap()
    tappedOffering = false
    interactionPointerId = null
    tilting = false
    grabbed = false
    resetUnfinishedPour()
  }
  const onHitCancel = (e?: PointerEvent) => {
    if (e && e.pointerId !== interactionPointerId) return
    tappedOffering = false
    interactionPointerId = null
    tilting = false
    grabbed = false
    resetUnfinishedPour()
  }
  const onInputBlur = () => onHitCancel()

  const wireGestures = () => {
    hitLayer.addEventListener('pointerdown', onHitDown)
    hitLayer.addEventListener('pointercancel', onHitCancel)
    hitLayer.addEventListener('lostpointercapture', onHitCancel)
    window.addEventListener('blur', onInputBlur)
    stopClaim = claimObjectTouches(hitLayer, onInteractiveObject)
    tiltHandle = gestures.createTilt({
      startsOn: (x, y) => canAct() && step === 'tilt' && onPitcher(x, y),
      pourAngleDeg: 40,
      holdMs: 0,
      onAngle: (deg) => {
        if (!canAct() || step !== 'tilt') return
        const t = Math.min(1, Math.abs(deg) / 40)
        pourProgress = t
        pitcherGroup.rotation.z = THREE.MathUtils.degToRad(Math.min(Math.abs(deg), 70) * Math.sign(deg || 1) * -0.7)
        streamMat.opacity = t > 0.5 ? (t - 0.5) * 1.2 : 0
        if (t > 0.6) setHint(COPY.hintPouring)
      },
      onPour: () => {
        if (step !== 'tilt') return
        goDrag()
      },
    })
    tiltHandle.mount(hitLayer, {})
    handles.push(tiltHandle)

    dragHandle = gestures.createDrag({
      startsOn: (x, y) => canAct() && step === 'drag' && onPetal(x, y),
      hitTest: waterHitTest,
      onDrop: (hit) => {
        if (step !== 'drag' || !grabbed) return
        grabbed = false
        if (hit) goAnjali()
        else dragTarget.copy(petalHome)
      },
    })
    dragHandle.mount(hitLayer, {})
    dragHandle.setEnabled(false)
    handles.push(dragHandle)

    hitLayer.addEventListener('pointermove', onHitMove)
    hitLayer.addEventListener('pointerup', onHitUp)
    anjaliBtn.addEventListener('click', onActionTap)
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
      if ((ctx.initialProgress ?? 0) >= 2) goAnjali()
      if ((ctx.initialProgress ?? 0) >= 3) completeScene()
      restoring = false
      syncOverlayForStep()
    },
    update(dt: number) {
      if (disposed || !started) return
      if (!canAct()) {
        onHitCancel()
        tiltHandle?.setEnabled(false)
        dragHandle?.setEnabled(false)
        return
      }
      tiltHandle?.setEnabled(step === 'tilt')
      dragHandle?.setEnabled(step === 'drag')
      for (const h of handles) h.update(dt)
      const reduced = ctx.isReducedMotion?.() ?? false
      const t = reduced ? 0 : performance.now() * 0.001
      const visualDt = reduced ? 0 : dt
      waterEffect.update(dt, reduced)
      motes.rotation.y += visualDt * 0.02

      if (step !== 'tilt') {
        pitcherGroup.rotation.z = THREE.MathUtils.lerp(
          pitcherGroup.rotation.z,
          THREE.MathUtils.degToRad(-35),
          Math.min(1, dt * 4),
        )
      }
      pitcherGroup.updateMatrixWorld(true)
      spout.getWorldPosition(spoutWorldPos)
      if (streamMat.opacity > 0) {
        const waterY = water.position.y
        const dropHeight = Math.max(spoutWorldPos.y - waterY, 0.05)
        stream.position.set(
          spoutWorldPos.x,
          (spoutWorldPos.y + waterY) / 2,
          spoutWorldPos.z,
        )
        const radial = THREE.MathUtils.clamp(pourProgress, 0.2, 1)
        stream.scale.set(radial, dropHeight / streamBaseHeight, radial)
      }

      const followRate = 1 - Math.exp(-dt * 14)
      if (step === 'drag') {
        petal.position.lerp(dragTarget, followRate)
        petal.rotation.y += visualDt * 0.6
      }
      const scaleTarget = grabbed ? 1.25 : 1
      petalScale = THREE.MathUtils.lerp(petalScale, scaleTarget, 1 - Math.exp(-dt * 12))
      petal.scale.set(1.2 * petalScale, 0.35 * petalScale, 0.9 * petalScale)

      anjaliGlow.intensity =
        step === 'anjali'
          ? THREE.MathUtils.lerp(anjaliGlow.intensity, 1.1 + Math.sin(t * 3) * 0.25, 1 - Math.exp(-dt * 6))
          : THREE.MathUtils.lerp(anjaliGlow.intensity, 0, 1 - Math.exp(-dt * 6))

      camera.position.set(
        cameraHome.x + Math.sin(t * 0.13) * 0.12,
        cameraHome.y + Math.sin(t * 0.1) * 0.05,
        cameraHome.z + Math.cos(t * 0.13) * 0.12,
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
      hitLayer.removeEventListener('pointerdown', onHitDown)
      hitLayer.removeEventListener('pointermove', onHitMove)
      hitLayer.removeEventListener('pointerup', onHitUp)
      hitLayer.removeEventListener('pointercancel', onHitCancel)
      hitLayer.removeEventListener('lostpointercapture', onHitCancel)
      window.removeEventListener('blur', onInputBlur)
      anjaliBtn.removeEventListener('click', onActionTap)
      for (const h of handles) h.dispose()
      handles.length = 0
      styleRenderer.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      basin.geometry.dispose()
      ;(basin.material as THREE.Material).dispose()
      waterEffect.dispose()
      pitcher.geometry.dispose()
      ;(pitcher.material as THREE.Material).dispose()
      spout.geometry.dispose()
      ;(spout.material as THREE.Material).dispose()
      stream.geometry.dispose()
      streamMat.dispose()
      petal.geometry.dispose()
      ;(petal.material as THREE.Material).dispose()
      moteGeometry.dispose()
      moteMaterial.dispose()
      overlay.replaceChildren()
      overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
