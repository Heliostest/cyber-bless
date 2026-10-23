import { createInterface } from 'node:readline';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { getOwnAppStoreClient } from './app-store-client.mjs';

// Read one JSON line from stdin. Private contact values are never saved or printed.
const input = createInterface({ input:process.stdin, terminal:false });
const line = await new Promise((resolve,reject)=>{
  input.once('line',resolve);
  input.once('close',()=>reject(Error('Provide one contact JSON line on stdin')));
});
input.close();
let supplied;
try { supplied = JSON.parse(line.replace(/^\uFEFF+/,'')); }
catch { throw Error('Contact stdin must be valid UTF-8 JSON; no input values logged'); }
const fields = ['contactFirstName','contactLastName','contactEmail','contactPhone'];
const contact = Object.fromEntries(fields.map(k=>[k,supplied[k]?.trim()]));
if (fields.some(k=>!contact[k]) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.contactEmail) || !/^\+[1-9]\d{7,14}$/.test(contact.contactPhone)) throw Error('Complete review contact and international phone are required; no values logged');
const c = await getOwnAppStoreClient();
const listing = JSON.parse(await readFile(new URL('../store/ios/zh-Hans.json',import.meta.url),'utf8'));
const versions = (await c.request(`/v1/apps/${c.appId}/appStoreVersions?filter[platform]=IOS`)).data;
const version = versions.find(v=>v.attributes.versionString===c.expo.version && ['PREPARE_FOR_SUBMISSION','REJECTED','DEVELOPER_REJECTED'].includes(v.attributes.appStoreState));
if (!version) throw Error('Editable own app version not found');
const review = (await c.request(`/v1/appStoreVersions/${version.id}/appStoreReviewDetail`)).data;
await c.request(`/v1/appStoreReviewDetails/${review.id}`,{method:'PATCH',body:{data:{type:'appStoreReviewDetails',id:review.id,attributes:{...contact,demoAccountRequired:false,notes:listing.reviewNotes}}}});
const savedReview = (await c.request(`/v1/appStoreReviewDetails/${review.id}`)).data;
if (fields.some(k=>savedReview.attributes[k]!==contact[k]) || savedReview.attributes.notes!==listing.reviewNotes) throw Error('Formal review information readback failed');
const betaReview = (await c.request(`/v1/apps/${c.appId}/betaAppReviewDetail`)).data;
await c.request(`/v1/betaAppReviewDetails/${betaReview.id}`,{method:'PATCH',body:{data:{type:'betaAppReviewDetails',id:betaReview.id,attributes:{...contact,demoAccountRequired:false,notes:listing.reviewNotes}}}});
const savedBeta = (await c.request(`/v1/betaAppReviewDetails/${betaReview.id}`)).data;
if (fields.some(k=>savedBeta.attributes[k]!==contact[k]) || savedBeta.attributes.notes!==listing.reviewNotes) throw Error('Beta review information readback failed');
const locales = (await c.request(`/v1/apps/${c.appId}/betaAppLocalizations`)).data;
const locale = locales.find(l=>l.attributes.locale===listing.locale);
const attributes = {feedbackEmail:contact.contactEmail,description:listing.description,...(locale?{}:{locale:listing.locale})};
const localization = (await c.request(locale?`/v1/betaAppLocalizations/${locale.id}`:'/v1/betaAppLocalizations',{method:locale?'PATCH':'POST',body:{data:{type:'betaAppLocalizations',...(locale?{id:locale.id}:{}),attributes,...(locale?{}:{relationships:{app:{data:{type:'apps',id:c.appId}}}})}}})).data;
const verifiedLocale = (await c.request(`/v1/betaAppLocalizations/${localization.id}`)).data;
if (verifiedLocale.attributes.feedbackEmail!==contact.contactEmail) throw Error('TestFlight feedback email readback failed');
const report = {checkedAt:new Date().toISOString(),appId:c.appId,versionId:version.id,reviewDetailId:review.id,betaReviewDetailId:betaReview.id,betaAppLocalizationId:localization.id,locale:listing.locale,formalContactComplete:true,betaContactComplete:true,reviewNotesSaved:true,betaNotesSaved:true,feedbackEmailSaved:true,reviewSubmitted:false,testersInvited:false};
await mkdir(new URL('../artifacts/mobile-verification/',import.meta.url),{recursive:true});
await writeFile(new URL('../artifacts/mobile-verification/app-store-contact-status.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
