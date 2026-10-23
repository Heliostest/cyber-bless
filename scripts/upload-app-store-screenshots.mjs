import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { getOwnAppStoreClient } from './app-store-client.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const config=JSON.parse(await readFile(path.join(root,'store/ios/screenshot-sizes.json'),'utf8'));
const manifest=JSON.parse(await readFile(path.join(root,'store/screenshots/ios-sizes-manifest.json'),'utf8'));
const screenshotsRoot=path.join(root,'store/screenshots/ios/zh-Hans');
if (manifest.groups.length!==config.groups.length) throw Error('Capture all configured groups before uploading');
const prepared=[];
for (const group of config.groups) {
  const record=manifest.groups.find(g=>g.displayType===group.displayType);
  if (!record || record.files.length!==config.views.length || record.files.length>10) throw Error('Invalid group/count: '+group.displayType);
  const names=new Set();
  const files=[];
  for (const entry of record.files) {
    const file=path.resolve(root,entry.file);
    const relative=path.relative(screenshotsRoot,file);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw Error('Screenshot outside its source directory');
    const fileName=path.basename(file);
    if (names.has(fileName)) throw Error('Duplicate screenshot filename: '+fileName);
    names.add(fileName);
    const bytes=await readFile(file);
    const meta=await sharp(bytes).metadata();
    if (meta.format!=='png' || meta.width!==group.width || meta.height!==group.height || meta.hasAlpha) throw Error('Screenshot dimensions/alpha mismatch: '+entry.file);
    const checksum=createHash('md5').update(bytes).digest('hex');
    if (bytes.length!==entry.bytes || createHash('sha256').update(bytes).digest('hex')!==entry.sha256 || checksum!==entry.md5) throw Error('Screenshot hash/length mismatch: '+entry.file);
    files.push({entry,fileName,bytes,checksum});
  }
  prepared.push({group,files});
}

const c=await getOwnAppStoreClient();
const version=(await c.request(`/v1/apps/${c.appId}/appStoreVersions?filter[platform]=IOS`)).data.find(v=>v.attributes.versionString===c.expo.version);
if (!version || !['PREPARE_FOR_SUBMISSION','DEVELOPER_REJECTED','REJECTED'].includes(version.attributes.appStoreState)) throw Error('No editable current iOS version; no screenshot changes made');
const locale=(await c.request(`/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations`)).data.find(l=>l.attributes.locale===config.locale);
if (!locale) throw Error('Current application locale not found');
const evidenceDirectory=path.join(root,'artifacts/mobile-verification');
await mkdir(evidenceDirectory,{recursive:true});
const report={startedAt:new Date().toISOString(),appId:c.appId,bundleId:c.ownApp.attributes.bundleId,versionId:version.id,version:version.attributes.versionString,locale:config.locale,localeId:locale.id,source:manifest.source,groups:[]};
const checkpoint=()=>writeFile(path.join(evidenceDirectory,'iphone-screenshot-upload.json'),JSON.stringify(report,null,2)+'\n');
const sets=(await c.request(`/v1/appStoreVersionLocalizations/${locale.id}/appScreenshotSets`)).data;
for (const {group,files} of prepared) {
  let set=sets.find(s=>s.attributes.screenshotDisplayType===group.displayType);
  if (!set) {
    set=(await c.request('/v1/appScreenshotSets',{method:'POST',body:{data:{type:'appScreenshotSets',attributes:{screenshotDisplayType:group.displayType},relationships:{appStoreVersionLocalization:{data:{type:'appStoreVersionLocalizations',id:locale.id}}}}}})).data;
    sets.push(set);
  }
  const existing=(await c.request(`/v1/appScreenshotSets/${set.id}/appScreenshots`)).data;
  const additions=files.filter(f=>!existing.some(s=>s.attributes.fileName===f.fileName)).length;
  if (existing.length+additions>10) throw Error('Screenshot set already has too many other images; existing assets preserved: '+group.displayType);
  const groupReport={displayType:group.displayType,setId:set.id,width:group.width,height:group.height,legacy:group.legacy ?? false,screenshots:[]};
  report.groups.push(groupReport);
  await checkpoint();
  for (const {entry,fileName,bytes,checksum} of files) {
    let screenshot=existing.find(s=>s.attributes.fileName===fileName);
    if (screenshot?.attributes.sourceFileChecksum && screenshot.attributes.sourceFileChecksum!==checksum) throw Error('Remote screenshot differs; existing image preserved: '+group.displayType+'/'+fileName);
    if (!screenshot) {
      screenshot=(await c.request('/v1/appScreenshots',{method:'POST',body:{data:{type:'appScreenshots',attributes:{fileName,fileSize:bytes.length},relationships:{appScreenshotSet:{data:{type:'appScreenshotSets',id:set.id}}}}}})).data;
      existing.push(screenshot);
    }
    if (screenshot.attributes.assetDeliveryState.state==='AWAITING_UPLOAD') {
      for (const operation of screenshot.attributes.uploadOperations) {
        const response=await c.fetch(operation.url,{method:operation.method,headers:Object.fromEntries(operation.requestHeaders.map(h=>[h.name,h.value])),body:bytes.subarray(operation.offset,operation.offset+operation.length),timeout:45000});
        if (!response.ok) throw Error('Screenshot binary upload failed ('+response.status+'): '+fileName);
      }
      screenshot=(await c.request(`/v1/appScreenshots/${screenshot.id}`,{method:'PATCH',body:{data:{type:'appScreenshots',id:screenshot.id,attributes:{uploaded:true,sourceFileChecksum:checksum}}}})).data;
    }
    const state=screenshot.attributes.assetDeliveryState.state;
    groupReport.screenshots.push({id:screenshot.id,fileName,sourceFile:entry.file,checksum,state});
    await checkpoint();
    console.log(`${group.displayType}/${fileName}: ${state}`);
    if (state==='FAILED') throw Error('Apple rejected screenshot: '+JSON.stringify(screenshot.attributes.assetDeliveryState.errors));
  }
}
let complete=false;
for (let round=0;round<18;round++) {
  let pending=0;
  for (const group of report.groups) {
    const current=(await c.request(`/v1/appScreenshotSets/${group.setId}/appScreenshots`)).data;
    for (const screenshot of group.screenshots) {
      const item=current.find(s=>s.id===screenshot.id);
      if (!item || item.attributes.sourceFileChecksum!==screenshot.checksum) throw Error('Uploaded screenshot missing/checksum mismatch: '+screenshot.fileName);
      screenshot.state=item.attributes.assetDeliveryState.state;
      if (screenshot.state==='FAILED') throw Error('Apple screenshot processing failed: '+JSON.stringify(item.attributes.assetDeliveryState.errors));
      if (screenshot.state!=='COMPLETE') pending++;
    }
  }
  await checkpoint();
  if (!pending) { complete=true;break; }
  console.log(`Apple is processing ${pending} screenshots`);
  await new Promise(resolve=>setTimeout(resolve,5000));
}
if (!complete) throw Error('Apple has not finished processing; rerun safely to resume and verify');
report.completedAt=new Date().toISOString();
report.totalScreenshots=report.groups.reduce((n,g)=>n+g.screenshots.length,0);
report.allComplete=true;
report.reviewSubmitted=false;
await checkpoint();
console.log(`Verified ${report.groups.length} iPhone groups / ${report.totalScreenshots} COMPLETE screenshots for app ${c.appId}, version ${report.version}.`);
