import {
  FORBIDDEN_SUCCESS_PHRASES,
  GLOBAL_DISCLAIMER,
} from '@wbr/shared'
import { translate as tr } from '@wbr/i18n'
import { useDeveloperLocale } from '../locale'

export function About() {
  useDeveloperLocale()
  return (
    <main className="page">
      <h1>{tr('关于')}</h1>
      <p className="disclaimer" role="note">
        {tr(GLOBAL_DISCLAIMER)}
      </p>
      <h2>{tr('文案约束')}</h2>
      <p>
        {tr('界面描述场景动作与互动反馈，不宣称宗教效力或养成结果。下列用语禁止作为成功态文案出现（免责声明常量本身除外）：')}
      </p>
      <ul className="list">
        {FORBIDDEN_SUCCESS_PHRASES.map((phrase) => (
          <li key={phrase}>
            <code>{phrase}</code>
          </li>
        ))}
      </ul>
      <p className="muted">
        {tr('开发时对用户可见字符串调用 {function}，避免误写禁用词。', { function: 'assertSafeCopy' })}
      </p>
    </main>
  )
}
