import { Link } from 'react-router-dom'
import { assertSafeCopy } from '@wbr/shared'

const HEADING = '这一刻已留下'
const SUB = '带着这份心意，继续今天的生活。'
const BACK = '回廊'
const RETRY = '再试一次'

assertSafeCopy(HEADING)
assertSafeCopy(SUB)
assertSafeCopy(BACK)
assertSafeCopy(RETRY)

type Props = {
  onRetry: () => void
}

export function SceneComplete({ onRetry }: Props) {
  return (
    <div className="scene-complete" role="dialog" aria-labelledby="scene-complete-title">
      <h2 id="scene-complete-title">{HEADING}</h2>
      <p className="muted">{SUB}</p>
      <div className="scene-complete-actions">
        <Link className="btn" to="/gallery">
          {BACK}
        </Link>
        <button type="button" className="btn" onClick={onRetry}>
          {RETRY}
        </button>
      </div>
    </div>
  )
}
