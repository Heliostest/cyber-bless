import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium} from 'playwright'

const out='artifacts/scene-completion-layout',results=[]
await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true})
try {
  for(const [id,keepWish] of [['omikuji',false],['crane',true]]) {
    const page=await browser.newPage({viewport:{width:390,height:1000}}),errors=[]
    page.on('pageerror',error=>errors.push(error.message))
    await page.addInitScript(()=>localStorage.setItem('cyber-bless:personal:v1',JSON.stringify({version:1,sceneRecords:[],wishes:[],activeSession:null,sessions:[],collectibles:[],ledger:[],settings:{sound:false,haptics:false,reducedMotion:true}})))
    await page.goto(process.env.WBR_URL||'http://127.0.0.1:5173')
    await page.getByRole('button',{name:'我的',exact:true}).click()
    await page.getByRole('button',{name:'场景目录',exact:true}).click()
    while(!await page.locator(`.scene-card[data-scene="${id}"]`).count())await page.getByRole('button',{name:'显示更多',exact:true}).click()
    await page.locator(`.scene-card[data-scene="${id}"]`).click()
    await page.locator('.library-scene-stage[data-ready="true"]').waitFor()
    assert.equal(await page.locator('.ritual-narrative summary').innerText(),'了解这个仪式')
    const finish=async()=>{
    for(let action=0;action<18;action++) {
      await page.waitForFunction(()=>document.querySelector('.scene-done-row')||document.querySelector('.scene-bow-tap:not(:disabled)'))
      if(await page.locator('.scene-done-row').count())break
      await page.locator('.scene-bow-tap').press('Enter')
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
    }
    }
    await finish()
    if(!await page.locator('.scene-done-row--inline').count()) {
      // A daily primary's first walk collects a keepsake; the repeated walk
      // exercises the shared ordinary completion row after that collection.
      await page.getByRole('button',{name:'返回',exact:true}).click()
      await page.locator(`.scene-card[data-scene="${id}"]`).click()
      await page.locator('.library-scene-stage[data-ready="true"]').waitFor()
      await finish()
    }
    await page.locator('.scene-done-row--inline').waitFor()
    if(keepWish) {
      await page.locator('.scene-wish-invite').click()
      await page.locator('.scene-post-wish input').fill('愿世界和平')
      await page.locator('.scene-post-wish button[type="submit"]').click()
      assert.ok((await page.locator('.scene-completion-actions').innerText()).includes('去心愿看看'))
    }
    for(const width of [390,320,284,1280]) {
      await page.setViewportSize({width,height:1000})
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
      const metrics=await page.locator('.scene-done-row--inline').evaluate(row=>{
        const status=row.querySelector('.scene-done'),actions=row.querySelector('.scene-completion-actions'),buttons=[...actions.querySelectorAll('button')]
        const box=el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,height:r.height,width:r.width,center:r.y+r.height/2}}
        return{status:box(status),actions:box(actions),buttons:buttons.map(box),align:getComputedStyle(status).textAlign,lines:status.getBoundingClientRect().height/parseFloat(getComputedStyle(status).lineHeight),overflow:document.documentElement.scrollWidth>innerWidth}
      })
      assert.equal(metrics.align,'right')
      assert.ok(Math.abs(metrics.status.center-metrics.actions.center)<1,'status and actions share a row')
      assert.ok(metrics.status.x>=metrics.actions.right+5,'status sits on the right of both actions')
      assert.ok(metrics.lines<1.05,'status stays on one line')
      assert.equal(metrics.buttons.length,2)
      assert.ok(Math.abs(metrics.buttons[0].y-metrics.buttons[1].y)<1)
      assert.ok(metrics.buttons.every(b=>b.height>=44&&b.width>=44))
      assert.equal(metrics.overflow,false)
      assert.deepEqual(errors,[])
      await page.screenshot({path:`${out}/${id}-${width}.png`,fullPage:true})
      results.push({id,width,keepWish,metrics})
      console.log(JSON.stringify({id,width,aligned:true}))
    }
    await page.close()
  }
  await writeFile(`${out}/browser.json`,JSON.stringify(results,null,2))
} finally {await browser.close()}
