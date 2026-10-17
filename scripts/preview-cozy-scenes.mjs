import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const base = process.env.WBR_URL || "http://127.0.0.1:5177/";
const auditStyles = process.env.WBR_STYLE_AUDIT === "1", styles = [];
const out = path.resolve("artifacts/cozy-scenes", process.argv[2] || "after");
await mkdir(out, { recursive: true });
const ids = ['mexican-tortilla-press','ghanaian-oware','chinese-rattle-drum','chinese-tangram','chinese-diabolo','korean-yutnori','russian-matryoshka', 'japanese-koinobori', 'japanese-kendama', 'indian-charkha', 'german-nutcracker', 'mexican-molinillo', 'malawi-sansi', 'chinese-suanpan', 'mongolian-felt-ger', 'peruvian-engraved-gourd', 'venetian-glass-bead', 'korean-bojagi-wrap', 'vietnamese-bamboo-dragonfly', 'turkish-ebru-paper', 'indonesian-angklung', 'weifang-paper-kite', 'chinese-shadow-puppet', 'faroese-wool-knit', 'niue-shell-necklace','polish-paper-cut', 'uzbek-clay-bowl','chinese-woodblock-print', 'czech-bead-star','fijian-woven-fan', 'amazigh-woven-rug','slovak-wire-bird', 'hungarian-embroidery-hoop', 'andalusian-ceramic-tile', 'sicilian-painted-cart','bai-indigo-cloth', 'ndebele-painted-house', 'purepecha-copper-bowl', 'welsh-love-spoon','barcelos-clay-rooster','finnish-birch-basket','croatian-licitar-heart','catalan-festival-giant','sorbian-painted-egg','basque-sunflower','breton-banner','lithuanian-straw-garden','dalarna-wooden-horse','aland-votive-ship','blang-tea','minangkabau-spinning-top','chinese-incense','hongsheng-red-string','italian-ex-voto','czech-pilgrim-journal',"omikuji", "polish-blessing-basket", "navruz-sumalak", "floating-lantern-loy-krathong", "omamori-cycle", "shrine-suzu-bell", "st-brigids-cross", "bokjori", "woodfish", "celtic-folk-spring", "theravada-water", "furin-wind-chime",
  "daruma-eye-painting", "mizuhiki", "milagros", "phuang-malai",
  "ema-votive-plaque", "clootie-well-rag", "diya-oil-lamp", "votive-candle-catholic",
  "shinto-torii", "tibetan-wheel", "tanzaku-tanabata", "crane", "slavic-wreath", "lantern", "yeondeunghoe"];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await page.addInitScript(() => {
  window.environmentAudit = { live: 0, contexts: 0, released: 0 };
  const owned = new WeakMap(), seen = new WeakSet();
  const resources = context => {
    if (!owned.has(context)) owned.set(context, new Set());
    return owned.get(context);
  };
  for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
    for (const kind of ["Buffer", "Texture", "Framebuffer", "Renderbuffer", "Program", "Shader"]) {
      const create = proto[`create${kind}`], remove = proto[`delete${kind}`];
      if (!create || !remove) continue;
      proto[`create${kind}`] = function (...args) {
        const value = create.apply(this, args);
        if (value) { resources(this).add(value); window.environmentAudit.live++; }
        return value;
      };
      proto[`delete${kind}`] = function (value) {
        if (resources(this).delete(value)) window.environmentAudit.live--;
        return remove.call(this, value);
      };
    }
  }
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...args) {
    const context = getContext.call(this, type, ...args);
    if (context && type.startsWith("webgl") && !seen.has(context)) {
      seen.add(context); window.environmentAudit.contexts++;
      this.addEventListener("webglcontextlost", () => {
        window.environmentAudit.live -= resources(context).size;
        resources(context).clear(); window.environmentAudit.released++;
      });
    }
    return context;
  };
});
const errors = [];
const external = [];
page.on("pageerror", error => errors.push(error.message));
page.on("request", request => {
  if (!request.url().startsWith(base.replace(/\/$/, "")) && !request.url().startsWith("data:") && !request.url().startsWith(`blob:${new URL(base).origin}/`)) external.push(request.url());
});
const entry = new URL(base);
if (auditStyles) entry.searchParams.set("debug", "1");
await page.goto(entry.href);
await page.getByRole("button", { name: "我的", exact: true }).click();
await page.getByRole("button", { name: "场景目录", exact: true }).click();
for (const id of ids) {
  while (!await page.locator(`.scene-card[data-scene="${id}"]`).count()) await page.getByRole('button', { name: '显示更多', exact: true }).click();
  await page.locator(`.scene-card[data-scene="${id}"]`).click();
  await page.locator("canvas").first().waitFor();
  if (process.argv[2] !== "before") {
    await page.locator('canvas[data-environment-ready="true"]').waitFor({ timeout: 30000 });
    if (id === "woodfish") await page.locator('.woodfish-visual[data-renderer="ready"]').waitFor({ timeout: 30000 });
  }
  await page.waitForTimeout(700);
  if (auditStyles) {
    const toggle = page.getByRole('button', { name: 'SHADER LAB' });
    if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
    const selected = await page.locator('.debug-overlay-presets [aria-pressed="true"] strong').innerText();
    const actual = await page.locator('#debug-overlay-panel [role="status"]').innerText();
    styles.push({ id, selected, actual });
    if (!actual.startsWith(`正在使用${selected}`)) errors.push(`${id}: ${actual}`);
  }
  await page.screenshot({ path: path.join(out, `${id}.png`), fullPage: true,
    ...(auditStyles ? { style: '.debug-overlay { visibility: hidden !important; }' } : {}) });
  await page.getByRole("button", { name: "返回", exact: true }).click();
  if (process.argv[2] !== "before") {
    await page.waitForFunction(() => window.environmentAudit.live === 0);
  }
}
await page.setViewportSize({ width: 1280, height: 900 });
while (!await page.locator('.scene-card[data-scene="shinto-torii"]').count()) await page.getByRole('button', { name: '显示更多', exact: true }).click();
await page.locator('.scene-card[data-scene="shinto-torii"]').click();
await page.waitForTimeout(1000);
await page.screenshot({ path: path.join(out, "desktop.png"), fullPage: true });
await page.getByRole("button", { name: "返回", exact: true }).click();
await page.waitForFunction(() => window.environmentAudit.live === 0);
const gpu = await page.evaluate(() => window.environmentAudit);
await writeFile(path.join(out, "report.json"), JSON.stringify({ scenes: ids.length, errors, external, gpu, ...(auditStyles ? { styles } : {}) }, null, 2));
console.log(JSON.stringify({ scenes: ids.length, errors, external, gpu, out }));
await browser.close();
if (errors.length || external.length) process.exitCode = 1;
