import { describe, expect, it, vi } from "vitest";
import { readSceneMotion } from "./scene-motion";
import {
  createSceneRegistry,
  getEnvironmentProfile,
  getEnvironmentRiverbedY,
  getEnvironmentSurfaceY,
  mountScene,
  type SceneMountOptions,
} from "./index";
function setup() {
  const host = {} as HTMLDivElement;
  let changed: (() => void) | undefined;
  const visibility = {
    hidden: false,
    subscribe: (fn: () => void) => {
      changed = fn;
      return () => {
        changed = undefined;
      };
    },
  };
  const controller = {
    setActive: vi.fn(),
    setReducedMotion: vi.fn(),
    dispose: vi.fn(),
    strike: vi.fn(),
  };
  let options!: SceneMountOptions;
  const engine = {
    create: vi.fn((_host, _context, state) => {
      options = state;
      return controller;
    }),
  };
  const ready = vi.fn(),
    failed = vi.fn();
  return {
    host,
    visibility,
    controller,
    engine,
    ready,
    failed,
    options: () => options,
    change: () => changed?.(),
    subscribed: () => !!changed,
    mount: (load = async () => engine) =>
      mountScene({
        host,
        context: {},
        load,
        active: true,
        reducedMotion: false,
        visibility,
        ready,
        failed,
      }),
  };
}
describe("scene lifecycle host", () => {
  it("shares live pause and reduced-motion preferences with nested decorative renderers", async () => {
    const s = setup(), other = setup();
    const canvas = { parentElement: s.host } as HTMLElement;
    const session = s.mount(), otherSession = other.mount();
    await session.initialized;
    expect(readSceneMotion(canvas)).toEqual({ active: true, reducedMotion: false });
    session.setReducedMotion(true);
    expect(readSceneMotion(canvas).reducedMotion).toBe(true);
    expect(readSceneMotion(other.host).reducedMotion).toBe(false);
    s.visibility.hidden = true; s.change();
    expect(readSceneMotion(canvas).active).toBe(false);
    s.visibility.hidden = false; session.setActive(false);
    expect(readSceneMotion(canvas).active).toBe(false);
    session.dispose(); otherSession.dispose();
    expect(readSceneMotion(canvas)).toEqual({ active: true, reducedMotion: true });
  });
  it("never creates an engine when a lazy import finishes after unmount", async () => {
    const s = setup();
    let resolve!: (value: typeof s.engine) => void;
    const session = s.mount(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    session.dispose();
    resolve(s.engine);
    await session.initialized;
    expect(s.engine.create).not.toHaveBeenCalled();
    expect(s.subscribed()).toBe(false);
  });
  it("uses the latest pause and motion settings when import finishes", async () => {
    const s = setup();
    let resolve!: (value: typeof s.engine) => void;
    const session = s.mount(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    session.setActive(false);
    session.setReducedMotion(true);
    resolve(s.engine);
    await session.initialized;
    expect(s.options().active).toBe(false);
    expect(s.options().reducedMotion).toBe(true);
    session.controller?.strike();
    expect(s.controller.strike).toHaveBeenCalledOnce();
    session.dispose();
  });
  it("combines page visibility with user pause and unsubscribes on dispose", async () => {
    const s = setup();
    const session = s.mount();
    await session.initialized;
    s.visibility.hidden = true;
    s.change();
    expect(s.controller.setActive).toHaveBeenLastCalledWith(false);
    s.visibility.hidden = false;
    s.change();
    expect(s.controller.setActive).toHaveBeenLastCalledWith(true);
    session.setActive(false);
    s.visibility.hidden = true;
    s.change();
    s.visibility.hidden = false;
    s.change();
    expect(s.controller.setActive).toHaveBeenLastCalledWith(false);
    session.dispose();
    session.dispose();
    expect(s.controller.dispose).toHaveBeenCalledOnce();
    expect(s.subscribed()).toBe(false);
  });
  it("aborts and disposes once on failure and suppresses late readiness", async () => {
    const s = setup();
    const session = s.mount();
    await session.initialized;
    s.options().failed(Error("context lost"));
    s.options().ready();
    await Promise.resolve();
    expect(s.options().signal.aborted).toBe(true);
    expect(s.controller.dispose).toHaveBeenCalledOnce();
    expect(s.failed).toHaveBeenCalledOnce();
    expect(s.ready).not.toHaveBeenCalled();
    expect(session.controller).toBeNull();
    session.dispose();
    expect(s.controller.dispose).toHaveBeenCalledOnce();
  });
  it("handles synchronous engine callbacks without leaking the returned controller", async () => {
    const s = setup();
    s.engine.create.mockImplementation((_h, _c, options) => {
      options.failed(Error("startup"));
      return s.controller;
    });
    const session = s.mount();
    await session.initialized;
    expect(s.controller.dispose).toHaveBeenCalledOnce();
    expect(s.failed).toHaveBeenCalledOnce();
  });
  it("reports lazy-import failure without mounting or retaining listeners", async () => {
    const s = setup();
    const session = s.mount(async () => {
      throw Error("chunk missing");
    });
    await session.initialized;
    expect(s.engine.create).not.toHaveBeenCalled();
    expect(s.failed).toHaveBeenCalledOnce();
    expect(s.subscribed()).toBe(false);
  });
});
describe("engine registry", () => {
  it("only loads the requested engine and retries failed imports", async () => {
    const s = setup();
    const first = vi
        .fn()
        .mockRejectedValueOnce(Error("offline"))
        .mockResolvedValue(s.engine),
      second = vi.fn(async () => s.engine);
    const registry = createSceneRegistry({ "one@1": first, "two@1": second });
    expect(first).not.toHaveBeenCalled();
    await expect(registry.load("one@1")).rejects.toThrow();
    expect(await registry.load("one@1")).toBe(s.engine);
    expect(second).not.toHaveBeenCalled();
  });
});

describe("environment surface height contract", () => {
  it("resolves exact surface and riverbed heights across all five environment kinds", () => {
    expect(getEnvironmentProfile("woodfish")).toEqual({ kind: "veranda", floor: -0.95 });
    expect(getEnvironmentSurfaceY("woodfish")).toBeCloseTo(-0.945, 6);
    expect(getEnvironmentSurfaceY("milagros")).toBeCloseTo(-0.035, 6);
    expect(getEnvironmentSurfaceY("tibetan-wheel")).toBeCloseTo(-0.03, 6);

    expect(getEnvironmentSurfaceY("phuang-malai")).toBeCloseTo(-0.032, 6);
    expect(getEnvironmentSurfaceY("mochigase-nagashibina")).toBeCloseTo(-0.282, 6);

    expect(getEnvironmentSurfaceY("shinto-torii")).toBeCloseTo(-0.0175, 6);
    expect(getEnvironmentSurfaceY("shrine-suzu-bell")).toBeCloseTo(-0.0225, 6);
    expect(getEnvironmentSurfaceY("mezuzah-doorpost")).toBeCloseTo(0.0175, 6);

    expect(getEnvironmentSurfaceY("crane")).toBeCloseTo(-0.665, 6);

    // Non-coastal river scenes expose bank top (floor + 0.075) and riverbed (floor - 0.30).
    expect(getEnvironmentSurfaceY("floating-lantern-loy-krathong")).toBeCloseTo(0.035, 6);
    expect(getEnvironmentRiverbedY("floating-lantern-loy-krathong")).toBeCloseTo(-0.34, 6);
    expect(getEnvironmentSurfaceY("slavic-wreath")).toBeCloseTo(0.02, 6);
    expect(getEnvironmentRiverbedY("slavic-wreath")).toBeCloseTo(-0.355, 6);

    // Coastal river scene (udo-undama) uses floor directly for surface and floor - 0.30 for bed.
    expect(getEnvironmentSurfaceY("udo-undama")).toBeCloseTo(-0.04, 6);
    expect(getEnvironmentRiverbedY("udo-undama")).toBeCloseTo(-0.34, 6);
  });

  it("falls back safely for unknown IDs and prototype property names", () => {
    expect(getEnvironmentProfile("unknown-scene-id")).toBeUndefined();
    expect(getEnvironmentProfile("toString")).toBeUndefined();
    expect(getEnvironmentSurfaceY("unknown-scene-id")).toBe(0);
    expect(getEnvironmentSurfaceY("constructor")).toBe(0);
    expect(getEnvironmentRiverbedY("unknown-scene-id")).toBe(0);
    expect(getEnvironmentRiverbedY("woodfish")).toBeCloseTo(-0.945, 6);
  });
});
