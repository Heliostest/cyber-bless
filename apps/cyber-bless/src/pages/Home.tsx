import { Link } from 'react-router-dom'
import { GLOBAL_DISCLAIMER } from '@wbr/shared'

export function Home() {
  return (
    <main className="page">
      <h1>赛博祈福</h1>
      <p className="muted">以小小仪式，安放日常心意</p>
      <p className="disclaimer" role="note">
        {GLOBAL_DISCLAIMER}
      </p>
      <Link className="btn" to="/gallery">
        进入祈福廊
      </Link>
    </main>
  )
}
