import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
const base=process.env.WBR_URL||'http://127.0.0.1:5178/'
const batch=process.env.WBR_BATCH||'village'
const batches={village:['barcelos-clay-rooster','finnish-birch-basket','croatian-licitar-heart','catalan-festival-giant'],festival:['sorbian-painted-egg','basque-sunflower','breton-banner','lithuanian-straw-garden'],handcraft:['dalarna-wooden-horse','aland-votive-ship','blang-tea','minangkabau-spinning-top'],previous:['omamori-cycle','shrine-suzu-bell','st-brigids-cross','bokjori'],seasonal:['omikuji','polish-blessing-basket','navruz-sumalak','floating-lantern-loy-krathong'],keepsake:['chinese-incense','hongsheng-red-string','italian-ex-voto','czech-pilgrim-journal']}
assert.ok(batches[batch],`Unknown batch: ${batch}`)
const out=path.resolve(`artifacts/${batch==='previous'?'next':batch}-four-scenes/browser`);await mkdir(out,{recursive:true})
const allIds=batches[batch]
const wishIds=['barcelos-clay-rooster','croatian-licitar-heart','sorbian-painted-egg','basque-sunflower','omamori-cycle','polish-blessing-basket','floating-lantern-loy-krathong','hongsheng-red-string','italian-ex-voto','aland-votive-ship','minangkabau-spinning-top']
const ids=process.env.WBR_SCENES?process.env.WBR_SCENES.split(','):allIds,key='cyber-bless:personal:v1'
const widths=process.env.WBR_WIDTHS?process.env.WBR_WIDTHS.split(',').map(Number):[390,320,1280]
const empty={version:1,sceneRecords:[],wishes:[],activeSession:null,sessions:[],collectibles:[],ledger:[],settings:{sound:false,haptics:false,reducedMotion:true}}
const browser=await chromium.launch({headless:true}),results=[],errors=[],external=[]
let captures=0,keyboardActions=0
async function pageAt(width=390,state=empty){
  const page=await browser.newPage({viewport:{width,height:width>500?900:844}});page.setDefaultTimeout(20000)
  page.on('pageerror',e=>errors.push(e.message))
  page.on('request',r=>{if(!r.url().startsWith(new URL(base).origin)&&!/^(data:|blob:)/.test(r.url()))external.push(r.url())})
  await page.addInitScript(({key,state})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(state))},{key,state})
  await page.goto(base);return page
}
async function catalog(page){await page.getByRole('button',{name:'我的',exact:true}).click();await page.getByRole('button',{name:'场景目录',exact:true}).click()}
async function open(page,id){
  if(!await page.locator(`.scene-card[data-scene="${id}"]`).count())await page.getByRole('button',{name:'显示更多',exact:true}).click()
  await page.locator(`.scene-card[data-scene="${id}"]`).click();await page.locator('canvas[data-environment-ready="true"]').waitFor()
}
const saved=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key)
async function progress(page,id,n){
  try{await page.waitForFunction(({key,id,n})=>JSON.parse(localStorage.getItem(key)).sceneRecords.find(r=>r.id===id)?.progress===n,{key,id,n})}
  catch(error){console.error(id,n,await saved(page));await shot(page,id,'failed');throw error}
  await page.waitForTimeout(150)
}
async function shot(page,id,phase){
  await page.screenshot({path:path.join(out,`${id}-${phase}.png`),fullPage:true,animations:'disabled'})
  captures++
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${id}: overflow`)
  const labels=await page.locator('.scene-object-cue:not([hidden]):not([data-compact="true"]) .scene-object-cue-label').evaluateAll(nodes=>nodes.map(el=>{
    const box=el.closest('.scene-object-cues').getBoundingClientRect(),r=el.getBoundingClientRect()
    return {text:el.textContent,inside:r.left>=box.left&&r.right<=box.right+1&&r.top>=box.top&&r.bottom<=box.bottom+1}
  }))
  for(const label of labels)assert.equal(label.inside,true,`${id}: ${label.text} outside canvas`)
  const contextSelector={'hongsheng-red-string':'.red-string-context-layers','minangkabau-spinning-top':'.top-cultural-context'}[id]
  if(contextSelector)assert.equal(await page.evaluate(({selector,gap})=>{
    const cards=document.querySelector(selector).getBoundingClientRect()
    return [...document.querySelectorAll('.scene-object-cue:not([hidden]):not([data-compact="true"]) .scene-object-cue-label')].some(el=>{
      const r=el.getBoundingClientRect();return r.left<cards.right+gap&&r.right>cards.left-gap&&r.top<cards.bottom+gap&&r.bottom>cards.top-gap
    })
  },{selector:contextSelector,gap:id==='minangkabau-spinning-top'?8:0}),false,`${id}: cue crowds its cultural context`)
}
async function action(page,count=1){for(let i=0;i<count;i++){const button=page.locator('.scene-bow-tap');await button.focus();await button.press(keyboardActions++%2?'Space':'Enter');await page.waitForTimeout(100)}}
async function write(page,text){const input=page.locator('.scene-wish-slot input');await input.fill(text);await input.press('Enter')}
async function reopen(page,id,n){await page.getByRole('button',{name:'返回',exact:true}).click();await open(page,id);assert.equal((await saved(page)).sceneRecords.find(r=>r.id===id).progress,n)}
for(const width of process.env.WBR_RETURN_ONLY||process.env.WBR_PHYSICAL_ONLY?[]:widths)for(const id of ids){
  const page=await pageAt(width);await catalog(page);await open(page,id);await shot(page,id,`${width}-0`)
  await action(page,id==='st-brigids-cross'?4:1);await progress(page,id,1);if(width===390)await reopen(page,id,1)
  await shot(page,id,`${width}-1`);await action(page);await progress(page,id,2)
  if(width===390){await page.reload();await catalog(page);await open(page,id);assert.equal((await saved(page)).sceneRecords.find(r=>r.id===id).progress,2)}
  await shot(page,id,`${width}-2`)
  if(wishIds.includes(id))await write(page,'愿这一程温柔从容');else await action(page)
  await progress(page,id,3);await shot(page,id,`${width}-3`)
  const state=await saved(page);assert.equal(state.wishes.length,wishIds.includes(id)?1:0)
  assert.equal(await page.locator('[data-cue-role="source"]').count(),0)
  // The catalog intentionally starts a fresh visit after completion; mounting it must not save again.
  if(width===390){await reopen(page,id,0);assert.equal((await saved(page)).wishes.length,state.wishes.length);assert.equal((await saved(page)).collectibles.length,state.collectibles.length)}
  results.push({id,width,checkpoints:3,wishes:state.wishes.length});console.log(`${id} ${width}px: keyboard/restore/cues passed`);await page.close()
}
async function point(page,role='source',index=0){
  await page.locator('canvas').scrollIntoViewIfNeeded()
  // A cancelled gesture resets meshes immediately; the host projects cues on its next render.
  // Sample after that frame, including any ResizeObserver work caused by full-page capture.
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
  const cue=page.locator(`[data-cue-role="${role}"]:not([hidden])`).nth(index)
  await cue.locator('.scene-object-cue-ring').waitFor()
  return cue.evaluate(el=>{const r=el.parentElement.getBoundingClientRect();return[r.left+Number(el.dataset.x),r.top+Number(el.dataset.y)]})
}
async function tap(page){await page.mouse.click(...await point(page));await page.waitForTimeout(150)}
async function drag(page){
  const from=await point(page),to=await point(page,'target');await page.mouse.move(...from);await page.mouse.down()
  await page.mouse.move(...to,{steps:18});await page.mouse.up();await page.waitForTimeout(150)
}
async function arc(page,segments=8){
  await page.mouse.move(...await point(page));await page.mouse.down()
  for(let i=0;i<segments;i++){await page.mouse.move(...await point(page,'target'),{steps:8});await page.waitForTimeout(80)}
  await page.mouse.up();await page.waitForTimeout(150)
}
async function physical(page,id,step){
  if(id==='navruz-sumalak'&&step===0)await arc(page)
  else if(id==='hongsheng-red-string'&&step===0)await arc(page,12)
  else if((id==='minangkabau-spinning-top'&&step===1)||(id==='omamori-cycle'&&step===0)||(id==='shrine-suzu-bell'&&step>0)||
    (id==='floating-lantern-loy-krathong'&&step===1)||(step===2&&!['omikuji','navruz-sumalak','floating-lantern-loy-krathong'].includes(id)))await tap(page)
  else for(let i=0;i<(id==='st-brigids-cross'&&step===0?4:1);i++)await drag(page)
}
for(const width of process.env.WBR_RETURN_ONLY?[]:widths)for(const id of ids){
  const page=await pageAt(width);await catalog(page);await open(page,id)
  const from=await point(page),box=await page.locator('canvas').boundingBox(),wrong=[box.x+3,box.y+3]
  await page.mouse.move(...wrong);await page.mouse.down();await page.mouse.move(...from);await page.mouse.up()
  await page.mouse.move(...from);await page.mouse.down();await page.mouse.move(...wrong);await page.mouse.up()
  assert.equal((await saved(page)).sceneRecords.find(r=>r.id===id)?.progress??0,0)
  await shot(page,id,`${width}-object-0`)
  for(let step=0;step<3;step++){
    if(step===2&&wishIds.includes(id))await page.locator('.scene-wish-slot input').fill('这句尚未提交')
    await physical(page,id,step);await progress(page,id,step+1);await shot(page,id,`${width}-object-${step+1}`)
  }
  assert.equal((await saved(page)).wishes.length,0,'quiet physical finish saved an unsubmitted wish')
  results.push({id,width,directCueFlow:'passed',invalidGestures:'passed'});console.log(`${id} ${width}px: real displayed-object flow passed`);await page.close()
}
for(const id of process.env.WBR_PHYSICAL_ONLY?[]:ids.filter(id=>wishIds.includes(id))){
  const at='2026-10-11T08:00:00.000Z',state={...empty,
    wishes:[{id:'return-wish',title:'走完一段路',intention:'从容向前',status:'realized',archived:false,createdAt:at,realizedAt:at,returnMethod:'ritual',sourceSceneId:id,notes:[]}],
    collectibles:[{id:'return-vessel',kind:'scene',sceneId:id,title:'心意小物',wishScene:true,at}]}
  const page=await pageAt(390,state);await page.getByRole('button',{name:'心愿',exact:true}).click()
  await page.locator('.wish-card[data-wish-id="return-wish"]').click();await page.getByRole('button',{name:'来还个愿',exact:true}).click()
  await page.locator(`.vessel-card[data-scene="${id}"]`).click();await page.locator('canvas[data-environment-ready="true"]').waitFor()
  assert.equal(await page.locator('.scene-wish-slot input').count(),0)
  await shot(page,id,'return-0')
  for(let step=0;step<3;step++){await physical(page,id,step);await progress(page,id,step+1)}
  await shot(page,id,'return-3')
  const value=await saved(page);assert.equal(value.wishes.length,1);assert.equal(value.wishes[0].notes.length,1);assert.ok(value.collectibles[0].spentAt);assert.equal(value.ledger.length,0)
  results.push({id,returning:'passed'});console.log(`${id}: return entry spends one vessel and saves only a return note`);await page.close()
}
await browser.close();assert.deepEqual(errors,[]);assert.deepEqual(external,[])
await writeFile(path.join(out,process.env.WBR_RETURN_ONLY?'return-report.json':'report.json'),JSON.stringify({results,errors,external,captures},null,2))
console.log(JSON.stringify({captures,flows:results.filter(r=>r.checkpoints).length,directCueFlows:results.filter(r=>r.directCueFlow).length,returning:results.filter(r=>r.returning).length,errors,external,out}))
