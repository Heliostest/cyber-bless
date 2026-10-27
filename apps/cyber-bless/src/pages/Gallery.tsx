import { Link } from 'react-router-dom'
import { assertSafeCopy } from '@wbr/shared'
import { sceneRegistry, isSceneImplemented } from '@wbr/scenes'
import { translate as tr, translateScene } from '@wbr/i18n'
import { useDeveloperLocale } from '../locale'

const GESTURES = ['drag', 'tilt', 'spin', 'gyro', 'wishWrite'] as const
const LATER = '稍后'
const GALLERY_TITLE = '祈福廊'
const SCENES_HEADING = '场景'
const GESTURES_HEADING = '手势试验'
const INTRO = '试点场景可进入；其余稍后。'

assertSafeCopy(LATER)
assertSafeCopy(GALLERY_TITLE)
assertSafeCopy(SCENES_HEADING)
assertSafeCopy(GESTURES_HEADING)
assertSafeCopy(INTRO)

export function Gallery() {
  useDeveloperLocale()
  return (
    <main className="page">
      <h1>{tr(GALLERY_TITLE)}</h1>
      <p className="muted">{tr(INTRO)}</p>

      <h2>{tr(GESTURES_HEADING)}</h2>
      <ul className="list">
        {GESTURES.map((g) => (
          <li key={g}>
            <Link to={`/playground/${g}`}>{g}</Link>
          </li>
        ))}
      </ul>

      <h2>{tr(SCENES_HEADING)}</h2>
      <ul className="gallery-cards">
        {sceneRegistry.map((s) => {
          assertSafeCopy(s.title)
          const ready = isSceneImplemented(s.id)
          return (
            <li
              key={s.id}
              className={ready ? 'gallery-card' : 'gallery-card gallery-card--disabled'}
            >
              {ready ? (
                <Link className="gallery-card-link" to={`/scene/${s.id}`}>
                  <span className="gallery-card-title">{translateScene(s.title)}</span>
                  <code className="muted">{s.id}</code>
                  <span className="gallery-card-meta muted">
                    {tr('{gestures} · {grade}档', { gestures: s.gestures.join(' · '), grade: s.grade })}
                  </span>
                </Link>
              ) : (
                <div className="gallery-card-link" aria-disabled="true">
                  <span className="gallery-card-title">{translateScene(s.title)}</span>
                  <code className="muted">{s.id}</code>
                  <span className="gallery-card-later">{tr(LATER)}</span>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </main>
  )
}
