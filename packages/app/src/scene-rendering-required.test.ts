// @vitest-environment jsdom
import { act, createElement } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createState } from "@wbr/core";
import { Context, type AppContext } from "./context";
import { Woodfish } from "./woodfish";
import { BlessingApp } from "./App";
import { builtInScenes } from "./scene-library";
import { clickOn, renderUI, settle } from "./dom-test-utils";

const runtime = vi.hoisted(() => ({ mounts: [] as {
  context?: { sceneId?: string; progress?: number; checkpoint?(n: number): void };
  ready(): void; failed(error?: unknown): void;
}[] }));
vi.mock("@wbr/scene-runtime", async (original) => ({
  ...await original<typeof import("@wbr/scene-runtime")>(),
  mountScene: (config: typeof runtime.mounts[number]) => {
    runtime.mounts.push(config);
    const lifecycle = { setActive() {}, setReducedMotion() {}, dispose() {} };
    return { ...lifecycle, initialized: Promise.resolve(), controller: {
      ...lifecycle, strike() {}, whenIdle: () => Promise.resolve(), movePointer() {}, stopFollowing() {}, inspect() {},
    } };
  },
}));
beforeEach(() => { runtime.mounts = []; });
afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });

async function woodfish() {
  const onStrike = vi.fn(() => true), onImpact = vi.fn();
  const ui = renderUI(createElement(Context.Provider, {
    value: { state: createState(), decodeSound: vi.fn() } as unknown as AppContext,
  }, createElement(Woodfish, {
    active: true, reducedMotion: false, view: "front", disabled: false,
    onStrike, onImpact, onInstruction() {}, contentClient: {} as never,
  })));
  await settle();
  return { ...ui, onStrike, onImpact };
}

it("never shows an image or accepts strikes before the 3D model is ready", async () => {
  const ui = await woodfish();
  expect(ui.host.querySelector("img, .art, .woodfish-fallback")).toBeNull();
  const button = ui.host.querySelector<HTMLButtonElement>(".woodfish-object")!;
  expect(button.disabled).toBe(true);
  clickOn(button);
  expect(ui.onStrike).not.toHaveBeenCalled();
  act(() => runtime.mounts[0].ready());
  expect(button.disabled).toBe(false);
  clickOn(button);
  expect(ui.onStrike).toHaveBeenCalledTimes(1);
  ui.unmount();
});

it("uses the shared stage and keeps the hint, count and helpers in its tray", async () => {
  const ui = await woodfish();
  const stage = ui.host.querySelector('.library-scene-stage[data-scene="woodfish"]')!;
  expect(stage).not.toBeNull();
  const overlay = stage.querySelector('.scene-overlay-host.scene-overlay--stage')!;
  expect(overlay).not.toBeNull();
  expect(overlay.querySelector('.scene-hit-layer.woodfish-object')).not.toBeNull();
  expect(overlay.querySelector('#woodfish-instruction.scene-hint')).not.toBeNull();
  expect(overlay.querySelector('.scene-step-dots.woodfish-count')?.textContent).toContain('0 / 12');
  expect(overlay.querySelector('.scene-bow-tap')?.getAttribute('aria-label')).toBe('辅助轻敲');
  expect(ui.host.querySelector('.scene-cue-shelf')).toBeNull();
  ui.unmount();
});

it("stops interaction after a graphics failure and retries the real engine", async () => {
  const ui = await woodfish();
  act(() => runtime.mounts[0].ready());
  act(() => runtime.mounts[0].failed(Error("Graphics context lost")));
  expect(ui.host.querySelector("img, .art, .woodfish-fallback")).toBeNull();
  const button = ui.host.querySelector<HTMLButtonElement>(".woodfish-object")!;
  clickOn(button);
  expect(ui.onStrike).not.toHaveBeenCalled();
  expect(ui.onImpact).not.toHaveBeenCalled();
  const retry = [...ui.host.querySelectorAll("button")].find(b => b.textContent === "重试打开");
  expect(retry).toBeDefined();
  clickOn(retry!);
  await settle();
  expect(runtime.mounts).toHaveLength(2);
  expect(button.disabled).toBe(true);
  act(() => runtime.mounts[1].ready());
  clickOn(button);
  expect(ui.onStrike).toHaveBeenCalledTimes(1);
  ui.unmount();
});

it("reports bundled woodfish failures through the scene retry screen too", async () => {
  const entry = builtInScenes.find(e => e.id === "woodfish")!;
  const ui = renderUI(createElement(BlessingApp, {
    host: { read: async () => JSON.stringify(createState()), write: async () => {} },
    initialRoute: { page: "scene", id: entry.id, entry },
  }));
  await settle();
  act(() => runtime.mounts[0].failed(Error("Graphics context lost")));
  expect(ui.host.querySelector(".scene-load-error[role=alert]")).not.toBeNull();
  expect(ui.host.querySelector(".woodfish-object")).toBeNull();
  const retry = [...ui.host.querySelectorAll("button")].find(b => b.textContent === "重试打开")!;
  clickOn(retry);
  await settle();
  expect(runtime.mounts).toHaveLength(2);
  ui.unmount();
});

it("resumes an old paper crane session through the 3D engine, never an image button", async () => {
  const state = { ...createState(), activeSession: {
    id: "legacy", ritual: "crane" as const, progress: 3, startedAt: "2026-10-05T08:00:00.000Z",
  } };
  const ui = renderUI(createElement(BlessingApp, {
    host: { read: async () => JSON.stringify(state), write: async () => {} },
    initialRoute: { page: "ritual", id: "crane" },
  }));
  await settle();
  expect(ui.host.querySelector('.library-scene-stage[data-scene="crane"]')).not.toBeNull();
  expect(ui.host.querySelector(".ritual-page .art, .ritual-page img")).toBeNull();
  const context = runtime.mounts[0].context!;
  expect(context.sceneId).toBe("crane");
  expect(context.progress).toBe(2);
  expect(context.checkpoint).toBeTypeOf("function");
  ui.unmount();
});
