import { Link } from 'react-router-dom'
import { GLOBAL_DISCLAIMER } from '@wbr/shared'
import { translate as tr } from '@wbr/i18n'
import { useDeveloperLocale } from '../locale'

export function Home() {
  useDeveloperLocale()
  return (
    <main className="page">
      <h1>{tr('赛博祈福')}</h1>
      <p className="muted">{tr('以小小仪式，安放日常心意')}</p>
      <p className="disclaimer" role="note">
        {tr(GLOBAL_DISCLAIMER)}
      </p>
      <Link className="btn" to="/gallery">
        {tr('进入祈福廊')}
      </Link>
    </main>
  )
}
