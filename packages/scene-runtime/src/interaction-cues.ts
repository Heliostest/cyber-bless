import * as THREE from 'three'
import { CUE_LAYER, createCuePlacard, type CueBox } from './cue-placard'
export type InteractionCue = {
  kind: 'tap' | 'drag' | 'rotate'
  label: string
  enabled(): boolean
  anchor?: [number, number, number]
  destination?: THREE.Object3D | (() => THREE.Vector3)
  targetLabel?: string
  /** Screen-space swipe direction when there is no projected destination. */
  direction?: [number, number]
  priority?: number
  /** An adjacent point without a repeated instruction in the guide. */
  compact?: boolean
  /** Keep enabled compact instrument keys outside the usual four-marker budget. */
  keepVisible?: boolean
}
export function addInteractionCue(object: THREE.Object3D, cue: InteractionCue) {
  const cues = object.userData.interactionCues ??= []
  cues.push(cue)
  return () => { const i = cues.indexOf(cue); if (i >= 0) cues.splice(i,1) }
}
/** Presentation only: gestures and settlement remain owned by the scene. */
export function createInteractionCues(canvas: HTMLCanvasElement | undefined, scene: THREE.Scene, camera: THREE.Camera, redraw: () => void = () => {}) {
  const host = canvas?.parentElement
  if (!canvas || !host) return { update() {}, render(_renderer: THREE.WebGLRenderer) {}, dispose() {} }
  const layer = document.createElement('div')
  layer.className = 'scene-object-cues'
  layer.setAttribute('aria-hidden', 'true')
  host.append(layer)
  // DOM text remains available to diagnostics; visible copy is drawn in Three.
  const guides = document.createElement('div')
  guides.className = 'scene-cue-guides'
  guides.dataset.inWorld = 'true'
  guides.setAttribute('aria-hidden', 'true')
  const epoch = performance.now()
  const presentations = new THREE.Group()
  presentations.name = 'interaction-cue-presentations'; presentations.layers.set(CUE_LAYER)
  scene.add(presentations)
  const phase = (node: HTMLElement) => node.style.setProperty('--cue-delay', `${-((performance.now() - epoch) % 2400)}ms`)
  type Entry = { object: THREE.Object3D; cue: InteractionCue; source: HTMLElement; guide: HTMLElement; target?: HTMLElement; placard?: ReturnType<typeof createCuePlacard> }
  const entries = new Map<InteractionCue, Entry>()
  const cursorStyles = new Map<HTMLElement, string>()
  const world = new THREE.Vector3(), projected = new THREE.Vector3(), ray = new THREE.Raycaster(), pointer = new THREE.Vector2()
  let disposed = false, dragging: InteractionCue | undefined
  let inspectionHelp: HTMLElement | undefined
  let active: Entry[] = []
  let fontLocale = '', font = 'sans-serif', fontVersion = 0
  const unavailable = () => layer.hidden || !!host.querySelector('.scene-overlay-host[inert],.scene-overlay-host[data-quiet-ending]') || !!host.closest('.daily-set-preview')
  let suspended = unavailable()
  const observer = new MutationObserver(() => {
    const next = unavailable()
    if (next !== suspended && !disposed) { suspended = next; redraw() }
  })
  observer.observe(host, { subtree: true, attributes: true, attributeFilter: ['hidden', 'inert', 'data-quiet-ending'] })
  const refreshFont = () => { if (!disposed) { fontVersion++; fontLocale = ''; redraw() } }
  document.fonts?.addEventListener('loadingdone', refreshFont)
  void document.fonts?.ready.then(refreshFont)
  function visible(object: THREE.Object3D) {
    for (let parent: THREE.Object3D | null = object; parent; parent = parent.parent) if (!parent.visible) return false
    return true
  }
  function point(object: THREE.Object3D, anchor?: [number, number, number]) {
    world.set(...(anchor ?? [0, 0, 0])).applyMatrix4(object.matrixWorld)
    return project(world)
  }
  function project(value: THREE.Vector3) {
    projected.copy(value).project(camera)
    if (![projected.x, projected.y, projected.z].every(Number.isFinite) || Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1 || Math.abs(projected.z) > 1) return
    const rect = canvas!.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    return { x: (projected.x + 1) * rect.width / 2, y: (1 - projected.y) * rect.height / 2, z: projected.z }
  }
  const icons = {
    tap: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/>',
    drag: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
    rotate: '<path d="M19 8a8 8 0 1 0 1 8M19 3v6h-6"/>',
  }
  function marker(role: 'source' | 'target') {
    const node = document.createElement('div')
    node.className = 'scene-object-cue'
    node.dataset.cueRole = role
    const ring = document.createElement('span'); ring.className = 'scene-object-cue-ring'
    const dot = document.createElement('span'); dot.className = 'scene-object-cue-dot'
    node.append(ring, dot)
    phase(node)
    layer.append(node)
    return node
  }
  function position(node: HTMLElement, p: { x: number; y: number }) {
    node.dataset.x = String(p.x); node.dataset.y = String(p.y)
    node.style.left = `${p.x}px`; node.style.top = `${p.y}px`
  }
  function guide() {
    const node = document.createElement('span')
    node.className = 'scene-cue-guide'
    const direction = document.createElement('span'); direction.className = 'scene-cue-direction'
    const label = document.createElement('span'); label.className = 'scene-cue-text'
    node.append(direction, label); phase(node); guides.append(node)
    return node
  }
  function instruction(entry: Entry, from: { x: number; y: number }, to?: { x: number; y: number }) {
    const { cue, guide } = entry
    guide.hidden = !!cue.compact
    const direction = guide.firstElementChild as HTMLElement
    const label = guide.lastElementChild as HTMLElement
    const text = cue.label + (to && cue.targetLabel && cue.targetLabel !== cue.label ? ` · ${cue.targetLabel}` : '')
    if (label.textContent !== text) label.textContent = text
    if (guide.dataset.kind !== cue.kind) {
      guide.dataset.kind = cue.kind
      direction.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${icons[cue.kind]}</svg>`
    }
    const [dx, dy] = cue.direction ?? (to ? [to.x - from.x, to.y - from.y] : [0, -1])
    const angle = Math.atan2(dy, dx) * 180 / Math.PI
    direction.style.setProperty('--cue-angle', `${angle}deg`)
    direction.style.setProperty('--cue-dx', `${Math.cos(angle * Math.PI / 180) * 6}px`)
    direction.style.setProperty('--cue-dy', `${Math.sin(angle * Math.PI / 180) * 6}px`)
    guide.dataset.dragging = String(cue === dragging)
  }
  function remove(entry: Entry) { entry.source.remove(); entry.target?.remove(); entry.guide.remove(); entry.placard?.dispose() }
  function layoutGuides() {
    for (const entry of active) if (entry.target) {
      // One destination may also be a direct tap source (for example an eye).
      entry.target.hidden = active.some(other => other.cue.kind === 'tap' && Math.hypot(Number(other.source.dataset.x) - Number(entry.target!.dataset.x), Number(other.source.dataset.y) - Number(entry.target!.dataset.y)) < 24)
    }
    const shown = new Set<string>()
    for (const entry of active) {
      const key = `${entry.cue.kind}:${entry.guide.textContent}`
      entry.guide.hidden = !!entry.cue.compact || shown.has(key)
      if (!entry.guide.hidden) shown.add(key)
    }
  }
  function hit(event: MouseEvent) {
    const rect = canvas!.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1)
    if (Math.abs(pointer.x) > 1 || Math.abs(pointer.y) > 1) return
    ray.setFromCamera(pointer, camera)
    return active.filter(e => e.cue.enabled() && visible(e.object)).map(e => ({ entry: e, distance: ray.intersectObject(e.object, true)[0]?.distance ?? Infinity }))
      .sort((a, b) => a.distance - b.distance).find(e => Number.isFinite(e.distance))?.entry
  }
  function setCursor(value = '') {
    const target = host!.querySelector<HTMLElement>('.scene-hit-layer') ?? host!
    if (!cursorStyles.has(target)) cursorStyles.set(target, target.style.cursor)
    target.style.cursor = value || cursorStyles.get(target)!
  }
  function move(event: Event) {
    const hovered = hit(event as MouseEvent)
    setCursor(dragging ? 'grabbing' : hovered ? hovered.cue.kind === 'tap' ? 'pointer' : 'grab' : '')
  }
  function down(event: Event) {
    const hovered = hit(event as MouseEvent)
    if (hovered && hovered.cue.kind !== 'tap') { dragging = hovered.cue; hovered.source.dataset.dragging = 'true'; setCursor('grabbing') }
  }
  function end() {
    dragging = undefined
    for (const entry of entries.values()) delete entry.source.dataset.dragging
    setCursor()
  }
  host.addEventListener('pointermove', move, { passive: true })
  host.addEventListener('pointerdown', down, { passive: true })
  host.addEventListener('pointerleave', end, { passive: true })
  window.addEventListener('pointerup', end, { passive: true })
  window.addEventListener('pointercancel', end, { passive: true })
  window.addEventListener('blur', end)
  return {
    update() {
      if (disposed) return
      scene.updateMatrixWorld(true); camera.updateMatrixWorld(true)
      const rect = canvas.getBoundingClientRect(), parentRect = host.getBoundingClientRect()
      // Absolute children start at the host's padding box, after its border.
      layer.style.left = `${rect.left - parentRect.left - host.clientLeft + host.scrollLeft}px`
      layer.style.top = `${rect.top - parentRect.top - host.clientTop + host.scrollTop}px`
      layer.style.width = `${rect.width}px`; layer.style.height = `${rect.height}px`
      const overlay = host.querySelector<HTMLElement>('.scene-overlay-host')
      if (overlay && guides.parentElement !== overlay) overlay.append(guides)
      suspended = unavailable(); guides.hidden = suspended; presentations.visible = !suspended
      const candidates: { object: THREE.Object3D; cue: InteractionCue }[] = []
      scene.traverse(object => {
        const cues: InteractionCue[] = object.userData.interactionCues ?? []
        for (const cue of cues) if (cue.enabled() && visible(object) && point(object, cue.anchor)) candidates.push({ object, cue })
      })
      candidates.sort((a, b) => (b.cue.priority ?? 0) - (a.cue.priority ?? 0))
      const selected = [...candidates.filter(e => !e.cue.compact).slice(0, 3), ...candidates.filter(e => e.cue.compact).filter((e,i) => i < 4 || e.cue.keepVisible)]
      const keep = new Set(selected.map(e => e.cue))
      for (const [cue, entry] of entries) if (!keep.has(cue)) { remove(entry); entries.delete(cue) }
      active = selected.map(({ object, cue }) => {
        let entry = entries.get(cue)
        if (!entry) { entry = { object, cue, source: marker('source'), guide: guide() }; entries.set(cue, entry) }
        const from = point(object, cue.anchor)!
        entry.source.dataset.compact = String(cue.compact ?? false)
        position(entry.source, from)
        const destination = cue.destination
        const to = typeof destination === 'function' ? project(destination()) : destination && visible(destination) ? point(destination) : undefined
        if (to) {
          entry.target ??= marker('target')
          position(entry.target, to)
        } else { entry.target?.remove(); entry.target = undefined }
        instruction(entry, from, to)
        return entry
      })
      // The visual guide replaces the long screen-reader hint. Keep optional
      // inspection controls discoverable here, below the ordinary action.
      const inspectionHint = overlay?.querySelector<HTMLElement>('.scene-hint[data-placement-inspection="true"]')
      const helpText = active.length && !layer.hidden ? inspectionHint?.title : undefined
      if (helpText) {
        if (!inspectionHelp) { inspectionHelp = document.createElement('span'); inspectionHelp.className = 'scene-inspection-help'; guides.append(inspectionHelp) }
        if (inspectionHelp.textContent !== helpText) inspectionHelp.textContent = helpText
      } else { inspectionHelp?.remove(); inspectionHelp = undefined }
      layoutGuides()
      const locale = document.documentElement.lang || navigator.language
      if (locale !== fontLocale) { fontLocale = locale; font = getComputedStyle(host).fontFamily || 'sans-serif' }
      const occupied: CueBox[] = active.flatMap(entry => [entry.source, entry.target].filter((node): node is HTMLElement => !!node).map(node =>
        ({ x: Number(node.dataset.x)-24, y: Number(node.dataset.y)-24, width: 48, height: 48 })))
      const feedback = overlay?.querySelector<HTMLElement>('.scene-hint:is([data-ready="true"],[data-drop-ready="true"],[data-progress="true"])')?.textContent
      for (const entry of active) {
        if (entry.guide.hidden) { entry.placard?.dispose(); entry.placard = undefined; continue }
        if (suspended) continue
        entry.placard ??= createCuePlacard(presentations)
        const text = feedback || entry.guide.lastElementChild?.textContent || entry.cue.label
        const from = point(entry.object, entry.cue.anchor)!
        const angle = Number.parseFloat((entry.guide.firstElementChild as HTMLElement).style.getPropertyValue('--cue-angle')) || 0
        occupied.push(entry.placard.update({ text, detail: helpText, kind: entry.cue.kind, angle, from, view: rect, occupied, font, locale, fontVersion }, camera))
      }
      if (dragging && !keep.has(dragging)) end()
      if (!active.length) setCursor()
    },
    /** Draw sharp annotations after the world's postprocessing, on the same canvas. */
    render(renderer: THREE.WebGLRenderer) {
      if (disposed || !presentations.visible || !presentations.children.length) return
      const previous = { mask: camera.layers.mask, background: scene.background, override: scene.overrideMaterial,
        autoClear: renderer.autoClear, target: renderer.getRenderTarget(), face: renderer.getActiveCubeFace(), level: renderer.getActiveMipmapLevel(),
        viewport: renderer.getViewport(new THREE.Vector4()), scissor: renderer.getScissor(new THREE.Vector4()), scissorTest: renderer.getScissorTest(),
        shadows: renderer.shadowMap.enabled }
      try {
        camera.layers.set(CUE_LAYER); scene.background = null; scene.overrideMaterial = null
        renderer.setRenderTarget(null); renderer.setScissorTest(false); renderer.autoClear = false; renderer.shadowMap.enabled = false
        renderer.render(scene, camera)
      } finally {
        camera.layers.mask = previous.mask; scene.background = previous.background; scene.overrideMaterial = previous.override
        renderer.autoClear = previous.autoClear; renderer.shadowMap.enabled = previous.shadows
        renderer.setRenderTarget(previous.target, previous.face, previous.level)
        renderer.setViewport(previous.viewport); renderer.setScissor(previous.scissor); renderer.setScissorTest(previous.scissorTest)
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      observer.disconnect(); document.fonts?.removeEventListener('loadingdone', refreshFont)
      host.removeEventListener('pointermove', move); host.removeEventListener('pointerdown', down); host.removeEventListener('pointerleave', end)
      window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); window.removeEventListener('blur', end)
      for (const [target, cursor] of cursorStyles) target.style.cursor = cursor
      entries.forEach(remove); entries.clear(); active = []; layer.remove(); guides.remove(); presentations.removeFromParent()
    },
  }
}
