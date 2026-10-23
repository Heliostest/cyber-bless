import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { supportEmail, legalEffectiveDate, privacySections, supportSections } from '../packages/app/src/legal-content.ts';

if (!supportEmail) throw Error('Confirm a public support email before preparing Notion pages');
const directory = new URL('../store/notion/',import.meta.url);
const release = JSON.parse(await readFile(new URL('../store/ios/release-settings.json',import.meta.url),'utf8'));
if (release.appId!=='6821271597' || release.bundleIdentifier!=='com.helio.cyberbless') throw Error('Own application identity mismatch');
await mkdir(directory,{recursive:true});
for (const [slug,title,sections] of [['privacy','隐私政策',privacySections],['support','技术支持',supportSections]]) {
  const markdown = [`# 一日一念 · ${title}`,'',`生效日期：${legalEffectiveDate}`,'',`开发者：He Li`,'',`联系邮箱：[${supportEmail}](mailto:${supportEmail})`,'',...sections.flatMap(s=>[`## ${s.title}`,'',...s.paragraphs.flatMap(p=>[p,''])]),'## 联系开发者','',`如对本应用有隐私或使用问题，请发邮件至 [${supportEmail}](mailto:${supportEmail})。为定位问题，可说明App版本、设备型号、系统版本和复现步骤；请勿发送无关敏感个人信息。`,'',release.copyright,''].join('\n');
  await writeFile(new URL(`${slug}.zh-Hans.md`,directory),markdown);
}
console.log('Prepared two own-app Notion page sources from the same offline legal content; no review phone included.');
