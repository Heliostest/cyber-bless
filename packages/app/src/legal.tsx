import { useApp } from './context';
import { supportEmail, legalEffectiveDate, privacySections, supportSections } from './legal-content';
import { PageHead } from './page-heading';

export function LegalInformation({ kind }: { kind: 'privacy' | 'support' }) {
  const { back } = useApp();
  const sections = kind === 'privacy' ? privacySections : supportSections;
  return <article className="legal-information">
    <PageHead title={kind === 'privacy' ? '隐私政策' : '技术支持'} eyebrow={`一日一念 · 生效日期 ${legalEffectiveDate}`} />
    {supportEmail && <p>联系邮箱：<a href={`mailto:${supportEmail}`}>{supportEmail}</a></p>}
    {sections.map(section => <section key={section.title}><h2>{section.title}</h2>{section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</section>)}
    <button className="text-button" onClick={back}>返回我的</button>
  </article>;
}
