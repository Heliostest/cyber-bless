// @vitest-environment jsdom
import { readFile } from "node:fs/promises";
import path from "node:path";
import { act, createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bundledWoodfish } from "@wbr/content/bundled";
import type { ContentIO } from "@wbr/content";
import { createState } from "@wbr/core";
import { BlessingApp } from "./App";
import { Context, type AppContext } from "./context";
import { ContentContext, woodfishContent } from "./content";
import { builtInScenes, SceneLibraryProvider, useOpenScene, useSceneLibrary } from "./scene-library";
import { clickOn, renderUI, settle } from "./dom-test-utils";

const runtime = vi.hoisted(() => ({ mounts: [] as { context?: { sceneId?: string; checkpoint?(n: number): void } }[] }));
vi.mock("@wbr/scene-runtime", async original => ({
  ...await original<typeof import("@wbr/scene-runtime")>(),
  mountScene(config: typeof runtime.mounts[number]) {
    runtime.mounts.push(config);
    return { setActive() {}, setReducedMotion() {}, dispose() {}, controller: null, initialized: Promise.resolve() };
  },
}));

function contentIO(): ContentIO {
  return {
    readManifest: vi.fn(async () => { throw Error("Offline"); }),
    readAsset: vi.fn(async () => { throw Error("Missing local test asset"); }),
    readCachedAsset: vi.fn(async () => { throw Error("Old cache must not be consulted"); }),
    readHistory: vi.fn(async () => ({ version: 2, confirmed: [{
      pack: { ...bundledWoodfish, revision: "old-downloaded-pack" }, base: "https://old.example/",
    }], rejected: [] })),
    writeHistory: vi.fn(async () => {}),
  };
}
afterEach(() => { document.body.replaceChildren(); runtime.mounts = []; vi.restoreAllMocks(); });

describe("the app's bundled-only ritual library", () => {
  it("offers built-in entries immediately without reading an old remote catalog or cache", async () => {
    const io = contentIO();
    function Probe() {
      const { entries, ready, error } = useSceneLibrary();
      return createElement("output", { "data-ready": ready, "data-error": error }, JSON.stringify(entries));
    }
    const ui = renderUI(createElement(Context.Provider, { value: { active: true } as AppContext },
      createElement(ContentContext.Provider, { value: { io, catalogUrl: "https://old.example/catalog.json" } },
        createElement(SceneLibraryProvider, {}, createElement(Probe)))));
    await settle();
    const output = ui.host.querySelector("output")!;
    const entries = JSON.parse(output.textContent!);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((entry: { manifestUrl: string }) => entry.manifestUrl === "")).toBe(true);
    expect(output.getAttribute("data-ready")).toBe("true");
    expect(output.getAttribute("data-error")).toBe("");
    expect(io.readManifest).not.toHaveBeenCalled();
    expect(io.readHistory).not.toHaveBeenCalled();
    ui.unmount();
  });

  it("resolves old saved remote entries to the current bundled scene before navigation", () => {
    const builtin = builtInScenes.find(entry => entry.id === "crane")!;
    const old = { ...builtin, title: "Old remote title", engine: "future@9", manifestUrl: "https://old.example/crane.json" };
    const go = vi.fn();
    function Open() { const open = useOpenScene(); return createElement("button", { onClick: () => open(old) }, "open"); }
    const ui = renderUI(createElement(Context.Provider, { value: { state: createState(), dispatch: vi.fn(), go } as unknown as AppContext }, createElement(Open)));
    clickOn(ui.host.querySelector("button")!);
    expect(go).toHaveBeenCalledWith(expect.objectContaining({ entry: builtin }));
    ui.unmount();
  });

  it("opens a direct restored scene route offline using its built-in engine and metadata", async () => {
    const builtin = builtInScenes.find(entry => entry.id === "crane")!;
    const old = { ...builtin, engine: "obsolete@8", revision: "remote-r1", manifestUrl: "https://old.example/crane.json" };
    const io = contentIO(), write = vi.fn(async (_raw: string) => {});
    const ui = renderUI(createElement(BlessingApp, {
      host: { read: async () => JSON.stringify(createState()), write },
      content: { io, catalogUrl: "https://old.example/catalog.json", manifestUrl: "https://old.example/woodfish.json" },
      initialRoute: { page: "scene", id: old.id, entry: old },
    }));
    await settle();
    expect(runtime.mounts.some(config => config.context?.sceneId === builtin.id)).toBe(true);
    expect(ui.host.querySelector(".scene-load-error")).toBeNull();
    expect(io.readManifest).not.toHaveBeenCalled();
    const saved = write.mock.calls.map(([raw]) => JSON.parse(raw as string)).find(state => state.sceneRecords.some((record: { id: string }) => record.id === builtin.id));
    expect(saved?.sceneRecords.find((record: { id: string }) => record.id === builtin.id)).toMatchObject({ engine: builtin.engine, revision: builtin.revision, manifestUrl: "" });
    ui.unmount();
  });

  it("loads the packaged woodfish even when old confirmed download metadata exists", async () => {
    const io = contentIO();
    const bytes = await readFile(path.resolve(process.cwd(), "../../assets", bundledWoodfish.model.path));
    const model = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    io.readAsset = vi.fn(async () => model);
    const initialize = vi.fn(async () => "ready");
    const client = woodfishContent({ io, manifestUrl: "https://old.example/woodfish.json" });
    await client.prepareUpdate();
    const lease = await client.load(initialize);
    await lease.confirm();
    expect(lease.value).toBe("ready");
    expect(initialize).toHaveBeenCalledWith(bundledWoodfish, model, undefined);
    expect(io.readAsset).toHaveBeenCalledWith(bundledWoodfish.model, new URL(`/${bundledWoodfish.model.path}`, window.location.href).href, undefined);
    expect(io.readManifest).not.toHaveBeenCalled();
    expect(io.readHistory).not.toHaveBeenCalled();
    expect(io.readCachedAsset).not.toHaveBeenCalled();
    expect(io.writeHistory).not.toHaveBeenCalled();
  });

  it("keeps a restored record route mounted as progress changes its saved record", async () => {
    const builtin = builtInScenes.find(entry => entry.id === "crane")!;
    const state = createState();
    state.sceneRecords.push({ ...builtin, revision: "old-remote", manifestUrl: "https://old.example/crane.json", progress: 1, favorite: true, lastOpened: "2026-10-05T08:00:00.000Z" });
    const io = contentIO();
    const ui = renderUI(createElement(BlessingApp, {
      host: { read: async () => JSON.stringify(state), write: async () => {} },
      content: { io }, initialRoute: { page: "scene", id: builtin.id },
    }));
    await settle();
    expect(runtime.mounts).toHaveLength(1);
    act(() => runtime.mounts[0].context?.checkpoint?.(2));
    await settle();
    expect(runtime.mounts).toHaveLength(1);
    expect(ui.host.querySelector(".scene-load-error")).toBeNull();
    expect(io.readManifest).not.toHaveBeenCalled();
    ui.unmount();
  });
});
