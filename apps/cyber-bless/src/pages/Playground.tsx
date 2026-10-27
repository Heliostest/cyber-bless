import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  createDrag,
  createGyro,
  createSpin,
  createTilt,
  createWishWrite,
  type GestureHandle,
} from '@wbr/gestures'
import { assertSafeCopy } from '@wbr/shared'
import { translate as tr, type MessageValues } from '@wbr/i18n'
import { useDeveloperLocale } from '../locale'

const GESTURES = ['drag', 'tilt', 'spin', 'gyro', 'wishWrite'] as const
type GestureName = (typeof GESTURES)[number]

function isGestureName(value: string | undefined): value is GestureName {
  return GESTURES.includes(value as GestureName)
}

type Status = { source: string; values?: MessageValues }
function setSafeStatus(
  setStatus: (text: Status) => void,
  text: string, values?: MessageValues,
): void {
  assertSafeCopy(text)
  setStatus({ source: text, values })
}

function createGesture(
  name: GestureName,
  setStatus: (text: Status) => void,
): GestureHandle {
  const status = (text: string, values?: MessageValues) => setSafeStatus(setStatus, text, values)

  switch (name) {
    case 'drag':
      return createDrag({
        hitTest: () => true,
        onProgress: () => status('拖拽中'),
        onDrop: (hit) => status(hit ? '已放到目标位置' : '已放下'),
      })
    case 'tilt':
      return createTilt({
        onAngle: (deg) => status('倾角 {angle}°', { angle: Math.round(deg) }),
        onPour: () => status('倾倒触发'),
      })
    case 'spin':
      return createSpin({
        onAngle: (rad) => status('转角 {angle}°', { angle: Math.round(rad * 180 / Math.PI) }),
        onRevolution: (n) => status('完成第 {count} 圈', { count: n }),
      })
    case 'gyro':
      return createGyro({
        onBow: () => status('鞠躬触发'),
        onHold: () => status('停驻触发'),
      })
    case 'wishWrite':
      return createWishWrite({
        onSubmit: () => status('已提交短句'),
      })
  }
}

function hintFor(name: GestureName): string {
  switch (name) {
    case 'drag':
      return tr('在画面上按住拖动，松手结束。')
    case 'tilt':
      return tr('上下拖动模拟倾角；超过阈值触发倾倒。')
    case 'spin':
      return tr('左右拖动模拟旋转；满一圈有反馈。')
    case 'gyro':
      return tr('点按画面以授权运动传感器（若需要）；或使用点按回退。')
    case 'wishWrite':
      return tr('在输入框写下短句后提交。')
  }
}

export function Playground() {
  useDeveloperLocale()
  const { gesture } = useParams<{ gesture: string }>()
  const stageRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<Status>({ source: '就绪' })

  useEffect(() => {
    assertSafeCopy('就绪')
  }, [])

  useEffect(() => {
    const el = stageRef.current
    if (!el || !isGestureName(gesture)) return

    setSafeStatus(setStatus, '就绪')
    const handle = createGesture(gesture, setStatus)
    handle.mount(el, {})

    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      handle.update(dt)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      handle.dispose()
    }
  }, [gesture])

  if (!isGestureName(gesture)) {
    return (
      <main className="page">
        <h1>{tr('未知手势')}</h1>
        <p>{tr('可用：{gestures}', { gestures: GESTURES.join(', ') })}</p>
        <Link to="/playground/drag">{tr('回到 drag')}</Link>
      </main>
    )
  }

  return (
    <div className="playground-wrap">
      <div className="playground-hud">
        <div className="gesture-links">
          {GESTURES.map((g) => (
            <Link key={g} to={`/playground/${g}`} aria-current={g === gesture}>
              {g}
            </Link>
          ))}
        </div>
        <div className="hint">{hintFor(gesture)}</div>
        <div className="status" aria-live="polite">
          {tr(status.source, status.values)}
        </div>
      </div>
      <div
        ref={stageRef}
        className="playground-stage"
        data-gesture={gesture}
      />
    </div>
  )
}
