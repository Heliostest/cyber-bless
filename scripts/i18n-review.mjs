import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { readCatalogs, locales, validateCatalog } from './i18n-catalogs.mjs';

// This records content identity and the actual review scope. It does not certify
// linguistic fluency, cultural facts, or device rendering from a hash match.
const catalogs = await readCatalogs();
const file = path.resolve(import.meta.dirname, '../packages/i18n/src/review-manifest.json');
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
if (!process.argv.includes('--record')) {
  console.log('Use --record after reviewing changed copy. CI checks this manifest with i18n:check.');
  process.exit(0);
}
const errors = [];
for (const locale of locales) for (const [group, source] of Object.entries(catalogs['zh-Hans'])) {
  errors.push(...validateCatalog(source, catalogs[locale][group] ?? {}, group, locale).map(error => `${locale}/${error}`));
}
if (errors.length) throw Error(`Cannot record incomplete or invalid catalogs:\n${errors.slice(0, 12).join('\n')}`);
let previous;
try { previous = JSON.parse(await readFile(file, 'utf8')); } catch { /* Initial record. */ }
const manifest = {
  version: 1,
  reviewScope: 'Automated completeness/ICU/paragraph checks and agent self-review against existing Chinese source. Traditional UI terminology reviewed separately after OpenCC draft conversion. No native-speaker certification or blanket cultural re-audit.',
  evidence: [
    'docs/research/2026-10-27-i18n-scene-implementation.md',
    'docs/research/2026-10-27-i18n-ui-finalization.md',
    'docs/research/2026-10-27-i18n-acceptance.md',
  ],
  catalogs: {},
};
for (const locale of locales) {
  manifest.catalogs[locale] = {};
  for (const [group, source] of Object.entries(catalogs['zh-Hans'])) {
    const sourceHash = digest(source), targetHash = digest(catalogs[locale][group]);
    const old = previous?.catalogs?.[locale]?.[group];
    manifest.catalogs[locale][group] = {
      sourceHash, targetHash, messages: Object.keys(source).length,
      reviewedAt: old?.sourceHash === sourceHash && old?.targetHash === targetHash ? old.reviewedAt : new Date().toISOString(),
      review: 'agent-self-review',
      reviewer: 'Codex implementation agents (translation self-review); /root (integration review)',
    };
  }
}
await writeFile(file, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Recorded ${locales.length} locale content hashes; native-speaker review is not claimed.`);
