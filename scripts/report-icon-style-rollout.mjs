import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import sharp from 'sharp';
const root = 'artifacts/icon-style-rollout';
const report = JSON.parse(await readFile(`${root}/after/objects-390/report.json`, 'utf8'));
const entries = report.results;
const escape = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const cards = entries.map(entry => `<article data-search="${escape(entry.id + ' ' + entry.title + ' ' + Object.keys(entry.kinds ?? {}).join(' '))}" data-visible="${entry.visible}"><div class="title"><img src="../../assets/scene-icons/soft3d/${entry.id}.webp" alt=""/><div><h2>${escape(entry.title)}</h2><small>${escape(entry.id)}</small></div></div><div class="pair"><figure><img loading="lazy" src="before/objects-390/${entry.id}.png" alt="调整前"/><figcaption>调整前</figcaption></figure><figure><img loading="lazy" src="after/objects-390/${entry.id}.png" alt="调整后"/><figcaption>调整后</figcaption></figure></div></article>`).join('');
await writeFile(`${root}/index.html`, `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>小物 · 图标风格前后对照</title><style>*{box-sizing:border-box}body{margin:0;background:#f6f2e9;color:#514335;font:15px/1.6 system-ui,sans-serif}main{max-width:1460px;margin:auto;padding:36px 24px}h1{font-size:30px;font-weight:600;margin:0 0 10px}header p{color:#8c7d6a}header{margin-bottom:24px}.controls{display:flex;gap:10px;flex-wrap:wrap;margin:20px 0}input,select{font:inherit;border:1px solid #d7cebd;border-radius:10px;padding:9px 12px;background:#fffdf8;color:#655a47}input{min-width:200px;flex:1}#count{font-size:13px;color:#8c7d6a}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}article{background:#fffdf8;border:1px solid #e4dacb;border-radius:18px;overflow:hidden}.title{display:flex;align-items:center;gap:12px;padding:12px 16px}.title img{width:60px;height:60px;object-fit:contain}h2{margin:0;font-size:17px;font-weight:500}small{font-size:11px;color:#988a78}.pair{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#e8dfd0}figure{margin:0;background:#f5eddf}figure img{width:100%;display:block;cursor:zoom-in}figcaption{text-align:center;font-size:12px;color:#8d7f6b;padding:7px}article[hidden]{display:none}dialog{border:1px solid #ded3c1;border-radius:20px;padding:20px;width:min(1000px,95vw);background:#fffdf8}dialog::backdrop{background:#493d32aa}dialog .pair{background:#f5eddf}dialog .pair img{width:100%}dialog button{float:right;border:0;border-radius:20px;background:#e8eee0;padding:8px 18px;cursor:pointer}footer{font-size:12px;color:#948674;padding-top:28px}@media(max-width:1000px){.grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:640px){main{padding:24px 14px}.grid{grid-template-columns:1fr}h1{font-size:24px}}</style></head><body><main><header><h1>让小物更接近图标里的感觉</h1><p>连续明暗、柔和反光与轻微配色校准。原有材料、图案和互动仍各有区别。</p><div class="controls"><input id="search" placeholder="搜索小物或材料" aria-label="搜索小物"><select id="scope" aria-label="查看范围"><option value="true">当前目录</option><option value="all">全部小物</option><option value="false">历史小物</option></select></div><div id="count"></div></header><div class="grid">${cards}</div><footer>真实场景同视角截图 · 图标仅作产品美术参照 · 当前目录 ${entries.filter(entry=>entry.visible).length} 件，历史保留 ${entries.filter(entry=>!entry.visible).length} 件</footer></main><dialog><button type="button">关闭</button><h2></h2><div class="pair"></div></dialog><script>const cards=[...document.querySelectorAll('article')],search=document.querySelector('#search'),scope=document.querySelector('#scope'),count=document.querySelector('#count'),dialog=document.querySelector('dialog');function filter(){let n=0;for(const card of cards){card.hidden=!(scope.value==='all'||card.dataset.visible===scope.value)||!card.dataset.search.toLowerCase().includes(search.value.toLowerCase());if(!card.hidden)n++}count.textContent='显示 '+n+' 件小物'}search.oninput=scope.onchange=filter;filter();for(const card of cards)for(const image of card.querySelectorAll('figure img'))image.onclick=()=>{dialog.querySelector('h2').textContent=card.querySelector('h2').textContent;dialog.querySelector('.pair').innerHTML=card.querySelector('.pair').innerHTML;dialog.showModal()};dialog.querySelector('button').onclick=()=>dialog.close();</script></body></html>`);
const visible = entries.filter(entry => entry.visible);
await mkdir(`${root}/sheets`, { recursive: true });
for (let start = 0; start < visible.length; start += 18) {
  const tiles = [];
  for (const [index, entry] of visible.slice(start,start+18).entries()) {
    const x = index % 3 * 440, y = Math.floor(index / 3) * 225;
    for (const [column, phase] of ['before','after'].entries()) tiles.push({ input: await sharp(`${root}/${phase}/objects-390/${entry.id}.png`).resize(210,195,{fit:'contain',background:'#f5eddf'}).png().toBuffer(),left:x+column*220,top:y+30 });
    tiles.push({ input:Buffer.from(`<svg width="440" height="30"><text x="6" y="20" font-size="13" fill="#655645">${escape(entry.id)} / BEFORE → AFTER</text></svg>`),left:x,top:y });
  }
  await sharp({create:{width:1320,height:1350,channels:3,background:'#f5eddf'}}).composite(tiles).png().toFile(`${root}/sheets/visible-${Math.floor(start/18)+1}.png`);
}
const representatives=['woodfish','omamori-cycle','shrine-suzu-bell','furin-wind-chime','barcelos-clay-rooster','venetian-glass-bead','crane','purepecha-copper-bowl'];
const tiles=[];
for(const [index,id] of representatives.entries()){
  const x=index%2*600,y=Math.floor(index/2)*280;
  tiles.push({input:await sharp(`assets/scene-icons/soft3d/${id}.webp`).resize(100,100).png().toBuffer(),left:x+5,top:y+80});
  for(const [column,phase] of ['before','after'].entries()){
    const file=`${root}/${phase}/objects-390/${id}.png`;
    if(existsSync(file))tiles.push({input:await sharp(file).resize(240,240).png().toBuffer(),left:x+110+column*245,top:y+30});
  }
  tiles.push({input:Buffer.from(`<svg width="600" height="30"><text x="8" y="20" font-size="13" fill="#655645">${id} / ICON · BEFORE · AFTER</text></svg>`),left:x,top:y});
}
await sharp({create:{width:1200,height:1120,channels:3,background:'#f5eddf'}}).composite(tiles).png().toFile(`${root}/representatives.png`);
console.log(`Gallery and review sheets: ${entries.length} actual scenes.`);
