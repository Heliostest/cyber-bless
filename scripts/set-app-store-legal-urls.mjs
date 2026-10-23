import { readFile, writeFile } from 'node:fs/promises';
import { getOwnAppStoreClient } from './app-store-client.mjs';

// Use only the exact pages verified for this application. Never submit a review.
const manifestUrl = new URL('../store/notion/pages.json',import.meta.url);
const manifest = JSON.parse(await readFile(manifestUrl,'utf8'));
if (manifest.appId!=='6821271597' || manifest.bundleIdentifier!=='com.helio.cyberbless') throw Error('Own Notion page manifest identity mismatch');
const privacy = manifest.pages.find(p=>p.kind==='privacy');
const support = manifest.pages.find(p=>p.kind==='support');
for (const page of [privacy,support]) {
  if (!page?.pageId || !page.publicUrl || !page.anonymousAccessVerified || !page.contentReadbackVerified) throw Error('Create, publish, and verify both public Notion pages before copying URLs to Apple');
  const url = new URL(page.publicUrl);
  if (url.protocol!=='https:' || !url.hostname.endsWith('.notion.site') || url.username || url.password || url.hash) throw Error('Use the verified public Notion Site URL, not a workspace editor URL');
}
const c = await getOwnAppStoreClient();
if (c.appId!==manifest.appId || c.ownApp.attributes.bundleId!==manifest.bundleIdentifier) throw Error('Apple/Notion application identity mismatch');
const listing = JSON.parse(await readFile(new URL('../store/ios/zh-Hans.json',import.meta.url),'utf8'));
const version = (await c.request(`/v1/apps/${c.appId}/appStoreVersions?filter[platform]=IOS`)).data.find(v=>v.attributes.versionString===c.expo.version && ['PREPARE_FOR_SUBMISSION','REJECTED','DEVELOPER_REJECTED'].includes(v.attributes.appStoreState));
const info = (await c.request(`/v1/apps/${c.appId}/appInfos`)).data.find(i=>['PREPARE_FOR_SUBMISSION','REJECTED','DEVELOPER_REJECTED'].includes(i.attributes.state));
if (!version || !info) throw Error('Editable own-app store metadata not found');
const infoLocale = (await c.request(`/v1/appInfos/${info.id}/appInfoLocalizations`)).data.find(l=>l.attributes.locale===listing.locale);
const versionLocale = (await c.request(`/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations`)).data.find(l=>l.attributes.locale===listing.locale);
const betaLocale = (await c.request(`/v1/apps/${c.appId}/betaAppLocalizations`)).data.find(l=>l.attributes.locale===listing.locale);
if (!infoLocale || !versionLocale || !betaLocale) throw Error('Own Chinese App Store and TestFlight localizations required');
for (const [type,id,attributes] of [
  ['appInfoLocalizations',infoLocale.id,{privacyPolicyUrl:privacy.publicUrl}],
  ['appStoreVersionLocalizations',versionLocale.id,{supportUrl:support.publicUrl}],
  ['betaAppLocalizations',betaLocale.id,{privacyPolicyUrl:privacy.publicUrl}],
]) {
  await c.request(`/v1/${type}/${id}`,{method:'PATCH',body:{data:{type,id,attributes}}});
  const saved = (await c.request(`/v1/${type}/${id}`)).data;
  if (Object.entries(attributes).some(([key,value])=>saved.attributes[key]!==value)) throw Error(`${type} URL readback failed`);
}
manifest.status = 'public_urls_saved_to_apple';
manifest.appStoreSavedAt = new Date().toISOString();
await writeFile(manifestUrl,JSON.stringify(manifest,null,2)+'\n');
const report = {checkedAt:manifest.appStoreSavedAt,appId:c.appId,versionId:version.id,infoLocalizationId:infoLocale.id,versionLocalizationId:versionLocale.id,betaLocalizationId:betaLocale.id,privacyPolicyUrl:privacy.publicUrl,supportUrl:support.publicUrl,appPrivacyResponsesPublishedByThisRun:false,reviewSubmittedByThisRun:false};
await writeFile(new URL('../store/notion/app-store-link-status.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
