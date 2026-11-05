import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const bundled=chromium.executablePath(),fallback=bundled.replace(/AppData[/\\]Local[/\\]Packages[/\\][^/\\]+[/\\]AC[/\\]/,'AppData/Local/');
const browser=await chromium.launch({headless:true,executablePath:existsSync(bundled)?bundled:fallback});
try{
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(pathToFileURL(path.resolve('artifacts/icon-style-rollout/index.html')).href);
  if(await page.locator('#count').textContent()!=='显示 91 件小物')throw Error('Current scene count');
  await page.locator('#search').fill('木鱼');if(await page.locator('article:not([hidden])').count()!==1)throw Error('Search');
  await page.locator('article:not([hidden]) figure img').first().click();
  if(!await page.locator('dialog').evaluate(dialog=>dialog.open))throw Error('Image enlargement');
  await page.waitForFunction(()=>[...document.querySelectorAll('dialog img')].every(image=>image.complete&&image.naturalWidth>0));
  await page.getByRole('button',{name:'关闭',exact:true}).click();await page.locator('#search').fill('');
  await page.locator('#scope').selectOption('all');if(await page.locator('article:not([hidden])').count()!==158)throw Error('All scene count');
  await page.locator('#scope').selectOption('false');if(await page.locator('article:not([hidden])').count()!==67)throw Error('Retained scene count');
  await page.setViewportSize({width:320,height:900});await page.locator('#scope').selectOption('true');
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile overflow');
  await page.screenshot({path:'artifacts/icon-style-rollout/gallery-320.png'});
  if(errors.length)throw Error(errors.join('\n'));
  console.log('Gallery: 91/158/67 filters, search, image enlargement and 320px layout passed.');
}finally{await browser.close()}
