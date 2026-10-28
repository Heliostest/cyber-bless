import * as THREE from 'three'
import { bindSceneAttribute, sceneJoin } from './scene-localization'
import { setSafeText } from './procedural-kit'
import type { createPosePlacement } from './pose-placement'

/** Input instructions describe product controls, never a required ritual turn. */
export function setPlacementInspectionHelp(element: HTMLElement, enabled: boolean) {
  if (enabled) {
    element.dataset.placementInspection = 'true'
    bindSceneAttribute(element, 'title', '双指拖动可转看；鼠标用右键或 Shift 拖动。')
  } else delete element.dataset.placementInspection
}

export function setPlacementHint(element: HTMLElement, source: string, enabled: boolean, safe: (value: string) => void) {
  setPlacementInspectionHelp(element, enabled)
  setSafeText(element, enabled ? sceneJoin(source, '单指拖动拿放；双指拖动、右键或按住 Shift 拖动可转动查看。') : source, safe)
}

/** Reuses the existing accessible auxiliary action: Enter places; arrow keys
 * inspect without committing. No additional mandatory mode or button is added. */
export function addKeyboardPlacementInspection(
  button: HTMLButtonElement, canvas: HTMLCanvasElement, camera: THREE.Camera,
  model: { targets: THREE.Object3D[]; anchors?: (THREE.Vector3 | [number,number,number])[] },
  placement: Pick<ReturnType<typeof createPosePlacement>,'begin'|'rotate'|'release'>,
  options: { isActive(): boolean; step(): number; prepare(): boolean; reset(): void; rotate?(yaw:number,pitch:number):void },
) {
  bindSceneAttribute(button, 'title', '方向键转动查看，Enter 安放，Esc 放回。')
  const keydown = (event: KeyboardEvent) => {
    if (!options.isActive() || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return
    if (event.key === 'Escape') { event.preventDefault(); options.reset(); return }
    const turns: Record<string, [number,number]> = { ArrowLeft: [-.2,0], ArrowRight: [.2,0], ArrowUp: [0,-.2], ArrowDown: [0,.2] }
    const turn = turns[event.key]; if (!turn) return
    event.preventDefault()
    if (!options.prepare() || !options.isActive()) return
    const step = options.step(), target = model.targets[step]; if (!target) return
    const anchor = model.anchors?.[step], point = anchor instanceof THREE.Vector3 ? anchor.clone() : new THREE.Vector3(...(anchor ?? [0,0,0]))
    target.updateWorldMatrix(true,false); camera.updateWorldMatrix(true,false)
    target.localToWorld(point).project(camera)
    const rect = canvas.getBoundingClientRect()
    if (placement.begin(step,rect.left+(point.x+1)*rect.width/2,rect.top+(1-point.y)*rect.height/2)) {
      if(options.rotate)options.rotate(...turn);else placement.rotate(...turn)
      placement.release()
    }
  }
  button.addEventListener('keydown',keydown)
  return () => button.removeEventListener('keydown',keydown)
}
