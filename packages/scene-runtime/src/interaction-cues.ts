import * as THREE from 'three'
export type InteractionCue = {
  kind: 'tap' | 'drag' | 'rotate'
  label: string
  enabled(): boolean
  anchor?: [number, number, number]
  destination?: THREE.Object3D | (() => THREE.Vector3)
  targetLabel?: string
  priority?: number
  /** A small icon for adjacent choices; the current choice keeps its label. */
  compact?: boolean
}
export function addInteractionCue(object: THREE.Object3D, cue: InteractionCue) {
  const cues = object.userData.interactionCues ??= []
  cues.push(cue)
  return () => { const i = cues.indexOf(cue); if (i >= 0) cues.splice(i,1) }
}
/** Presentation only: gestures and settlement remain owned by the scene. */
export function createInteractionCues(canvas: HTMLCanvasElement | undefined, scene: THREE.Scene, camera: THREE.Camera) {
  const host = canvas?.parentElement
  if (!canvas || !host) return { update() {}, dispose() {} }
  const layer = document.createElement('div')
  layer.className = 'scene-object-cues'
  layer.setAttribute('aria-hidden', 'true')
  host.append(layer)
  type Entry = { object: THREE.Object3D; cue: InteractionCue; source: HTMLElement; target?: HTMLElement; arrow?: SVGSVGElement }
  const entries = new Map<InteractionCue, Entry>()
  const cursorStyles = new Map<HTMLElement, string>()
  const world = new THREE.Vector3(), projected = new THREE.Vector3(), ray = new THREE.Raycaster(), pointer = new THREE.Vector2()
  let disposed = false, dragging: InteractionCue | undefined
  let active: Entry[] = []
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
    return { x: (projected.x + 1) * rect.width / 2, y: (1 - projected.y) * rect.height / 2 }
  }
  const icons = {
    tap: '<path d="M9 11V6a2 2 0 0 1 4 0v5l2-1 3 2v4l-3 4H9l-4-5 2-2 2 2"/><path d="M4 5l2 1M17 4l-1 2M10 1v1"/>',
    drag: '<path d="M12 3v18M3 12h18M8 7l4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4"/>',
    rotate: '<path d="M19 8a8 8 0 1 0 1 8M19 3v6h-6"/>',
  }
  function marker(role: 'source' | 'target') {
    const node = document.createElement('div')
    node.className = 'scene-object-cue'
    node.dataset.cueRole = role
    const ring = document.createElement('span'); ring.className = 'scene-object-cue-ring'
    const label = document.createElement('span'); label.className = 'scene-object-cue-label'
    node.append(ring, label)
    layer.append(node)
    return node
  }
  function position(node: HTMLElement, p: { x: number; y: number }, text: string, kind?: InteractionCue['kind']) {
    const width = canvas!.getBoundingClientRect().width
    node.dataset.x = String(p.x); node.dataset.y = String(p.y)
    node.style.left = `${p.x}px`; node.style.top = `${p.y}px`
    const label = node.lastElementChild as HTMLElement
    if (label.textContent !== text) label.textContent = text
    // Keep the label readable at the edges; the ring always stays on its object.
    const half = Math.min(width / 2 - 8, text.length * 7.5 + 14)
    label.style.setProperty('--cue-label-shift', `${Math.max(half + 8 - p.x, Math.min(0, width - half - 8 - p.x))}px`)
    node.dataset.labelSide = p.y < 62 ? 'below' : 'above'
    if (kind && node.dataset.kind !== kind) {
      node.dataset.kind = kind
      node.firstElementChild!.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[kind]}</svg>`
    }
  }
  function remove(entry: Entry) { entry.source.remove(); entry.target?.remove(); entry.arrow?.remove() }
  function layoutLabels() {
    const width = canvas!.getBoundingClientRect().width, height = canvas!.getBoundingClientRect().height
    const placed: { left: number; top: number; right: number; bottom: number }[] = []
    const sources = active.map(e => e.source)
    for (const entry of active) if (entry.target) {
      // One destination may also be a direct tap source (for example an eye).
      entry.target.hidden = active.some(other => other.cue.kind === 'tap' && Math.hypot(Number(other.source.dataset.x) - Number(entry.target!.dataset.x), Number(other.source.dataset.y) - Number(entry.target!.dataset.y)) < 24)
    }
    const nodes = [...sources.filter(source => source.dataset.compact !== 'true'), ...active.flatMap(e => e.target && !e.target.hidden ? [e.target] : [])]
    for (const node of nodes) {
      const label = node.lastElementChild as HTMLElement
      const half = Math.min(width / 2 - 8, (label.textContent?.length ?? 0) * 7.5 + 14)
      const x = Number(node.dataset.x) + Number.parseFloat(label.style.getPropertyValue('--cue-label-shift') || '0'), y = Number(node.dataset.y)
      let side = y < 62 ? 'below' : 'above', offset = 0
      const box = () => {
        const top = side === 'above' ? y - 60 - offset : y + 28 + offset
        return { left: x - half, right: x + half, top, bottom: top + 32 }
      }
      const collides = () => placed.some(p => { const b = box(); return b.left < p.right + 4 && b.right > p.left - 4 && b.top < p.bottom + 4 && b.bottom > p.top - 4 })
      for (let tries = 0; collides() && tries < 5; tries++) {
        offset += 36
        if (box().top < 8 || box().bottom > height - 8) { side = side === 'above' ? 'below' : 'above'; offset = 0 }
      }
      node.dataset.labelSide = side
      label.style.setProperty('--cue-label-offset', `${offset}px`)
      placed.push(box())
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
      const rect = canvas.getBoundingClientRect(), parentRect = host.getBoundingClientRect()
      // Absolute children start at the host's padding box, after its border.
      layer.style.left = `${rect.left - parentRect.left - host.clientLeft + host.scrollLeft}px`
      layer.style.top = `${rect.top - parentRect.top - host.clientTop + host.scrollTop}px`
      layer.style.width = `${rect.width}px`; layer.style.height = `${rect.height}px`
      const candidates: { object: THREE.Object3D; cue: InteractionCue }[] = []
      scene.traverse(object => {
        const cues: InteractionCue[] = object.userData.interactionCues ?? []
        for (const cue of cues) if (cue.enabled() && visible(object) && point(object, cue.anchor)) candidates.push({ object, cue })
      })
      candidates.sort((a, b) => (b.cue.priority ?? 0) - (a.cue.priority ?? 0))
      const selected = [...candidates.filter(e => !e.cue.compact).slice(0, 3), ...candidates.filter(e => e.cue.compact).slice(0, 4)]
      const keep = new Set(selected.map(e => e.cue))
      for (const [cue, entry] of entries) if (!keep.has(cue)) { remove(entry); entries.delete(cue) }
      active = selected.map(({ object, cue }) => {
        let entry = entries.get(cue)
        if (!entry) { entry = { object, cue, source: marker('source') }; entries.set(cue, entry) }
        const from = point(object, cue.anchor)!
        entry.source.dataset.compact = String(cue.compact ?? false)
        position(entry.source, from, cue.label, cue.kind)
        const destination = cue.destination
        const to = typeof destination === 'function' ? project(destination()) : destination && visible(destination) ? point(destination) : undefined
        if (to) {
          entry.target ??= marker('target')
          position(entry.target, to, cue.targetLabel ?? '放到这里')
          entry.arrow ??= document.createElementNS('http://www.w3.org/2000/svg', 'svg')
          entry.arrow.classList.add('scene-object-cue-path')
          entry.arrow.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`)
          const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy)
          if (length > 64) {
            const ux = dx / length, uy = dy / length, x = to.x - ux * 26, y = to.y - uy * 26
            entry.arrow.innerHTML = `<path d="M${from.x + ux * 26} ${from.y + uy * 26}L${x} ${y}m${-ux * 8 - uy * 5} ${-uy * 8 + ux * 5}L${x} ${y}l${-ux * 8 + uy * 5} ${-uy * 8 - ux * 5}"/>`
            layer.prepend(entry.arrow)
          } else entry.arrow.remove()
        } else { entry.target?.remove(); entry.target = undefined; entry.arrow?.remove() }
        return entry
      })
      layoutLabels()
      if (dragging && !keep.has(dragging)) end()
      if (!active.length) setCursor()
    },
    dispose() {
      if (disposed) return
      disposed = true
      host.removeEventListener('pointermove', move); host.removeEventListener('pointerdown', down); host.removeEventListener('pointerleave', end)
      window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); window.removeEventListener('blur', end)
      for (const [target, cursor] of cursorStyles) target.style.cursor = cursor
      entries.clear(); active = []; layer.remove()
    },
  }
}
