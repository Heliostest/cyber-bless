// Exercise the actual App and host save, with no debug route or shader fixture.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
const base = process.env.WBR_URL ?? "http://127.0.0.1:5173";
const output = new URL("../artifacts/app-visual-style/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  channel: process.env.WBR_BROWSER || "msedge", headless: process.env.WBR_HEADED !== "1",
  args: ["--no-proxy-server", "--enable-unsafe-swiftshader"],
});
const checks = [], errors = [];
let page;
try {
  page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("visual-probe-seeded")) {
      localStorage.setItem("cyber-bless:personal:v1", JSON.stringify({ version: 1, wishes: [], sessions: [], activeSession: null,
        sceneRecords: [], ledger: [], settings: { sound: false, haptics: true, reducedMotion: true },
        collectibles: [
          { id: "probe-rooster", kind: "scene", title: "彩陶公鸡", sceneId: "barcelos-clay-rooster", wishScene: false, at: "2026-10-22T00:00:00Z" },
          { id: "probe-crane", kind: "scene", title: "纸鹤", sceneId: "crane", wishScene: false, at: "2026-10-22T00:00:00Z" },
          { id: "probe-woodfish", kind: "scene", title: "木鱼", sceneId: "woodfish", wishScene: false, at: "2026-10-22T00:00:00Z" },
        ] }));
      sessionStorage.setItem("visual-probe-seeded", "1");
    }
  });
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem("cyber-bless:personal:v1")));
  const visualState = state => ({ globalVisualStyle: state.globalVisualStyle, visualStyles: state.visualStyles ?? {} });
  const frames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const screenshot = name => page.screenshot({ path: fileURLToPath(new URL(name, output)) });
  async function setFeedbackMenu(open) {
    const gear = page.locator('button[aria-label="仪式设置"]');
    if (await gear.getAttribute("aria-expanded") !== String(open)) await gear.click();
    await gear.evaluate(async button => {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await Promise.all(button.closest(".feedback-controls").getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => {})));
      await new Promise(resolve => requestAnimationFrame(resolve));
    });
    if (!open) await page.locator(".feedback-controls-anchor[data-feedback-present]").waitFor({ state: "detached" });
  }
  async function openVisualStyle() {
    await setFeedbackMenu(true);
    await page.getByRole("button", { name: "视觉风格", exact: true }).click();
  }
  async function open(id) {
    await page.locator('.bottom-nav button[data-tab="world"]').click();
    await page.locator(`.collection-card[data-collectible-id="probe-${id}"]`).click();
    await page.getByRole("button", { name: /回看这场仪式/ }).click();
    await page.locator('canvas[data-environment-ready="true"]').waitFor();
    await page.locator('button[aria-label="仪式设置"]').waitFor();
    await page.evaluate(() => { window.__visualCanvas = document.querySelector('canvas[data-environment]'); });
  }
  const menu = () => page.getByRole("dialog", { name: "视觉风格", exact: true });
  const confirmation = () => page.getByRole("dialog", { name: "应用视觉风格", exact: true });
  async function sameCanvas() {
    assert.equal(await page.evaluate(() => window.__visualCanvas === document.querySelector('canvas[data-environment]')), true, "style changes preserve the scene canvas");
  }
  async function selected(style) {
    await menu().waitFor();
    assert.equal(await menu().locator(`[data-style="${style}"]`).getAttribute("aria-pressed"), "true");
    assert.ok(!(await menu().locator(".visual-style-status").innerText()).includes("无法"), `${style} fell back`);
    await sameCanvas();
  }
  async function requestChoice(locator) {
    const before = visualState(await saved());
    await locator.click(); await confirmation().waitFor(); await frames();
    assert.deepEqual(visualState(await saved()), before, "unconfirmed preview must not reach the host save");
    assert.equal(await confirmation().getByRole("button").count(), 3, "confirmation exposes both scopes and cancellation");
    await sameCanvas();
    return before;
  }
  async function confirm(scope = "current") {
    await confirmation().getByRole("button", { name: scope === "all" ? "应用到全部仪式" : "仅当前仪式", exact: true }).click();
    await menu().waitFor(); await frames();
  }
  async function choose(style, scope = "current") {
    await requestChoice(menu().locator(`[data-style="${style}"]`));
    await confirm(scope); await selected(style);
  }
  async function tune(open = true) {
    const details = menu().locator("details");
    if ((await details.getAttribute("open") !== null) !== open) await details.locator("summary").click();
  }
  async function closeVisualStyle() {
    await menu().getByRole("button", { name: "完成", exact: true }).click();
    await setFeedbackMenu(false);
  }
  async function leaveScene() {
    await page.getByRole("button", { name: "返回", exact: true }).click();
    await page.getByRole("button", { name: "返回", exact: true }).click();
  }
  await page.goto(base);
  await open("rooster");
  await screenshot("entry-390.png");
  const hint = await page.locator(".scene-hint").innerText();
  await openVisualStyle();
  assert.equal(await menu().locator('button[data-style="toon-soft"]').getAttribute("aria-pressed"), "true");
  const styles = ["original", "gouache", "moebius", "toon-outline", "halftone", "pixel-art", "toon-ink", "toon-soft"];
  for (const style of styles) await choose(style);
  checks.push("all eight styles preview without saving and apply only after explicit scope confirmation");
  await choose("moebius");
  await tune();
  await menu().getByRole("slider", { name: "描边粗细", exact: true }).fill("2");
  await menu().getByRole("slider", { name: "色阶", exact: true }).fill("5");
  await menu().getByRole("slider", { name: "排线强度", exact: true }).fill("0.3");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("cyber-bless:personal:v1")).visualStyles?.["barcelos-clay-rooster"]?.parameters.hatchStrength === 0.3);
  assert.equal(await menu().count(), 0);
  assert.equal(await page.getByRole("button", { name: "视觉风格", exact: true }).evaluate(button => document.activeElement === button), true);
  assert.equal(await page.locator(".scene-hint").innerText(), hint, "opening/tuning advanced progress");
  await openVisualStyle();
  await tune();
  await menu().getByRole("button", { name: "看画面", exact: true }).click();
  assert.equal(await page.evaluate(() => window.__visualCanvas === document.querySelector('canvas[data-environment]')), true);
  await screenshot("preview-390.png");
  await menu().getByRole("button", { name: "继续调整", exact: true }).click();
  await tune(false);
  for (const [width, height] of [[320,568], [390,844], [844,390], [1280,900]]) {
    await page.setViewportSize({ width, height }); await frames();
    const box = await menu().boundingBox();
    assert.ok(box && box.x >= -1 && box.y >= -1 && box.x+box.width <= width+1 && box.y+box.height <= height+1, `menu escapes viewport ${width}x${height}`);
    await screenshot(`menu-${width}x${height}.png`);
    const before = await requestChoice(menu().locator('[data-style="gouache"]'));
    const scopeBox = await confirmation().boundingBox();
    assert.ok(scopeBox && scopeBox.x >= -1 && scopeBox.y >= -1 && scopeBox.x+scopeBox.width <= width+1 && scopeBox.y+scopeBox.height <= height+1, `scope dialog escapes viewport ${width}x${height}`);
    for (const button of await confirmation().getByRole("button").all()) {
      await button.scrollIntoViewIfNeeded();
      const target = await button.evaluate(button => {
        const r = button.getBoundingClientRect(), hit = document.elementFromPoint(r.x+r.width/2, r.y+r.height/2);
        return { text: button.textContent, x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom, hit: hit === button || button.contains(hit) };
      });
      assert.ok(target.width >= 44 && target.height >= 44 && target.x >= -1 && target.y >= -1 && target.right <= width+1 && target.bottom <= height+1 && target.hit, `${target.text} must be reachable at ${width}x${height}`);
    }
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), "仅当前仪式", "confirmation starts focus on the current ritual");
    await page.keyboard.press("Shift+Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), "取消", "scope dialog traps backward Tab");
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), "仅当前仪式", "scope dialog traps forward Tab");
    await screenshot(`scope-${width}x${height}.png`);
    await confirmation().getByRole("button", { name: "取消", exact: true }).click();
    await selected("moebius");
    assert.deepEqual(visualState(await saved()), before, "cancel restores the existing preference without saving");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-style")), "gouache", "cancel returns focus to its style tile");
  }
  checks.push("editor and scope dialog fit small phone, phone, landscape and desktop; cancellation and focus trapping pass");
  await page.setViewportSize({ width: 390, height: 844 });
  await closeVisualStyle(); await leaveScene();
  await open("crane");
  await openVisualStyle();
  assert.equal(await menu().locator('[data-style="toon-soft"]').getAttribute("aria-pressed"), "true", "rooster setting affected crane");
  await choose("pixel-art"); await tune();
  await menu().getByRole("slider").fill("6");
  await closeVisualStyle();
  await page.reload(); await open("rooster");
  await openVisualStyle();
  assert.equal(await menu().locator('[data-style="moebius"]').getAttribute("aria-pressed"), "true");
  await tune();
  assert.equal(await menu().getByRole("slider", { name: "排线强度", exact: true }).inputValue(), "0.3");
  assert.equal((await saved()).visualStyles.crane.parameters.pixelSize, 6);
  checks.push("per-ritual choices and last slider values survive closing and refresh without changing progress");
  await tune(false);
  await choose("pixel-art", "all");
  await tune();
  await menu().getByRole("slider", { name: "像素大小", exact: true }).fill("5");
  await closeVisualStyle();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("cyber-bless:personal:v1")).globalVisualStyle?.parameters.pixelSize === 5);
  const globallySaved = await saved();
  assert.equal(globallySaved.globalVisualStyle.style, "pixel-art");
  assert.deepEqual(globallySaved.visualStyles, {}, "apply all replaces previously saved per-ritual choices");
  assert.equal(await page.locator(".scene-hint").innerText(), hint, "applying globally does not advance the active ritual");
  await leaveScene(); await open("woodfish");
  assert.equal((await saved()).visualStyles.woodfish, undefined, "the newly opened ritual has no local choice");
  await page.locator('canvas[data-environment]').screenshot({ path: fileURLToPath(new URL("woodfish-inherited-390.png", output)) });
  await openVisualStyle(); await selected("pixel-art"); await tune();
  assert.equal(await menu().getByRole("slider", { name: "像素大小", exact: true }).inputValue(), "5", "a ritual first opened after apply-all inherits global parameters");
  // Opening a fresh menu resets the edit scope, even when its initial choice is global.
  await menu().getByRole("slider", { name: "像素大小", exact: true }).fill("7");
  await closeVisualStyle();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("cyber-bless:personal:v1")).visualStyles?.woodfish?.parameters.pixelSize === 7);
  assert.equal((await saved()).globalVisualStyle.parameters.pixelSize, 5, "a newly opened menu tunes only the current ritual");
  await openVisualStyle(); await choose("gouache");
  assert.equal((await saved()).visualStyles.woodfish.style, "gouache");
  assert.equal((await saved()).globalVisualStyle.style, "pixel-art", "a local style override preserves the global style");
  await requestChoice(menu().getByRole("button", { name: "恢复默认", exact: true }));
  await confirm(); await selected("toon-soft");
  assert.equal((await saved()).visualStyles.woodfish.style, "toon-soft", "local reset restores the content default over a global choice");
  assert.equal((await saved()).globalVisualStyle.style, "pixel-art");
  checks.push("apply-all replaces old overrides; an unopened ritual inherits it; reopened menus tune locally; local override and local reset preserve global choice");

  const beforeEscape = await requestChoice(menu().locator('[data-style="halftone"]'));
  await page.keyboard.press("Escape"); await selected("toon-soft");
  assert.deepEqual(visualState(await saved()), beforeEscape, "Escape cancels the preview without saving or closing the editor");
  await page.keyboard.press("Escape");
  assert.equal(await menu().count(), 0, "the next Escape closes the visual editor");
  await openVisualStyle();
  const beforeNativeBack = await requestChoice(menu().locator('[data-style="moebius"]'));
  const dismissAsNativeBack = () => page.evaluate(() => !document.dispatchEvent(new CustomEvent("wbr:close-visual-style", { cancelable: true, detail: document.querySelector(".app-shell") })));
  assert.equal(await dismissAsNativeBack(), true); await selected("toon-soft");
  assert.deepEqual(visualState(await saved()), beforeNativeBack, "native-back event cancels only the confirmation");
  assert.equal(await dismissAsNativeBack(), true);
  assert.equal(await menu().count(), 0, "the next native-back event closes the editor");
  await setFeedbackMenu(false);
  checks.push("Escape and the native-back dismissal event cancel confirmation first, then close the editor");

  await page.reload(); await open("crane"); await openVisualStyle();
  await selected("pixel-art"); await tune();
  assert.equal(await menu().getByRole("slider", { name: "像素大小", exact: true }).inputValue(), "5");
  assert.equal((await saved()).visualStyles.woodfish.style, "toon-soft", "the local reset survives refresh");
  assert.equal((await saved()).visualStyles.crane, undefined, "old crane override stays cleared after refresh");
  checks.push("global preference, inherited parameters and local exceptions survive refresh");
  await closeVisualStyle(); await leaveScene(); await open("rooster"); await openVisualStyle();
  await selected("pixel-art");
  await page.context().setOffline(true);
  await requestChoice(menu().getByRole("button", { name: "恢复默认", exact: true }));
  await screenshot("reset-all-390.png");
  await confirm("all"); await selected("toon-soft");
  assert.equal(await menu().evaluate(dialog => dialog.contains(document.activeElement) && !document.activeElement?.hasAttribute("disabled")), true, "all reset keeps focus on an enabled control inside the dialog");
  await closeVisualStyle();
  const before = await page.locator(".scene-hint").innerText();
  await page.locator(".scene-bow-tap").click();
  await page.waitForFunction(text => document.querySelector(".scene-hint")?.textContent !== text, before);
  assert.equal((await saved()).globalVisualStyle, undefined, "all reset removes the shared choice");
  assert.deepEqual((await saved()).visualStyles, {}, "all reset removes every local exception");
  checks.push("offline reset-all clears global and local preferences and scene interaction resumes");
  assert.deepEqual(errors, []);
  const report = { base, capturedAt: new Date().toISOString(), styles, default: "toon-soft", checks, errors };
  await writeFile(new URL("report.json", output), JSON.stringify(report, null, 2));
  console.log(report);
} catch (error) {
  await page?.screenshot({ path: fileURLToPath(new URL("failure.png", output)) }).catch(() => {});
  await writeFile(new URL("report.json", output), JSON.stringify({ base, capturedAt: new Date().toISOString(), checks, errors, failure: { message: error.message, stack: error.stack } }, null, 2));
  throw error;
} finally { await browser.close(); }
