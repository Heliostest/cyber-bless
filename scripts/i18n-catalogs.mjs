import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {parse,TYPE} from '@formatjs/icu-messageformat-parser';
import ts from 'typescript';
export const locales=['zh-Hans','zh-Hant','en','ja','ko','es','pt','fr'];
export const catalogRoot=path.resolve(import.meta.dirname,'../packages/i18n/src/catalogs');
export function validateCatalogGroups(source,target){
 return Object.keys(target).filter(group=>!Object.hasOwn(source,group)).map(group=>`${group}: unknown catalog group`);
}
export function parseCatalog(text, file='catalog.json') {
 const value=JSON.parse(text);
 if(!value||Array.isArray(value)||typeof value!=='object')throw Error(`${file}: expected a message object`);
 const ast=ts.parseJsonText(file,text),object=ast.statements[0]?.expression,keys=new Set();
 if(!object||!ts.isObjectLiteralExpression(object))throw Error(`${file}: expected an object`);
 for(const property of object.properties){
  const key=property.name?.text;
  if(keys.has(key))throw Error(`${file}: duplicate message ID ${key}`);
  keys.add(key);
 }
 return value;
}
export async function readCatalogs(){
 const catalogs={};
 for(const locale of locales){catalogs[locale]={};const seen=new Set();
  for(const file of(await readdir(path.join(catalogRoot,locale))).filter(n=>n.endsWith('.json')).sort()){
   const entries=parseCatalog(await readFile(path.join(catalogRoot,locale,file),'utf8'),`${locale}/${file}`);
   for(const id of Object.keys(entries)){if(seen.has(id))throw Error(`${locale}/${file}: message ID ${id} is repeated across catalog groups`);seen.add(id);}
   catalogs[locale][file.slice(0,-5)]=entries;
  }
 }
 for(const locale of locales){
  const issues=validateCatalogGroups(catalogs['zh-Hans'],catalogs[locale]);
  if(issues.length)throw Error(`${locale}: ${issues.join('; ')}`);
 }
 return catalogs;
}
export function messageArguments(ast){
 const args=new Map(),tags=new Set();
 const visit=nodes=>{for(const node of nodes){
  if([TYPE.argument,TYPE.number,TYPE.date,TYPE.time,TYPE.select,TYPE.plural].includes(node.type)){
   const kind=node.type===TYPE.number||node.type===TYPE.plural?'number':node.type===TYPE.date||node.type===TYPE.time?'date':'value';
   if(!args.has(node.value)||kind!=='value')args.set(node.value,kind);
  }
  if(node.type===TYPE.tag){tags.add(node.value);visit(node.children);}
  if(node.options)for(const option of Object.values(node.options))visit(option.value);
 }};visit(ast);return{args,tags};
}
function controls(ast){
 const nodes=[];
 const visit=items=>{for(const item of items){
  if(item.type===TYPE.select||item.type===TYPE.plural)nodes.push(item);
  if(item.options)for(const option of Object.values(item.options))visit(option.value);
  if(item.type===TYPE.tag)visit(item.children);
 }};visit(ast);return nodes;
}
export function validateCatalog(source,target,group='app',locale){
 const errors=[];
 for(const id of Object.keys(target))if(!Object.hasOwn(source,id))errors.push(`${id}: unknown ID`);
 for(const[id,text]of Object.entries(source)){
  if(typeof target[id]!=='string'||!target[id].trim()){errors.push(`${id}: missing translation`);continue;}
  if(target[id].includes('\uFFFD'))errors.push(`${id}: invalid replacement character`);
  try{
   const sourceAST=parse(text),targetAST=parse(target[id]);
   const a=messageArguments(sourceAST),b=messageArguments(targetAST);
   if([...a.args.keys()].sort().join('|')!==[...b.args.keys()].sort().join('|'))errors.push(`${id}: argument mismatch`);
   for(const[name,kind]of a.args)if(kind!=='value'&&b.args.get(name)!==kind)errors.push(`${id}: ${name} must be ${kind}`);
   if([...a.tags].sort().join('|')!==[...b.tags].sort().join('|'))errors.push(`${id}: rich-text tag mismatch`);
   const sourceControls=controls(sourceAST),targetControls=controls(targetAST);
   for(const control of sourceControls){
    const other=targetControls.find(node=>node.value===control.value&&node.type===control.type&&node.pluralType===control.pluralType);
    const kind=control.type===TYPE.select?'select':'plural';
    if(!other){errors.push(`${id}: ${control.value} loses ${kind} structure`);continue;}
    if(control.type===TYPE.plural&&control.offset!==other.offset)errors.push(`${id}: ${control.value} changes plural offset`);
    for(const key of Object.keys(control.options).filter(key=>control.type===TYPE.select||key.startsWith('=')))
     if(!Object.hasOwn(other.options,key))errors.push(`${id}: ${control.value} loses ${kind} branch ${key}`);
   }
   if(locale)for(const control of targetControls.filter(node=>node.type===TYPE.plural)){
    const categories=new Intl.PluralRules(locale,{type:control.pluralType}).resolvedOptions().pluralCategories;
    for(const category of categories)if(!Object.hasOwn(control.options,category))errors.push(`${id}: ${control.value} missing ${locale} plural branch ${category}`);
   }
  }catch(error){errors.push(`${id}: invalid ICU (${error.message})`);}
  if(group==='narratives'&&text.split(/\n\s*\n/).length!==target[id].split(/\n\s*\n/).length)errors.push(`${id}: paragraph count mismatch`);
 }
 return errors;
}
