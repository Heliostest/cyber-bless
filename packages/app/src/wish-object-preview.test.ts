// @vitest-environment jsdom
import { act, createElement, createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createState } from "@wbr/core";
import { mountScene, type SceneController, type SceneSession } from "@wbr/scene-runtime";
import type { CatalogEntry } from "@wbr/content/catalog";
import { Context, type AppContext } from "./context";
import { renderUI } from "./dom-test-utils";
import type { ProceduralContext } from "./procedural-scene";
import { builtInScenes } from "./scene-library";
import { WishObjectPreview, type WishObjectPreviewHandle } from "./wish-object-preview";

// WebGL is unavailable in jsdom. Keep the runtime module real except for its
// GPU boundary, and inspect the read-only context and requested lifecycle.
vi.mock("@wbr/scene-runtime", async importOriginal => {
  const actual = await importOriginal<typeof import("@wbr/scene-runtime")>();
  return { ...actual, mountScene: vi.fn() };
});

type MountConfig = Parameters<typeof mountScene>[0];
const mounts: { config: MountConfig; session: SceneSession<SceneController> }[] = [];
const views: ReturnType<typeof renderUI>[] = [];

class Observer {
  static current: Observer;
  observe = vi.fn();
  disconnect = vi.fn();
  constructor(readonly notify: IntersectionObserverCallback) { Observer.current = this; }
  visible(value: boolean) {
    act(() => this.notify([{ isIntersecting: value } as IntersectionObserverEntry], this as unknown as IntersectionObserver));
  }
}

const entryOf = (id: string) => builtInScenes.find(entry => entry.id === id)!;
const appContext = (overrides: Partial<AppContext> = {}) => ({
  state: createState(), active: true, dispatch: vi.fn(), go: vi.fn(), feedback: vi.fn(),
  ...overrides,
}) as unknown as AppContext;
function preview(entry: CatalogEntry = entryOf("crane"), app = appContext(), variant?: string) {
  return createElement(Context.Provider, { value: app }, createElement(WishObjectPreview, { entry, variant }));
}
function renderPreview(entry?: CatalogEntry, app?: AppContext, variant?: string) {
  const ui = renderUI(preview(entry, app, variant));
  views.push(ui);
  return ui;
}

beforeEach(() => {
  vi.stubGlobal("WebGL2RenderingContext", class {});
  vi.stubGlobal("IntersectionObserver", Observer);
  vi.mocked(mountScene).mockImplementation(config => {
    const session: SceneSession<SceneController> = {
      controller: null, initialized: Promise.resolve(), dispose: vi.fn(),
      setActive: vi.fn(), setReducedMotion: vi.fn(),
    };
    mounts.push({ config, session });
    return session;
  });
});
afterEach(() => {
  views.splice(0).forEach(ui => ui.unmount());
  mounts.splice(0);
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("completed ritual objects on the wish shelf", () => {
  it("uses a read-only content adapter for a collected woodfish instead of a procedural context", async () => {
    renderPreview(entryOf("woodfish"));
    Observer.current.visible(true);
    const context = mounts[0].config.context as import("./scene-engines").WoodfishContext;
    expect(typeof context.content?.load).toBe("function");
    expect(context.impact()).toBeUndefined();
    await expect(context.decodeSound(new ArrayBuffer(0))).rejects.toThrow("A preview has no sound");
    await expect(context.content.prepareUpdate()).resolves.toBeUndefined();
  });
  it("forwards a tap to a ready object's own motion and refuses taps after it leaves the screen", () => {
    const ref = createRef<WishObjectPreviewHandle>();
    const app = appContext();
    const ui = renderUI(createElement(Context.Provider, { value: app },
      createElement(WishObjectPreview, { entry: entryOf("crane"), ref })));
    views.push(ui);
    expect(ref.current?.tap()).toBe(false);
    Observer.current.visible(true);
    const tapPreview = vi.fn(() => true);
    Object.assign(mounts[0].session, { controller: { tapPreview } });
    act(() => mounts[0].config.ready());
    expect(ref.current?.tap()).toBe(true);
    expect(tapPreview).toHaveBeenCalledOnce();
    expect(app.dispatch).not.toHaveBeenCalled();
    Observer.current.visible(false);
    expect(ref.current?.tap()).toBe(false);
    expect(tapPreview).toHaveBeenCalledOnce();
  });
  it("waits for a visible slot before allocating a completed, inert scene", () => {
    const ui = renderPreview();
    expect(mountScene).not.toHaveBeenCalled();
    const frame = ui.host.querySelector(".wish-object-preview")!;
    expect(frame.hasAttribute("inert")).toBe(true);
    expect(frame.getAttribute("aria-hidden")).toBe("true");
    expect(Observer.current.observe).toHaveBeenCalledWith(frame);
    Observer.current.visible(true);
    const context = mounts[0].config.context as ProceduralContext;
    expect(context.progress).toBe(3);
    expect(context.sceneId).toBe("crane");
    expect(context.stage).toBe("day");
    expect(context.deferWishWriting).toBe(true);
    expect(context.isSoundEnabled?.()).toBe(false);
    expect(context.saveWish).toBeUndefined();
    expect(context.prepareFeedback).toBeUndefined();
    expect(context.haptic).toBeUndefined();
    expect(context.onVariantChange).toBeUndefined();
    expect(context.checkpoint(3)).toBeUndefined();
    expect(mounts[0].config.host.className).toBe("library-scene-stage wish-object-preview-stage");
    expect(mounts[0].config.host.dataset.scene).toBe("crane");
    expect(mounts[0].config.host.dataset.scenePresentation).toBe("object");
    act(() => mounts[0].config.ready());
    expect(frame.getAttribute("data-status")).toBe("ready");
  });

  it("uses each scene's completion checkpoint and restores its existing variant", () => {
    renderPreview(entryOf("tibetan-water-bowls"), appContext(), "saved-colour");
    Observer.current.visible(true);
    const context = mounts[0].config.context as ProceduralContext;
    expect(context.progress).toBe(9);
    expect(context.initialVariant).toBe("saved-colour");
  });

  it("releases offscreen GPU sessions and creates a fresh one when a slot returns", () => {
    renderPreview();
    Observer.current.visible(true);
    const first = mounts[0];
    Observer.current.visible(false);
    expect(first.session.dispose).toHaveBeenCalledTimes(1);
    Observer.current.visible(true);
    expect(mounts).toHaveLength(2);
    expect(mounts[1].config.active).toBe(true);
    expect(first.session.dispose).toHaveBeenCalledTimes(1);
  });

  it("releases sessions while the app sleeps and follows motion settings without rebuilding", () => {
    const ui = renderPreview();
    Observer.current.visible(true);
    ui.rerender(preview(entryOf("crane"), appContext({ state: createState({ reducedMotion: true }) })));
    expect(mounts).toHaveLength(1);
    expect(mounts[0].session.setReducedMotion).toHaveBeenLastCalledWith(true);
    ui.rerender(preview(entryOf("crane"), appContext({ active: false })));
    expect(mounts[0].session.dispose).toHaveBeenCalledTimes(1);
    ui.rerender(preview(entryOf("crane"), appContext()));
    expect(mounts).toHaveLength(2);
  });

  it("keeps the scene icon after graphics failure without repeatedly allocating contexts", () => {
    const ui = renderPreview();
    Observer.current.visible(true);
    act(() => mounts[0].config.failed(Error("graphics lost")));
    expect(ui.host.querySelector(".wish-object-preview")?.getAttribute("data-status")).toBe("failed");
    expect(ui.host.querySelector(".scene-icon")).not.toBeNull();
    expect(ui.host.querySelector(".wish-object-preview-stage")).toBeNull();
    expect(mounts[0].session.dispose).toHaveBeenCalledTimes(1);
    Observer.current.visible(false);
    Observer.current.visible(true);
    expect(mounts).toHaveLength(1);
  });

  it("ignores a released session's late readiness or failure callbacks", () => {
    const ui = renderPreview();
    Observer.current.visible(true);
    const stale = mounts[0];
    Observer.current.visible(false);
    Observer.current.visible(true);
    act(() => { stale.config.ready(); stale.config.failed(); });
    expect(ui.host.querySelector(".wish-object-preview")?.getAttribute("data-status")).toBe("loading");
    expect(ui.host.querySelector(".wish-object-preview-stage")).not.toBeNull();
    expect(mounts[1].session.dispose).not.toHaveBeenCalled();
  });

  it("shows the existing scene icon when WebGL2 is unavailable", () => {
    vi.stubGlobal("WebGL2RenderingContext", undefined);
    const ui = renderPreview();
    Observer.current.visible(true);
    expect(mountScene).not.toHaveBeenCalled();
    expect(ui.host.querySelector(".wish-object-preview")?.getAttribute("data-status")).toBe("failed");
    expect(ui.host.querySelector(".scene-icon")).not.toBeNull();
  });

  it("draws immediately if visibility observation is unsupported and cleans up on unmount", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const ui = renderPreview();
    expect(mounts).toHaveLength(1);
    ui.unmount();
    views.splice(views.indexOf(ui), 1);
    expect(mounts[0].session.dispose).toHaveBeenCalledTimes(1);
  });

  it("replaces the scene when its object or variant changes", () => {
    const ui = renderPreview(entryOf("crane"), appContext(), "blue");
    Observer.current.visible(true);
    ui.rerender(preview(entryOf("crane"), appContext(), "green"));
    expect(mounts[0].session.dispose).toHaveBeenCalledTimes(1);
    expect(Observer.current.observe).toHaveBeenCalledTimes(1);
    Observer.current.visible(true);
    expect((mounts[1].config.context as ProceduralContext).initialVariant).toBe("green");
    ui.rerender(preview(entryOf("tanzaku-tanabata"), appContext()));
    Observer.current.visible(true);
    expect((mounts[2].config.context as ProceduralContext).sceneId).toBe("tanzaku-tanabata");
  });
});
