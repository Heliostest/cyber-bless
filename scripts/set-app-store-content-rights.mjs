import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { getOwnAppStoreClient } from './app-store-client.mjs';

const declaration = JSON.parse(await readFile(new URL('../store/ios/content-rights.json', import.meta.url), 'utf8'));
if (declaration.contentRightsDeclaration !== 'USES_THIRD_PARTY_CONTENT' || !declaration.developerConfirmation.referenceImagesMayBeDistributed) {
  throw Error('Confirmed material rights and the own app declaration are required');
}
const c = await getOwnAppStoreClient();
if (c.appId !== declaration.appId || c.ownApp.attributes.bundleId !== declaration.bundleIdentifier) {
  throw Error('Own application identity mismatch; no changes made');
}
const imageEvidence = [];
for (const file of ['wishes.png', 'rituals.png']) {
  const bytes = await readFile(new URL(`../assets/reference-ui/${file}`, import.meta.url));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const confirmed = declaration.confirmedImages.find(i => i.file === file);
  if (!confirmed || confirmed.bytes !== bytes.length || confirmed.sha256 !== sha256) {
    throw Error(`Confirmed image changed; verify its source before updating rights: ${file}`);
  }
  imageEvidence.push({ file, bytes:bytes.length, sha256 });
}
const expected = declaration.contentRightsDeclaration;
if (c.ownApp.attributes.contentRightsDeclaration !== expected) {
  await c.request(`/v1/apps/${c.appId}`, { method:'PATCH', body:{ data:{ type:'apps', id:c.appId, attributes:{ contentRightsDeclaration:expected } } } });
}
let actual;
for (let attempt = 0; attempt < 3; attempt++) {
  actual = (await c.request(`/v1/apps/${c.appId}`)).data;
  if (actual.attributes.bundleId !== declaration.bundleIdentifier) throw Error('Application identity changed during readback');
  if (actual.attributes.contentRightsDeclaration === expected) break;
  if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 1000));
}
if (actual.attributes.contentRightsDeclaration !== expected) throw Error('Content rights readback did not match; check status before repeating a write');
const report = { checkedAt:new Date().toISOString(), appId:c.appId, bundleIdentifier:actual.attributes.bundleId, contentRightsDeclaration:actual.attributes.contentRightsDeclaration, verified:true, developerConfirmationDate:declaration.developerConfirmation.date, imageEvidence, appReviewSubmittedByThisRun:false, privacyResponsesPublishedByThisRun:false, dsaSavedByThisRun:false };
await writeFile(new URL('../store/ios/content-rights-status.json', import.meta.url), JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
