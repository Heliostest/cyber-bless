import {readFile}from'node:fs/promises';
import path from'node:path';
import {createHash}from'node:crypto';
import {readCatalogs,locales,validateCatalog}from'./i18n-catalogs.mjs';
const data=await readCatalogs(),errors=[],rows=[];
const selected=process.argv.find(arg=>arg.startsWith('--locales='))?.slice(10).split(',')??locales;
for(const locale of selected){
 let count=0,missing=0;
 for(const[group,source]of Object.entries(data['zh-Hans'])){
  const target=data[locale]?.[group]??{};const failures=validateCatalog(source,target,group,locale);
  count+=Object.keys(target).length;missing+=Object.keys(source).filter(id=>typeof target[id]!=='string'||!target[id].trim()).length;
  errors.push(...failures.map(text=>`${locale}/${group}: ${text}`));
 }
 rows.push({locale,messages:count,missing});
}
if(process.argv.includes('--review')){
 const file=path.resolve(import.meta.dirname,'../packages/i18n/src/review-manifest.json');
 try{const manifest=JSON.parse(await readFile(file,'utf8'));
  for(const locale of selected)for(const[group,source]of Object.entries(data['zh-Hans'])){
   const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
   const record=manifest.catalogs?.[locale]?.[group];
   if(!record||record.sourceHash!==digest(source)||record.targetHash!==digest(data[locale][group]))errors.push(`${locale}/${group}: missing or stale review record`);
  }
 }catch{errors.push('Missing review-manifest.json');}
}
console.table(rows);
if(errors.length){console.error(errors.slice(0,16).join('\n'));console.error(`${errors.length} catalog issues; untranslated entries are never filled with fallback copies.`);process.exitCode=1;}
else console.log('i18n: all selected catalogs have exact IDs, valid ICU, matching arguments and complete paragraphs');
