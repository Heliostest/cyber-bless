import * as THREE from 'three'
import { graphemes } from '@wbr/i18n/text'

/** Reserved for annotations: the main camera never includes this layer. */
export const CUE_LAYER = 31
export type CuePoint = { x: number; y: number; z: number }
export type CueBox = { x: number; y: number; width: number; height: number }

function wrap(text: string, width: number, measure: (text: string) => number, locale: string) {
  const words = typeof Intl.Segmenter === 'function'
    ? [...new Intl.Segmenter(locale || undefined, { granularity: 'word' }).segment(text)].map(value => value.segment)
    : graphemes(text)
  const lines: string[] = []; let line = ''
  for (const word of words) for (const part of measure(word) > width ? graphemes(word) : [word]) {
    if (line && measure(line + part) > width) { lines.push(line.trim()); line = '' }
    line += part
  }
  if (line) lines.push(line.trim())
  return lines.length ? lines : ['']
}
function overlap(a: CueBox, b: CueBox) {
  return Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
    Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
}

/** A camera-facing, measured label and a leader, with no input surface. */
export function createCuePlacard(parent: THREE.Group) {
  const image = document.createElement('canvas')
  const ink = typeof CanvasRenderingContext2D === 'undefined' ? null : image.getContext('2d')
  const map = new THREE.CanvasTexture(image)
  map.colorSpace = THREE.SRGBColorSpace; map.minFilter = THREE.LinearFilter; map.generateMipmaps = false
  const material = new THREE.SpriteMaterial({ map, depthTest: false, depthWrite: false, toneMapped: false, fog: false })
  const board = new THREE.Sprite(material)
  // Own the quad as well as its texture: disposing a board must neither leak
  // its geometry nor invalidate Three's shared Sprite quad used by other scenes.
  board.geometry = board.geometry.clone()
  board.name = 'interaction-cue-placard'; board.layers.set(CUE_LAYER); board.renderOrder = 1001
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3))
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0x486e60, transparent: true, opacity: .85,
    depthTest: false, depthWrite: false, toneMapped: false, fog: false })
  const leader = new THREE.Line(geometry, lineMaterial)
  leader.name = 'interaction-cue-leader'; leader.layers.set(CUE_LAYER); leader.renderOrder = 1000
  board.frustumCulled = leader.frustumCulled = false
  board.raycast = leader.raycast = () => {}
  parent.add(leader, board)
  let key = '', width = 0, height = 0, previous: CueBox | undefined
  const at = new THREE.Vector3(), across = new THREE.Vector3(), above = new THREE.Vector3()
  function world(x: number, y: number, z: number, view: { width: number; height: number }, camera: THREE.Camera, out: THREE.Vector3) {
    return out.set(x / view.width * 2 - 1, 1 - y / view.height * 2, z).unproject(camera)
  }
  return {
    update({ text, detail, kind, angle, from, view, occupied, font, locale, fontVersion = 0 }: {
      text: string; detail?: string; kind: 'tap' | 'drag' | 'rotate'; angle: number; from: CuePoint;
      view: { width: number; height: number }; occupied: CueBox[]; font: string; locale: string; fontVersion?: number
    }, camera: THREE.Camera): CueBox {
      const maxWidth = Math.max(76, Math.min(232, view.width - 24)), ratio = Math.min(window.devicePixelRatio || 1, 2)
      const heading = Math.round(angle / 10) * 10
      const next = JSON.stringify([text, detail, kind, heading, maxWidth, font, locale, ratio, fontVersion])
      if (next !== key) {
        key = next
        const size = 14, lineHeight = 20
        if (ink) ink.font = `700 ${size}px ${font}`
        const measure = (value: string) => ink?.measureText(value).width ?? graphemes(value).length * size * .75
        const lines = wrap(text, maxWidth - 54, measure, locale)
        width = detail ? maxWidth : Math.min(maxWidth, Math.max(100, Math.ceil(Math.max(...lines.map(measure))) + 54))
        if (ink) ink.font = `500 11px ${font}`
        const detailMeasure = (value: string) => ink?.measureText(value).width ?? graphemes(value).length * 8
        const details = detail ? wrap(detail, width - 24, detailMeasure, locale) : []
        height = Math.max(46, lines.length * lineHeight + 20) + (details.length ? 4 + details.length * 16 : 0)
        image.width = Math.ceil(width * ratio); image.height = Math.ceil(height * ratio)
        if (ink) {
          ink.setTransform(ratio, 0, 0, ratio, 0, 0)
          ink.clearRect(0, 0, width, height)
          ink.beginPath(); ink.roundRect(2, 2, width - 4, height - 5, 12)
          ink.fillStyle = '#fffaf0'; ink.fill(); ink.lineWidth = 1.5; ink.strokeStyle = '#9abfae'; ink.stroke()
          ink.save(); ink.translate(24, 9 + lines.length * lineHeight / 2); ink.strokeStyle = '#277c6a'; ink.lineWidth = 2
          ink.lineCap = 'round'; ink.lineJoin = 'round'; ink.beginPath()
          if (kind === 'drag') {
            ink.rotate(heading * Math.PI / 180); ink.moveTo(-8, 0); ink.lineTo(8, 0); ink.moveTo(3, -5); ink.lineTo(8, 0); ink.lineTo(3, 5)
          } else if (kind === 'tap') {
            ink.arc(0, 0, 4, 0, Math.PI * 2)
            for (const [x, y] of [[0,-10],[10,0],[0,10],[-10,0]]) { ink.moveTo(x*.7, y*.7); ink.lineTo(x, y) }
          } else {
            ink.arc(0, 0, 8, .3, Math.PI*1.85); ink.moveTo(8, -7); ink.lineTo(8, -1); ink.lineTo(2, -2)
          }
          ink.stroke(); ink.restore()
          ink.fillStyle = '#35584c'; ink.font = `700 ${size}px ${font}`; ink.textBaseline = 'top'
          lines.forEach((line, i) => ink.fillText(line, 43, 9 + i * lineHeight))
          ink.fillStyle = '#557366'; ink.font = `500 11px ${font}`
          details.forEach((line, i) => ink.fillText(line, 12, 15 + lines.length * lineHeight + i * 16))
        }
        map.needsUpdate = true
      }
      // Keep the board well away from the manipulation point. Short canvases
      // use the farthest feasible candidate without pushing text offscreen.
      const gap = Math.max(76, Math.min(110, view.height * .16)), inset = 10
      const options = [
        { x: from.x - width - gap, y: from.y - height - gap },
        { x: from.x + gap, y: from.y - height - gap },
        { x: from.x - width / 2, y: from.y - height - gap },
        { x: from.x - width / 2, y: from.y + gap },
        { x: from.x - width - gap, y: from.y - height / 2 },
        { x: from.x + gap, y: from.y - height / 2 },
      ].map(box => ({ x: Math.max(inset, Math.min(view.width - width - inset, box.x)),
        y: Math.max(inset, Math.min(view.height - height - inset, box.y)), width, height }))
      const score = (box: CueBox, index: number) => {
        const distance = Math.hypot(Math.max(box.x - from.x, 0, from.x - box.x - width),
          Math.max(box.y - from.y, 0, from.y - box.y - height))
        return occupied.reduce((total, other) => total + overlap(box, other) * 50, 0) +
          Math.max(0, gap - distance) * 100 + Math.abs(distance - gap) * .5 + index * 4 +
          (previous ? Math.hypot(box.x - previous.x, box.y - previous.y) * .12 : 0)
      }
      const box = options.map((box, i) => ({ box, score: score(box, i) })).sort((a,b) => a.score-b.score)[0].box
      previous = box
      world(box.x + width/2, box.y + height/2, from.z, view, camera, at)
      world(box.x + width, box.y + height/2, from.z, view, camera, across)
      world(box.x + width/2, box.y, from.z, view, camera, above)
      board.position.copy(at); board.scale.set(at.distanceTo(across) * 2, at.distanceTo(above) * 2, 1)
      const edgeX = Math.max(box.x + 8, Math.min(box.x + width - 8, from.x))
      const edgeY = Math.max(box.y + 6, Math.min(box.y + height - 6, from.y))
      world(edgeX, edgeY, from.z, view, camera, at)
      world(from.x, from.y, from.z, view, camera, across)
      const positions = geometry.getAttribute('position') as THREE.BufferAttribute
      positions.setXYZ(0, at.x, at.y, at.z); positions.setXYZ(1, across.x, across.y, across.z); positions.needsUpdate = true
      return box
    },
    dispose() { board.removeFromParent(); leader.removeFromParent(); map.dispose(); material.dispose(); board.geometry.dispose(); geometry.dispose(); lineMaterial.dispose() },
  }
}
