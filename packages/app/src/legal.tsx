import { translate as tr } from '@wbr/i18n';
import { useApp } from './context';
import { supportEmail, legalEffectiveDate, privacySections, supportSections } from './legal-content';
import { PageHead } from './page-heading';
export function LegalInformation({ kind }: {
    kind: 'privacy' | 'support';
}) {
    const { back } = useApp();
    const sections = kind === 'privacy' ? privacySections : supportSections;
    return <article className="legal-information">
    <PageHead title={kind === 'privacy' ? tr("\u9690\u79C1\u653F\u7B56") : tr("\u6280\u672F\u652F\u6301")} eyebrow={tr("\u4E00\u65E5\u4E00\u5FF5 \u00B7 \u751F\u6548\u65E5\u671F {p0}", { p0: legalEffectiveDate })}/>
    {supportEmail && <p>{tr("\u8054\u7CFB\u90AE\u7BB1\uFF1A")}<a href={`mailto:${supportEmail}`}>{supportEmail}</a></p>}
    {sections.map(section => <section key={section.title}><h2>{tr(section.title)}</h2>{section.paragraphs.map(paragraph => <p key={paragraph}>{tr(paragraph)}</p>)}</section>)}
    <button className="text-button" onClick={back}>{tr("\u8FD4\u56DE\u6211\u7684")}</button>
  </article>;
}
