// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createState, reduce, type State } from "@wbr/core";
import { BlessingApp } from "./App";
import { clickOn, renderUI, settle, typeInto } from "./dom-test-utils";

const AT = "2026-11-02T08:00:00.000Z";
const mounted: ReturnType<typeof renderUI>[] = [];
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { mounted.splice(0).forEach(ui => ui.unmount()); vi.restoreAllMocks(); });

async function open(method: "kindness" | "ritual", withKeepsake: boolean) {
  let state = reduce(createState(), { type: "wish.create", id: "w1", title: "app早日发布", intention: "", returnMethod: method, at: AT });
  state = reduce(state, { type: "wish.realize", id: "w1", at: AT });
  if (withKeepsake) state = reduce(state, { type: "daily.scene", id: "visit", sceneId: "crane", title: "折一只纸鹤", wishScene: true,
    day: "2026-11-02", startedAt: AT, at: AT });
  let raw = JSON.stringify(state);
  const ui = renderUI(createElement(BlessingApp, { host: { read: async () => raw, write: async next => { raw = next; } },
    initialRoute: { page: "fulfill", id: "w1" } }));
  mounted.push(ui);
  await settle();
  return { ...ui, before: state, saved: async () => { await settle(); return JSON.parse(raw) as State; } };
}

describe("kindness-only fulfillment", () => {
  it.each(["kindness", "ritual"] as const)("offers only a kindness note for a %s wish without requiring a keepsake", async method => {
    const ui = await open(method, false);
    expect(ui.host.querySelector(".fulfillment-card h2")?.textContent).toBe("做一件小善事");
    expect(ui.host.querySelector('input[type="radio"], .linked-ritual, .vessel-card')).toBeNull();
    const submit = ui.host.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(submit.disabled).toBe(true);
    typeInto(ui.host.querySelector("#return-note")!, "帮朋友完成了一件小事");
    expect(submit.disabled).toBe(false);
    clickOn(submit);
    const saved = await ui.saved();
    expect(saved.wishes[0]).toMatchObject({ status: "fulfilled", returnMethod: "kindness", notes: [{ text: "帮朋友完成了一件小事" }] });
    expect(saved.sessions).toEqual([]);
    expect(saved.collectibles.map(item => item.kind)).toEqual(["badge"]);
    expect(ui.host.querySelector(".app-shell")?.getAttribute("data-page")).toBe("wish");
    expect(ui.host.querySelector(".wish-keepsake .badge-medallion")).not.toBeNull();
  });

  it("leaves collected ritual objects untouched when recording a kindness", async () => {
    const ui = await open("ritual", true);
    typeInto(ui.host.querySelector("#return-note")!, "请帮助过我的朋友喝了一杯咖啡");
    clickOn(ui.host.querySelector('button[type="submit"]')!);
    const saved = await ui.saved();
    expect(saved.wishes[0].returnMethod).toBe("kindness");
    expect(saved.collectibles[0]).toEqual(ui.before.collectibles[0]);
    expect(saved.sessions).toEqual(ui.before.sessions);
    expect(saved.wishes[0].notes).toHaveLength(1);
  });
});
