import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium} from 'playwright'
import {scenePointer} from './browser-scene-pointer.mjs'

const base=process.env.WBR_URL||'http://127.0.0.1:5173'
const out='artifacts/mongolian-felt-ger/drop',results=[]
await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true})
try {
  for(const [width,touch] of [[390,false],[320,true],[1280,false]]) {
    const page=await browser.newPage({viewport:{width,height:1000},hasTouch:touch}),errors=[]
    page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(20000)
    await page.goto(`${base}/scene-review?scene=mongolian-felt-ger`)
    await page.locator('.library-scene-stage[data-ready="true"]').waitFor()
    if(await page.getByRole('button',{name:'音效',exact:true}).getAttribute('aria-pressed')==='true') await page.getByRole('button',{name:'音效',exact:true}).click()
    const input=await scenePointer(page,touch),done=()=>page.locator('.scene-step-dot[data-state="done"]').count()
    const point=async role=>{
      await page.locator('.scene-hit-layer').scrollIntoViewIfNeeded()
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
      return page.locator(`[data-cue-role="${role}"]:not([hidden])`).evaluate(el=>{
        const rect=el.parentElement.getBoundingClientRect()
        return [rect.left+Number(el.dataset.x),rect.top+Number(el.dataset.y)]
      })
    }
    const snapshot=async phase=>{
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
      await page.screenshot({path:`${out}/${width}-${touch?'touch':'mouse'}-${phase}.png`,fullPage:true})
    }
    await snapshot('start')
    for(let step=0;step<3;step++) {
      const from=await point('source'),target=await point('target')
      const rect=await page.locator('.scene-hit-layer').boundingBox(),miss=[rect.x+7,rect.y+rect.height-7]
      await input.down(from);await input.move(miss);await input.up()
      assert.equal(await done(),step,'dropping away from the assembly does not advance')
      const source=await point('source'),to=await point('target')
      await input.down(source)
      // Deliberately indirect path: acceptance depends on the final placement.
      await input.move([Math.max(rect.x+10,source[0]-25),source[1]+15])
      await input.move(to)
      assert.equal(await done(),step,'holding a correct drop does not commit before release')
      assert.ok((await page.locator('.scene-hint').innerText()).includes('松手'))
      await page.waitForFunction(()=>document.querySelector('.scene-cue-guide')?.textContent.includes('已'))
      if(width===390)await snapshot(`step-${step}-held`)
      await input.up()
      await page.waitForFunction(n=>document.querySelectorAll('.scene-step-dot[data-state="done"]').length===n,step+1)
      await snapshot(`step-${step+1}`)
      assert.ok(target.every(Number.isFinite))
    }
    await page.locator('.scene-completion-actions').waitFor()
    assert.deepEqual(errors,[])
    results.push({width,input:touch?'touch':'mouse',completed:true,missesRejected:3,waitsForRelease:true,errors})
    await writeFile(`${out}/browser.json`,JSON.stringify(results,null,2))
    console.log(JSON.stringify(results.at(-1)))
    await page.close()
  }
} finally {await browser.close()}
