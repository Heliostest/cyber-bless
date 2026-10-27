import { Link } from 'react-router-dom'
import { assertSafeCopy } from '@wbr/shared'
import { translate as tr } from '@wbr/i18n'
import { useDeveloperLocale } from '../locale'

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
  useDeveloperLocale()
  return (
    <div className="scene-complete" role="dialog" aria-labelledby="scene-complete-title">
      <h2 id="scene-complete-title">{tr(HEADING)}</h2>
      <p className="muted">{tr(SUB)}</p>
      <div className="scene-complete-actions">
        <Link className="btn" to="/gallery">
          {tr(BACK)}
        </Link>
        <button type="button" className="btn" onClick={onRetry}>
          {tr(RETRY)}
        </button>
      </div>
    </div>
  )
}
