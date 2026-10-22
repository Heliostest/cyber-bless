// Exercise the actual App and host save, with no debug route or shader fixture.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
const base = process.env.WBR_URL ?? "http://127.0.0.1:5173";
const output = new URL("../artifacts/app-visual-style/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("visual-probe-seeded")) {
      localStorage.setItem("cyber-bless:personal:v1", JSON.stringify({ version: 1, wishes: [], sessions: [], activeSession: null,
        sceneRecords: [], ledger: [], settings: { sound: false, haptics: true, reducedMotion: true },
        collectibles: [
          { id: "probe-rooster", kind: "scene", title: "彩陶公鸡", sceneId: "barcelos-clay-rooster", wishScene: false, at: "2026-10-22T00:00:00Z" },
          { id: "probe-crane", kind: "scene", title: "纸鹤", sceneId: "crane", wishScene: false, at: "2026-10-22T00:00:00Z" },
        ] }));
      sessionStorage.setItem("visual-probe-seeded", "1");
    }
  });
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem("cyber-bless:personal:v1")));
  const frames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  async function open(id) {
    await page.locator('.bottom-nav button[data-tab="world"]').click();
    await page.locator(`.collection-card[data-collectible-id="probe-${id}"]`).click();
    await page.getByRole("button", { name: /回看这场仪式/ }).click();
    await page.locator('canvas[data-environment-ready="true"]').waitFor();
    await page.getByRole("button", { name: "视觉风格", exact: true }).waitFor();
    await page.evaluate(() => { window.__visualCanvas = document.querySelector('canvas[data-environment]'); });
  }
  const menu = () => page.getByRole("dialog", { name: "视觉风格", exact: true });
  await page.goto(base);
  await open("rooster");
  await page.screenshot({ path: new URL("entry-390.png", output).pathname.replace(/^\/([A-Za-z]:)/, "$1") });
  const hint = await page.locator(".scene-hint").innerText();
  await page.getByRole("button", { name: "视觉风格", exact: true }).click();
  assert.equal(await menu().locator('button[data-style="toon-soft"]').getAttribute("aria-pressed"), "true");
  const styles = ["original", "gouache", "moebius", "toon-outline", "halftone", "pixel-art", "toon-ink", "toon-soft"];
  for (const style of styles) {
    await menu().locator(`[data-style="${style}"]`).click(); await frames();
    assert.equal(await menu().locator(`[data-style="${style}"]`).getAttribute("aria-pressed"), "true");
    assert.ok(!(await menu().locator(".visual-style-status").innerText()).includes("无法"), `${style} fell back`);
    assert.equal(await page.evaluate(() => window.__visualCanvas === document.querySelector('canvas[data-environment]')), true, "style switching remounted the scene");
  }
  await menu().locator('[data-style="moebius"]').click();
  await menu().locator("summary").click();
  await menu().getByRole("slider", { name: "描边粗细", exact: true }).fill("2");
  await menu().getByRole("slider", { name: "色阶", exact: true }).fill("5");
  await menu().getByRole("slider", { name: "排线强度", exact: true }).fill("0.3");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("cyber-bless:personal:v1")).visualStyles?.["barcelos-clay-rooster"]?.parameters.hatchStrength === 0.3);
  assert.equal(await menu().count(), 0);
  assert.equal(await page.getByRole("button", { name: "视觉风格", exact: true }).evaluate(button => document.activeElement === button), true);
  assert.equal(await page.locator(".scene-hint").innerText(), hint, "opening/tuning advanced progress");
  await page.getByRole("button", { name: "视觉风格", exact: true }).click();
  await menu().locator("summary").click();
  await menu().getByRole("button", { name: "看画面", exact: true }).click();
  assert.equal(await page.evaluate(() => window.__visualCanvas === document.querySelector('canvas[data-environment]')), true);
  await page.screenshot({ path: new URL("preview-390.png", output).pathname.replace(/^\/([A-Za-z]:)/, "$1") });
  await menu().getByRole("button", { name: "继续调整", exact: true }).click();
  for (const [width, height] of [[320,568], [390,844], [844,390], [1280,900]]) {
    await page.setViewportSize({ width, height }); await frames();
    const box = await menu().boundingBox();
    assert.ok(box && box.x >= -1 && box.y >= -1 && box.x+box.width <= width+1 && box.y+box.height <= height+1, `menu escapes viewport ${width}x${height}`);
    await page.screenshot({ path: new URL(`menu-${width}x${height}.png`, output).pathname.replace(/^\/([A-Za-z]:)/, "$1") });
  }
  await menu().getByRole("button", { name: "完成", exact: true }).click();
  await page.getByRole("button", { name: "返回", exact: true }).click();
  await page.getByRole("button", { name: "返回", exact: true }).click();
  await open("crane");
  await page.getByRole("button", { name: "视觉风格", exact: true }).click();
  assert.equal(await menu().locator('[data-style="toon-soft"]').getAttribute("aria-pressed"), "true", "rooster setting affected crane");
  await menu().locator('[data-style="pixel-art"]').click(); await menu().locator("summary").click();
  await menu().getByRole("slider").fill("6");
  await menu().getByRole("button", { name: "完成", exact: true }).click();
  await page.reload(); await open("rooster");
  await page.getByRole("button", { name: "视觉风格", exact: true }).click();
  assert.equal(await menu().locator('[data-style="moebius"]').getAttribute("aria-pressed"), "true");
  await menu().locator("summary").click();
  assert.equal(await menu().getByRole("slider", { name: "排线强度", exact: true }).inputValue(), "0.3");
  assert.equal((await saved()).visualStyles.crane.parameters.pixelSize, 6);
  await page.context().setOffline(true);
  await menu().getByRole("button", { name: "恢复默认", exact: true }).click(); await frames();
  assert.equal(await menu().locator('[data-style="toon-soft"]').getAttribute("aria-pressed"), "true");
  await menu().getByRole("button", { name: "完成", exact: true }).click();
  const before = await page.locator(".scene-hint").innerText();
  await page.locator(".scene-bow-tap").click();
  await page.waitForFunction(text => document.querySelector(".scene-hint")?.textContent !== text, before);
  assert.equal((await saved()).visualStyles["barcelos-clay-rooster"], undefined);
  assert.deepEqual(errors, []);
  const report = { base, styles, default: "toon-soft", hostSave: "reload and per-ritual isolation passed", menu: "desktop, small phone and landscape passed",
    progress: "preserved; interaction resumes", offline: "passed", errors };
  await writeFile(new URL("report.json", output), JSON.stringify(report, null, 2));
  console.log(report);
} finally { await browser.close(); }
