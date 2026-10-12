import { chromium } from 'playwright';
import * as THREE from 'three';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const base = process.env.WBR_URL || 'http://127.0.0.1:5178/';
const out = path.resolve('artifacts/quiet-light-scenes/browser');
await mkdir(out, { recursive: true });
const ids = ['ema-votive-plaque','clootie-well-rag','diya-oil-lamp','votive-candle-catholic'];
const key = 'cyber-bless:personal:v1';
const empty = { version: 1, sceneRecords: [], wishes: [], activeSession: null, sessions: [], collectibles: [], ledger: [],
  settings: { sound: false, haptics: false, reducedMotion: true } };
const browser = await chromium.launch({ headless: true });
const results = [], errors = [];
async function pageAt(width = 390, state = empty) {
  const page = await browser.newPage({ viewport: { width, height: width > 500 ? 900 : 844 } });
  page.setDefaultTimeout(15000); page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(({key,state}) => { if (!localStorage.getItem(key)) localStorage.setItem(key,JSON.stringify(state)); },{key,state});
  await page.goto(base); return page;
}
async function catalog(page) {
  await page.getByRole('button',{name:'我的',exact:true}).click();
  await page.getByRole('button',{name:'场景目录',exact:true}).click();
}
async function open(page,id) {
  await page.locator(`.scene-card[data-scene="${id}"]`).click();
  await page.locator('canvas[data-environment-ready="true"]').waitFor();
}
const saved = page => page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
async function progress(page,id,n) {
  try {
    await page.waitForFunction(({key,id,n})=>JSON.parse(localStorage.getItem(key)).sceneRecords.find(r=>r.id===id)?.progress===n,{key,id,n},{timeout:15000});
  } catch(error) {
    console.error({id,expected:n,state:await saved(page)});
    await page.screenshot({path:path.join(out,`${id}-failed.png`),fullPage:true}); throw error;
  }
}
async function action(page,count=1) { for(let i=0;i<count;i++) await page.locator('.scene-bow-tap').click(); }
async function write(page,text) { await page.locator('.scene-wish-slot input').fill(text); await page.locator('.scene-wish-slot input').press('Enter'); }
async function shot(page,id,suffix) {
  await page.screenshot({path:path.join(out,`${id}-${suffix}.png`),fullPage:true,animations:'disabled'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${id}: overflow`);
}
async function reopen(page,id,n,count) {
  if(n===2) { await page.reload(); await catalog(page); }
  else await page.getByRole('button',{name:'返回',exact:true}).click();
  await open(page,id); const state=await saved(page);
  assert.equal(state.sceneRecords.find(r=>r.id===id).progress,n); assert.equal(state.wishes.length,count);
}
for(const width of [390,320,1280]) for(const id of ids) {
  const page=await pageAt(width); await catalog(page); await open(page,id);
  await shot(page,id,`${width}-0`); await action(page,id==='diya-oil-lamp'?3:1); await progress(page,id,1);
  if(width===390) await reopen(page,id,1,0);
  await shot(page,id,`${width}-1`);
  const phrase='愿今天温柔一点';
  if(id==='ema-votive-plaque') await write(page,phrase); else await action(page);
  await progress(page,id,2); if(width===390) await reopen(page,id,2,id==='ema-votive-plaque'?1:0);
  await shot(page,id,`${width}-2`);
  if(id==='votive-candle-catholic') await write(page,phrase); else await action(page);
  await progress(page,id,3); await shot(page,id,`${width}-3`);
  const state=await saved(page), wishes=id==='ema-votive-plaque'||id==='votive-candle-catholic'?1:0;
  assert.equal(state.wishes.length,wishes); if(wishes) assert.equal(state.wishes[0].title,phrase);
  results.push({id,width,checkpoints:3,savedWishes:wishes}); console.log(`${id} ${width}px: flow/restore passed`);
  await page.close();
}
async function project(page,id,xyz) {
  const rect=await page.locator('canvas').boundingBox(), aspect=rect.width/rect.height;
  const [fov,home,look,factor]={
    'ema-votive-plaque':[40,[.12,1.68,4.55],[0,1.1,0],3],
    'clootie-well-rag':[40,[.12,1.86,5.1],[.12,1.15,.05],4],
    'diya-oil-lamp':[43,[0,2.8,3.55],[0,.36,0],2.5],
    'votive-candle-catholic':[40,[0,1.55,4.8],[0,1.05,0],3],
  }[id];
  const camera=new THREE.PerspectiveCamera(fov,aspect,.1,60); camera.position.set(...home);
  camera.position.z+=Math.max(0,.8-aspect)*factor; camera.lookAt(new THREE.Vector3(...look)); camera.updateMatrixWorld();
  const p=new THREE.Vector3(...xyz).project(camera);
  return [rect.x+(p.x+1)*rect.width/2,rect.y+(1-p.y)*rect.height/2];
}
async function drag(page,id,route) {
  await page.locator('canvas').scrollIntoViewIfNeeded();
  const pts=await Promise.all(route.map(p=>project(page,id,p)));
  await page.mouse.move(...pts[0]); await page.mouse.down();
  for(const p of pts.slice(1)) await page.mouse.move(...p,{steps:8}); await page.mouse.up();
}
for(const id of ids) {
  const page=await pageAt(); await catalog(page); await open(page,id);
  if(id==='ema-votive-plaque') {
    await page.locator('canvas').scrollIntoViewIfNeeded(); const p=await project(page,id,[.35,.8,.62]);
    await page.mouse.move(...p); await page.mouse.down(); await page.mouse.move(p[0]-100,p[1],{steps:12}); await page.mouse.up();
    await progress(page,id,1); await write(page,'留在木牌上'); await progress(page,id,2);
    await drag(page,id,[[.35,.8,.62],[0,1.84,.09]]);
  } else if(id==='clootie-well-rag') {
    await drag(page,id,[[.53,.63,.685],[-.62,.335,.06]]); await progress(page,id,1);
    await drag(page,id,[[-.45,.91,.305],[.12,1.46,.15]]); await progress(page,id,2);
    await drag(page,id,[[.12,1.18,.175],[.12,1.18,.175]]);
  } else if(id==='diya-oil-lamp') {
    for(const p of [[-.44,.317,.11],[.44,.317,.11],[0,.317,.76]]) await drag(page,id,[p,p]);
    await progress(page,id,1);
    const route=Array.from({length:17},(_,i)=>{ const a=Math.PI/2+i*Math.PI/8; return [Math.cos(a)*.6,.84,Math.sin(a)*.6]; });
    await drag(page,id,route); await progress(page,id,2); await drag(page,id,[[0,.84,.6],[0,.225,.36]]);
  } else {
    await drag(page,id,[[-.6,.65,.65],[0,.95,.2]]); await progress(page,id,1);
    await drag(page,id,[[0,1.78,.2],[0,1.78,.2]]); await progress(page,id,2);
    await page.locator('.scene-wish-slot input').fill('尚未提交的草稿'); await action(page);
    assert.equal((await saved(page)).wishes.length,0);
  }
  await progress(page,id,3); results.push({id,directGesture:'passed'}); console.log(`${id}: direct gesture passed`); await page.close();
}
for(const id of ['ema-votive-plaque','votive-candle-catholic']) {
  const at='2026-10-11T08:00:00.000Z', state={...empty,
    wishes:[{id:'quiet-return',title:'读完一本书',intention:'每天一点',status:'realized',archived:false,createdAt:at,realizedAt:at,returnMethod:'ritual',notes:[]}],
    collectibles:[{id:'quiet-vessel',kind:'scene',sceneId:id,title:id,wishScene:true,at}]};
  const page=await pageAt(390,state); await page.getByRole('button',{name:'心愿',exact:true}).click();
  await page.locator('.wish-card[data-wish-id="quiet-return"]').click(); await page.getByRole('button',{name:'来还个愿',exact:true}).click();
  await page.locator(`.vessel-card[data-scene="${id}"]`).click(); await page.locator('canvas[data-environment-ready="true"]').waitFor();
  await action(page,3); await progress(page,id,3); await shot(page,id,'return-3');
  const after=await saved(page); assert.equal(after.wishes.length,1); assert.equal(after.wishes[0].notes.length,1);
  assert.ok(after.collectibles[0].spentAt); assert.equal(after.ledger.length,0); results.push({id,returning:'passed'}); await page.close();
}
await browser.close(); assert.deepEqual(errors,[]);
await writeFile(path.join(out,'report.json'),JSON.stringify({results,errors},null,2));
console.log(JSON.stringify({captures:50,flows:12,gestures:4,returns:2,errors,out}));
