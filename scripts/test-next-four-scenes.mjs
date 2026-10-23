import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import { scenePointer } from './browser-scene-pointer.mjs'
import { isSceneVisibleInApp } from '../packages/core/src/daily-scenes.ts'
import { sceneIntention } from '../packages/core/src/scene-intentions.ts'
const base=process.env.WBR_URL||'http://127.0.0.1:5178/'
const batch=process.env.WBR_BATCH||'workshop'
const batches={gourdglass:['peruvian-engraved-gourd','venetian-glass-bead'],bojagidragonfly:['korean-bojagi-wrap','vietnamese-bamboo-dragonfly'],ebruangklung:['turkish-ebru-paper','indonesian-angklung'],kiteshadow:['weifang-paper-kite','chinese-shadow-puppet'],woolshell:['faroese-wool-knit','niue-shell-necklace'],paperclay:['polish-paper-cut','uzbek-clay-bowl'],printbead:['chinese-woodblock-print','czech-bead-star'],woven:['fijian-woven-fan','amazigh-woven-rug'],workshop:['slovak-wire-bird', 'hungarian-embroidery-hoop', 'andalusian-ceramic-tile', 'sicilian-painted-cart'],atelier:['bai-indigo-cloth', 'ndebele-painted-house', 'purepecha-copper-bowl', 'welsh-love-spoon'],village:['barcelos-clay-rooster','finnish-birch-basket','croatian-licitar-heart','catalan-festival-giant'],festival:['sorbian-painted-egg','basque-sunflower','breton-banner','lithuanian-straw-garden'],handcraft:['dalarna-wooden-horse','aland-votive-ship','blang-tea','minangkabau-spinning-top'],previous:['omamori-cycle','shrine-suzu-bell','st-brigids-cross','bokjori'],seasonal:['omikuji','polish-blessing-basket','navruz-sumalak','floating-lantern-loy-krathong'],keepsake:['chinese-incense','hongsheng-red-string','italian-ex-voto','czech-pilgrim-journal']}
assert.ok(batches[batch],`Unknown batch: ${batch}`)
const out=path.resolve(process.env.WBR_OUT||(batch==='woven'?'artifacts/woven-pair-scenes/browser':`artifacts/${batch==='previous'?'next':batch}-four-scenes/browser`));await mkdir(out,{recursive:true})
const allIds=batches[batch]
const wishIds=['alasita-miniature-house','sumiyoshi-godairiki','peruvian-engraved-gourd','korean-bojagi-wrap','turkish-ebru-paper','chinese-shadow-puppet','niue-shell-necklace','polish-paper-cut','chinese-woodblock-print','amazigh-woven-rug','hungarian-embroidery-hoop','andalusian-ceramic-tile','bai-indigo-cloth','welsh-love-spoon','barcelos-clay-rooster','croatian-licitar-heart','sorbian-painted-egg','basque-sunflower','omamori-cycle','polish-blessing-basket','floating-lantern-loy-krathong','hongsheng-red-string','italian-ex-voto','aland-votive-ship','minangkabau-spinning-top']
const ids=(process.env.WBR_SCENES?process.env.WBR_SCENES.split(','):allIds).filter(id=>isSceneVisibleInApp({id})),key='cyber-bless:personal:v1'
// Bojagi has six spatial operations and a manual finish, with integer legacy checkpoints.
if(ids.includes('korean-bojagi-wrap')){
  process.env.WBR_URL??=base
  await import('./verify-bojagi-drop.mjs')
  ids.splice(ids.indexOf('korean-bojagi-wrap'),1)
}
// Free performance has no three-step finish; exercise its dedicated contract.
if(ids.includes('malawi-sansi')){
  process.env.WBR_URL??=base
  await import('./verify-sansi-play.mjs')
  ids.splice(ids.indexOf('malawi-sansi'),1)
}
const widths=process.env.WBR_WIDTHS?process.env.WBR_WIDTHS.split(',').map(Number):[390,320,1280]
const craftDeltas={
  'nanakusa-gayu': [[-60,0],[0,-60],[0,60]],
  'brat-bride-cloth': [[0,-60],[0,-60],[0,60]],
  'alasita-miniature-house': [[0,-60],[60,0],[0,60]],
  'yusheng-lohei': [[0,60],[0,-60],[0,60]],
  'kitano-nadeushi': [[0,-60],[60,0],[0,60]],
  'lao-baci-wrist': [[0,-60],[60,0],[0,-60]],
  'finnish-virpominen': [[60,0],[60,0],[-60,0]],
  'scottish-first-footing': [[0,-60],[0,-60],[-60,0]],
  'hiiragi-iwashi': [[0,-60],[-60,0],[0,-60]],
  'tamagushi-offering': [[60,0],[60,0],[0,-60]],
  'tibetan-water-bowls': [[0,-60],[60,0],[0,60]],
  'kagami-biraki-sake': [[0,-60],[0,60],[-60,0]],
  'tibetan-prayer-flags': [[0,-60],[60,0],[0,-60]],
  'rosh-hashanah-apple-honey': [[60,0],[0,60],[-60,0]],
  'thai-songkran-elders': [[0,-60],[60,0],[0,60]],
  'kameido-usokae': [[0,-60],[-60,0],[0,60]],
  'persian-esfand': [[0,-60],[60,0],[0,60]],
  'mochigase-nagashibina': [[0,-60],[60,0],[0,60]],
  'greek-vasilopita': [[0,-60],[60,0],[0,60]],
  'tibetan-khata-greeting': [[0,-60],[60,0],[60,0]],
  'shichigosan-chitose-ame': [[0,-60],[60,0],[0,60]],
  'mongolian-ovoo': [[-60,0],[-60,0],[-60,0]],
  'fgs-buddha-bathing': [[0,-60],[0,-60],[0,-60]],
  'balinese-canang-sari': [[60,0],[0,-60],[-60,0]],
  'bulgarian-survakane': [[0,-60],[60,0],[0,-60]],
  'lanna-sand-pagoda': [[0,-60],[60,0],[0,60]],
  'chinese-fu-paper': [[0,-60],[60,0],[0,-60]],
  'turkish-nazar-bead': [[0,-60],[60,0],[0,60]],
  'setsubun-mamemaki': [[60,0],[0,-60],[0,60]],
  'sternsinger-house-blessing': [[0,-60],[60,0],[0,60]],
  'lam-tsuen-wishing-tree': [[60,0],[60,0],[0,-60]],
  'kagami-mochi-offering': [[0,-60],[0,-60],[0,-60]],
  'romanian-martisor': [[0,-60],[60,0],[0,60]],
  'sumiyoshi-godairiki': [[60,0],[60,0],[60,0]],
  'polish-oplatek-sharing': [[0,-60],[60,0],[0,-60]],
  'greek-new-year-pomegranate': [[0,-60],[60,0],[0,60]],
  'bonfim-ribbon': [[60,0],[-60,0],[60,0]],
  'chinowa-kuguri': [[-60,0],[60,0],[-60,0]],
  'zeniarai-coin-washing': [[0,-60],[-60,0],[60,0]],
  'udo-undama': [[0,-60],[60,0],[0,-60]],
  'japanese-daruma-otoshi': [[0,60],[60,0],[0,-60]],
  'paper-pinwheel': [[60,0],[0,-60],[60,0]],
  'chinese-steelyard':[[60,0],[0,-60],[0,60]],
  'garden-croquet':[[-60,0],[60,0],[60,0]],
  'welsh-drop-spindle':[[60,0],[0,60],[0,-60]],
  'scottish-plunge-churn':[[0,60],[0,-60],[0,-60]],
  'irish-bodhran':[[0,60],[0,-60],[60,0]],
  'french-coffee-mill':[[-60,0],[60,0],[0,60]],
  'japanese-wagasa':[[0,-60],[60,0],[0,60]],
  'spanish-castanets':[[0,60],[0,60],[0,60]],
  'japanese-shishi-odoshi':[[-60,0],[0,60],[0,60]],
  'german-jumping-jack':[[0,60],[0,60],[0,60]],
  'finnish-kantele':[[0,-60],[0,60],[0,-60]],
  'estonian-village-swing':[[0,-60],[0,60],[0,-60]],
  'french-petanque':[[0,-60],[0,-60],[0,-60]],
  'english-hearth-bellows':[[0,-60],[0,60],[0,-60]],
  'mexican-metate':[[0,60],[0,-60],[0,-60]],
  'czech-wooden-ratchet':[[60,0],[-60,0],[0,-60]],
  'puerto-rican-guiro':[[0,60],[0,-60],[60,0]],
  'valencian-folding-fan':[[60,0],[-60,0],[-60,0]],
  'mexican-tortilla-press':[[0,60],[0,60],[0,-60]],
  'ghanaian-oware':[[0,-60],[60,0],[-60,0]],
  'chinese-rattle-drum':[[60,0],[-60,0],[0,60]],
  'chinese-tangram':[[-60,0],[0,-60],[60,0]],
  'chinese-diabolo':[[0,-60],[-60,0],[0,60]],
  'korean-yutnori':[[60,0],[0,-60],[0,-60]],
  'russian-matryoshka':[[0,-60],[-60,0],[0,-60]],
  'japanese-koinobori':[[60,0],[0,60],[60,0]],
  'japanese-kendama':[[0,-60],[0,-60],[0,-60]],
  'indian-charkha':[[-60,0],[60,0],[60,0]],
  'german-nutcracker':[[0,-60],[0,-60],[0,60]],
  'mexican-molinillo':[[0,60],[60,0],[-60,0]],
  'chinese-suanpan':[[0,-60],[0,60],[0,-60]],
  'peruvian-engraved-gourd':[[60,0],[0,60]],
  'venetian-glass-bead':[[0,-60],[60,0]],
  'vietnamese-bamboo-dragonfly':[[0,-60],[60,0]],
  'turkish-ebru-paper':[[60,0],[0,-60]],
  'indonesian-angklung':[[-60,0],[60,0]],
  'chinese-shadow-puppet':[[0,-60],[60,0]],
  'weifang-paper-kite':[[-48,-36],[0,60]],
  'faroese-wool-knit':[[-48,-36],[42,46]],
  'niue-shell-necklace':[[-60,0],[0,-60]],
}
const empty={version:1,sceneRecords:[],wishes:[],activeSession:null,sessions:[],collectibles:[],ledger:[],settings:{sound:false,haptics:false,reducedMotion:process.env.WBR_MOTION!=='1'}}
const browser=await chromium.launch({headless:true}),results=[],errors=[],external=[]
let captures=0,keyboardActions=0
const pointers=new WeakMap(), touchMode=process.env.WBR_TOUCH==='1'
async function pageAt(width=390,state=empty){
  const page=await browser.newPage({viewport:{width,height:width>500?900:844},hasTouch:touchMode,isMobile:touchMode});page.setDefaultTimeout(20000)
  page.on('pageerror',e=>errors.push(e.message))
  page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text())})
  page.on('request',r=>{if(!r.url().startsWith(new URL(base).origin)&&!/^(data:|blob:)/.test(r.url()))external.push(r.url())})
  await page.addInitScript(({key,state})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(state))},{key,state})
  await page.goto(base);pointers.set(page,await scenePointer(page,touchMode));return page
}
async function catalog(page){await page.getByRole('button',{name:'我的',exact:true}).click();await page.getByRole('button',{name:'场景目录',exact:true}).click()}
async function open(page,id){
  while(!await page.locator(`.scene-card[data-scene="${id}"]`).count())await page.getByRole('button',{name:'显示更多',exact:true}).click()
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
async function write(page,text){await page.locator('.scene-wish-invite').click();const input=page.locator('.scene-post-wish input');await input.fill(text);await input.press('Enter')}
async function reopen(page,id,n){await page.getByRole('button',{name:'返回',exact:true}).click();await open(page,id);assert.equal((await saved(page)).sceneRecords.find(r=>r.id===id).progress,n)}
for(const width of process.env.WBR_RETURN_ONLY||process.env.WBR_PHYSICAL_ONLY?[]:widths)for(const id of ids){
  const page=await pageAt(width);await catalog(page);await open(page,id);await shot(page,id,`${width}-0`)
  await action(page,id==='st-brigids-cross'?4:1);await progress(page,id,1);if(width===390)await reopen(page,id,1)
  await shot(page,id,`${width}-1`);await action(page);await progress(page,id,2)
  if(width===390){await page.reload();await catalog(page);await open(page,id);assert.equal((await saved(page)).sceneRecords.find(r=>r.id===id).progress,2)}
  await shot(page,id,`${width}-2`)
  await action(page)
  if(id==='korean-yutnori')await page.locator('.scene-yut-finish').click()
  await progress(page,id,3)
  if(sceneIntention(id)?.optionalWish)await write(page,'愿这一程温柔从容')
  await shot(page,id,`${width}-3`)
  const state=await saved(page);assert.equal(state.wishes.length,sceneIntention(id)?.optionalWish?1:0)
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
async function tap(page){const p=pointers.get(page);await p.down(await point(page));await p.up();await page.waitForTimeout(150)}
async function drag(page){
  const from=await point(page),to=await point(page,'target'),p=pointers.get(page);await p.down(from)
  await p.move(to,18);await p.up();await page.waitForTimeout(150)
}
async function arc(page,segments=8){
  await page.mouse.move(...await point(page));await page.mouse.down()
  for(let i=0;i<segments;i++){await page.mouse.move(...await point(page,'target'),{steps:8});await page.waitForTimeout(80)}
  await page.mouse.up();await page.waitForTimeout(150)
}
async function physical(page,id,step){
  if(id==='mongolian-felt-ger')await drag(page)
  else if(craftDeltas[id]?.[step]){
    const p=pointers.get(page),from=await point(page,'source',id==='chinese-diabolo'&&step===2?1:0),[dx,dy]=craftDeltas[id][step]
    await p.down(from);await p.move([from[0]+dx,from[1]+dy],18);await p.up()
    if(id==='korean-yutnori'&&step===2)await page.locator('.scene-yut-finish').click()
  }
  else if(id==='polish-paper-cut'&&step<2){
    const p=pointers.get(page),from=await point(page)
    const to=step===0?[from[0],from[1]-64]:[from[0]-72,from[1]]
    await p.down(from);await p.move(to,18);await p.up()
  }
  else if(id==='uzbek-clay-bowl'&&step<2){
    const p=pointers.get(page),from=await point(page)
    const to=step===0?[from[0]+70,from[1]]:[from[0],from[1]-70]
    await p.down(from);await p.move(to,18);await p.up()
  }
  else if(id==='chinese-woodblock-print'&&step<2){
    const p=pointers.get(page),from=await point(page)
    if(step===0){
      const center=await point(page,'target'),sweep=Math.abs(center[0]-from[0])*.37
      await p.down(from);await p.move(center,18)
      // Sweep the held rubbing pad across the real paper surface, not a drop.
      for(const dx of [-sweep,sweep,-sweep,sweep,0])await p.move([center[0]+dx,center[1]],12)
    }else{
      await p.down(from);await p.move([from[0],from[1]-65],18)
    }
    await p.up()
  }
  else if(id==='czech-bead-star'&&step===1){
    const p=pointers.get(page),from=await point(page)
    await p.down(from);await p.move([from[0]+80,from[1]],18);await p.up()
  }
  else if(id==='navruz-sumalak'&&step===0)await arc(page)
  else if(id==='hongsheng-red-string'&&step===0)await arc(page,12)
  else if((id==='minangkabau-spinning-top'&&step===1)||(id==='omamori-cycle'&&step===0)||(id==='shrine-suzu-bell'&&step>0)||
    (id==='floating-lantern-loy-krathong'&&step===1)||(step===2&&!['omikuji','navruz-sumalak','floating-lantern-loy-krathong'].includes(id)))await tap(page)
  else for(let i=0;i<(id==='st-brigids-cross'&&step===0?4:1);i++)await drag(page)
}
async function wrongCraftGesture(page,id,step){
  if(craftDeltas[id]?.[step]){
    const input=pointers.get(page),[dx,dy]=craftDeltas[id][step]
    const kinds=['tap','reverse','short','backtrack','partial-return','reverse-first','cancel']
    if(["alasita-miniature-house", "hiiragi-iwashi", "tamagushi-offering", "tibetan-water-bowls", "kagami-biraki-sake", "tibetan-prayer-flags", "rosh-hashanah-apple-honey", "thai-songkran-elders", "kameido-usokae", "persian-esfand", "mochigase-nagashibina", "greek-vasilopita", "tibetan-khata-greeting", "shichigosan-chitose-ame", "mongolian-ovoo", "fgs-buddha-bathing", "balinese-canang-sari", "bulgarian-survakane", "setsubun-mamemaki", "sternsinger-house-blessing", "lam-tsuen-wishing-tree", "kagami-mochi-offering", "romanian-martisor", "sumiyoshi-godairiki", "polish-oplatek-sharing", "greek-new-year-pomegranate", "bonfim-ribbon", "chinowa-kuguri", "zeniarai-coin-washing", "udo-undama", "japanese-daruma-otoshi", "paper-pinwheel", "chinese-steelyard", "garden-croquet", "welsh-drop-spindle", "scottish-plunge-churn", "irish-bodhran", "french-coffee-mill", "japanese-wagasa", "spanish-castanets", "japanese-shishi-odoshi", "german-jumping-jack", "finnish-kantele", "estonian-village-swing", "french-petanque", "english-hearth-bellows", "mexican-metate", "czech-wooden-ratchet", "puerto-rican-guiro", "valencian-folding-fan", "mexican-tortilla-press", "ghanaian-oware", "chinese-rattle-drum", "chinese-tangram", "chinese-diabolo", "korean-yutnori", "russian-matryoshka", "japanese-koinobori", "japanese-kendama", "indian-charkha", "german-nutcracker", "mexican-molinillo", "malawi-sansi", "chinese-suanpan", "mongolian-felt-ger", "peruvian-engraved-gourd", "venetian-glass-bead", "yusheng-lohei"].includes(id))kinds.push('zigzag')
    if(["kitano-nadeushi", "hiiragi-iwashi", "tamagushi-offering", "tibetan-water-bowls", "kagami-biraki-sake", "tibetan-prayer-flags", "rosh-hashanah-apple-honey", "thai-songkran-elders", "kameido-usokae", "persian-esfand", "mochigase-nagashibina", "greek-vasilopita", "tibetan-khata-greeting", "shichigosan-chitose-ame", "mongolian-ovoo", "fgs-buddha-bathing", "balinese-canang-sari", "bulgarian-survakane", "setsubun-mamemaki", "sternsinger-house-blessing", "lam-tsuen-wishing-tree", "kagami-mochi-offering", "romanian-martisor", "sumiyoshi-godairiki", "polish-oplatek-sharing", "greek-new-year-pomegranate", "bonfim-ribbon", "chinowa-kuguri", "zeniarai-coin-washing", "udo-undama", "japanese-daruma-otoshi", "paper-pinwheel", "chinese-steelyard", "garden-croquet", "welsh-drop-spindle", "scottish-plunge-churn", "irish-bodhran", "french-coffee-mill", "japanese-wagasa", "spanish-castanets", "japanese-shishi-odoshi", "german-jumping-jack", "finnish-kantele", "estonian-village-swing", "french-petanque", "english-hearth-bellows", "mexican-metate", "czech-wooden-ratchet", "puerto-rican-guiro", "valencian-folding-fan", "mexican-tortilla-press", "ghanaian-oware", "chinese-rattle-drum", "chinese-tangram", "chinese-diabolo", "korean-yutnori", "russian-matryoshka", "japanese-koinobori", "japanese-kendama", "indian-charkha", "german-nutcracker", "mexican-molinillo", "malawi-sansi", "chinese-suanpan", "mongolian-felt-ger", "peruvian-engraved-gourd", "venetian-glass-bead"].includes(id))kinds.push('zigzag')
    if(["lao-baci-wrist", "hiiragi-iwashi", "tamagushi-offering", "tibetan-water-bowls", "kagami-biraki-sake", "tibetan-prayer-flags", "rosh-hashanah-apple-honey", "thai-songkran-elders", "kameido-usokae", "persian-esfand", "mochigase-nagashibina", "greek-vasilopita", "tibetan-khata-greeting", "shichigosan-chitose-ame", "mongolian-ovoo", "fgs-buddha-bathing", "balinese-canang-sari", "bulgarian-survakane", "setsubun-mamemaki", "sternsinger-house-blessing", "lam-tsuen-wishing-tree", "kagami-mochi-offering", "romanian-martisor", "sumiyoshi-godairiki", "polish-oplatek-sharing", "greek-new-year-pomegranate", "bonfim-ribbon", "chinowa-kuguri", "zeniarai-coin-washing", "udo-undama", "japanese-daruma-otoshi", "paper-pinwheel", "chinese-steelyard", "garden-croquet", "welsh-drop-spindle", "scottish-plunge-churn", "irish-bodhran", "french-coffee-mill", "japanese-wagasa", "spanish-castanets", "japanese-shishi-odoshi", "german-jumping-jack", "finnish-kantele", "estonian-village-swing", "french-petanque", "english-hearth-bellows", "mexican-metate", "czech-wooden-ratchet", "puerto-rican-guiro", "valencian-folding-fan", "mexican-tortilla-press", "ghanaian-oware", "chinese-rattle-drum", "chinese-tangram", "chinese-diabolo", "korean-yutnori", "russian-matryoshka", "japanese-koinobori", "japanese-kendama", "indian-charkha", "german-nutcracker", "mexican-molinillo", "malawi-sansi", "chinese-suanpan", "mongolian-felt-ger", "peruvian-engraved-gourd", "venetian-glass-bead"].includes(id))kinds.push('zigzag')
    if(["finnish-virpominen", "hiiragi-iwashi", "tamagushi-offering", "tibetan-water-bowls", "kagami-biraki-sake", "tibetan-prayer-flags", "rosh-hashanah-apple-honey", "thai-songkran-elders", "kameido-usokae", "persian-esfand", "mochigase-nagashibina", "greek-vasilopita", "tibetan-khata-greeting", "shichigosan-chitose-ame", "mongolian-ovoo", "fgs-buddha-bathing", "balinese-canang-sari", "bulgarian-survakane", "setsubun-mamemaki", "sternsinger-house-blessing", "lam-tsuen-wishing-tree", "kagami-mochi-offering", "romanian-martisor", "sumiyoshi-godairiki", "polish-oplatek-sharing", "greek-new-year-pomegranate", "bonfim-ribbon", "chinowa-kuguri", "zeniarai-coin-washing", "udo-undama", "japanese-daruma-otoshi", "paper-pinwheel", "chinese-steelyard", "garden-croquet", "welsh-drop-spindle", "scottish-plunge-churn", "irish-bodhran", "french-coffee-mill", "japanese-wagasa", "spanish-castanets", "japanese-shishi-odoshi", "german-jumping-jack", "finnish-kantele", "estonian-village-swing", "french-petanque", "english-hearth-bellows", "mexican-metate", "czech-wooden-ratchet", "puerto-rican-guiro", "valencian-folding-fan", "mexican-tortilla-press", "ghanaian-oware", "chinese-rattle-drum", "chinese-tangram", "chinese-diabolo", "korean-yutnori", "russian-matryoshka", "japanese-koinobori", "japanese-kendama", "indian-charkha", "german-nutcracker", "mexican-molinillo", "malawi-sansi", "chinese-suanpan", "mongolian-felt-ger", "peruvian-engraved-gourd", "venetian-glass-bead"].includes(id))kinds.push('zigzag')
    for(const kind of kinds){
      const from=await point(page,'source',id==='chinese-diabolo'&&step===2?1:0)
      await input.down(from)
      if(kind==='reverse')await input.move([from[0]-dx*.7,from[1]-dy*.7])
      if(kind==='short')await input.move([from[0]+dx*.15,from[1]+dy*.15])
      if(kind==='backtrack'){await input.move([from[0]+dx,from[1]+dy]);await input.move(from)}
      if(kind==='partial-return'){await input.move([from[0]+dx*1.25,from[1]+dy*1.25]);await input.move([from[0]+dx*.7,from[1]+dy*.7])}
      if(kind==='reverse-first'){await input.move([from[0]-dx*.65,from[1]-dy*.65]);await input.move([from[0]+dx,from[1]+dy])}
      if(kind==='zigzag')for(const [along,cross] of [[12,16],[24,-16],[36,16],[48,-16],[60,0]]){
        await input.move([from[0]+(dx*along-dy*cross)/60,from[1]+(dy*along+dx*cross)/60])
      }
      if(kind==='cancel'){await input.move([from[0]+dx*.4,from[1]+dy*.4]);await input.cancel()}
      else await input.up()
      assert.equal(await page.locator('.scene-bow-tap').isEnabled(),true,`${id}: ${kind} started an accepted transition`)
      assert.equal((await saved(page)).sceneRecords.find(r=>r.id===id)?.progress??0,step,`${id}: ${kind} advanced`)
      await page.locator('.scene-bow-tap:enabled').waitFor()
    }
    return
  }
  if(!['chinese-woodblock-print','czech-bead-star','polish-paper-cut','uzbek-clay-bowl'].includes(id)||step===2)return
  const input=pointers.get(page),from=await point(page)
  await input.down(from);await input.up()
  assert.equal((await saved(page)).sceneRecords.find(r=>r.id===id)?.progress??0,step,'a tap must not substitute a craft gesture')
  if(step===1||id==='uzbek-clay-bowl'||id==='polish-paper-cut'){
    const wrong=id==='uzbek-clay-bowl'?(step===0?[from[0]-65,from[1]]:[from[0],from[1]+50]):
      id==='polish-paper-cut'?(step===0?[from[0],from[1]+50]:[from[0]+65,from[1]]):id==='chinese-woodblock-print'?[from[0],from[1]+35]:[from[0]-65,from[1]]
    await input.down(from);await input.move(wrong);await input.up()
    assert.equal((await saved(page)).sceneRecords.find(r=>r.id===id)?.progress??0,step,'reverse gesture advanced')
    await page.locator('.scene-bow-tap:enabled').waitFor()
    const fresh=await point(page)
    await input.down(fresh);await input.move([fresh[0]+15,fresh[1]-10]);await input.cancel()
    assert.equal((await saved(page)).sceneRecords.find(r=>r.id===id)?.progress??0,step,'cancel advanced')
    await page.locator('.scene-bow-tap:enabled').waitFor()
  }
}
for(const width of process.env.WBR_RETURN_ONLY?[]:widths)for(const id of ids){
  const page=await pageAt(width);await catalog(page);await open(page,id)
  const from=await point(page),box=await page.locator('canvas').boundingBox(),wrong=[box.x+3,box.y+3]
  const input=pointers.get(page)
  await input.down(wrong);await input.move(from);await input.up()
  await input.down(from);await input.move(wrong);await input.up()
  await input.down(from);await input.cancel()
  assert.equal(await page.locator('.scene-bow-tap').isEnabled(),true,`${id}: wrong-start or corner drag started an accepted transition`)
  assert.equal((await saved(page)).sceneRecords.find(r=>r.id===id)?.progress??0,0)
  await shot(page,id,`${width}-object-0`)
  for(let step=0;step<3;step++){
    await wrongCraftGesture(page,id,step)
    assert.equal(await page.locator('.scene-wish-slot input').count(),0,'writing must be deferred until the ritual is complete')
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
await writeFile(path.join(out,process.env.WBR_RETURN_ONLY?'return-report.json':'report.json'),JSON.stringify({results,errors,external,captures,input:touchMode?'native-touch':'mouse',motion:process.env.WBR_MOTION==='1'?'normal':'reduced'},null,2))
console.log(JSON.stringify({captures,flows:results.filter(r=>r.checkpoints).length,directCueFlows:results.filter(r=>r.directCueFlow).length,returning:results.filter(r=>r.returning).length,errors,external,out}))
