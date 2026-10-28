import { describe, expect, it } from "vitest";
import { createDebugStyles } from "./debug-styles";

describe("per-scene debug styles", () => {
  it("captures genuine preview frames in the matching scope without publishing a style change", () => {
    const store = createDebugStyles(), a = {}, b = {};
    let captures = 0;
    const registration = store.register("crane", "A", () => {}, a, (style, parameters) => {
      captures++;
      return `${style}:${parameters.pixelSize}`;
    });
    store.register("crane", "B", () => {}, b, () => "other-scope");
    registration.refreshPreviews();
    const before = store.getSnapshot();
    expect(before[0].previewVersion).toBeGreaterThan(0);
    const capture = store.getPreviewCapture("crane", a)!;
    expect(capture("pixel-art", { ...before[0].parameters, pixelSize: 7 })).toBe("pixel-art:7");
    expect(captures).toBe(1);
    expect(store.getSnapshot()).toBe(before);
    expect(store.getPreviewCapture("crane", b)!("original", before[1].parameters)).toBe("other-scope");
    expect(store.getPreviewCapture("missing", a)).toBeUndefined();
    registration.dispose();
    expect(capture("original", before[0].parameters)).toBeNull();
    expect(captures).toBe(1);
  });

  it("invalidates thumbnail generations across renderer replacements and contains capture failures", () => {
    const store = createDebugStyles(), scope = {};
    const first = store.register("tea", "Tea", () => {}, scope, () => { throw Error("lost context"); });
    first.refreshPreviews();
    const version = store.getSnapshot()[0].previewVersion!;
    const capture = store.getPreviewCapture("tea", scope)!;
    expect(capture("original", store.getSnapshot()[0].parameters)).toBeNull();
    first.dispose();
    const next = store.register("tea", "Tea", () => {}, scope, () => "new-frame");
    next.refreshPreviews();
    expect(store.getSnapshot()[0].previewVersion).toBeGreaterThan(version);
    expect(capture("original", store.getSnapshot()[0].parameters)).toBeNull();
  });

  it("isolates two App scopes even when their rituals have the same technical ID", () => {
    const store = createDebugStyles(), a = {}, b = {}, cancelA = () => { countA++; }, cancelB = () => { countB++; };
    let renderedA = "", renderedB = "", countA = 0, countB = 0;
    const userA = store.connectUserPreference("crane", { style: "pixel-art" }, cancelA, a);
    const userB = store.connectUserPreference("crane", { style: "halftone" }, cancelB, b);
    store.register("crane", "A", value => { renderedA = value; }, a).setDefault("toon-soft");
    store.register("crane", "B", value => { renderedB = value; }, b).setDefault("toon-soft");
    expect([renderedA, renderedB]).toEqual(["pixel-art", "halftone"]);
    userA.update({ style: "moebius" });
    expect([renderedA, renderedB]).toEqual(["moebius", "halftone"]);
    store.cancelInput("crane", a); expect([countA, countB]).toEqual([1, 0]);
    userB.dispose(); expect([renderedA, renderedB]).toEqual(["moebius", "toon-soft"]);
    userA.dispose();
  });
  it("applies App preferences without debug mode, scopes live previews, and removes them on exit", () => {
    const store = createDebugStyles(), cancelInput = () => { resets++; }; let resets = 0;
    const preference = { style: "pixel-art" as const, parameters: { pixelSize: 6 } };
    const user = store.connectUserPreference("tea", preference, cancelInput);
    store.register("tea", "茶", () => {}).setDefault("toon-soft");
    store.register("horse", "马", () => {}).setDefault("toon-soft");
    expect(store.getSnapshot()[0]).toMatchObject({ actual: "pixel-art", defaultStyle: "toon-soft", override: null, parameters: { pixelSize: 6 } });
    const preview = store.connectUserPreference("tea", { style: "moebius", parameters: { hatchStrength: 0.2 } });
    expect(store.getSnapshot()[0].actual).toBe("moebius");
    store.cancelInput("tea"); expect(resets).toBe(1);
    preview.dispose(); expect(store.getSnapshot()[0].actual).toBe("pixel-art");
    user.update(null); expect(store.getSnapshot()[0].actual).toBe("toon-soft");
    expect(store.getSnapshot()[1].actual).toBe("toon-soft");
    user.dispose();
  });

  it("keeps development overrides separate from App choices and clears them for explicit user editing", () => {
    const store = createDebugStyles(); store.enable();
    store.register("tea", "茶", () => {}).setDefault("toon-soft");
    const app = store.connectUserPreference("tea", { style: "pixel-art", parameters: { pixelSize: 5 } });
    store.select("tea", "halftone"); store.setParameters("tea", { pixelSize: 9 });
    expect(store.getSnapshot()[0].actual).toBe("halftone");
    store.clearDebugOverride("tea");
    expect(store.getSnapshot()[0]).toMatchObject({ actual: "pixel-art", parameters: { pixelSize: 5 } });
    app.dispose(); expect(store.getSnapshot()[0].actual).toBe("toon-soft");
  });
  it("keeps comic controls separate, migrates older parameter records and resets each preset", () => {
    const store = createDebugStyles();
    const saved = new Map([["wbr.debug.scene-parameters.v1", '{"tea":{"pixelSize":7}}']]);
    const storage = { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => { saved.set(key, value); } };
    store.enable(storage); store.register("tea", "茶", () => {}).setDefault("toon-soft");
    expect(store.getSnapshot()[0].parameters).toMatchObject({ pixelSize: 7, moebiusWidth: 0.85, moebiusLevels: 8, hatchStrength: 0.5, toonWidth: 1, toonLevels: 3 });
    store.setParameters("tea", { moebiusWidth: 2, moebiusLevels: 4, hatchStrength: 0, toonWidth: 3, toonLevels: 6 });
    store.select("tea", "moebius"); store.resetParameters("tea", "moebius");
    expect(store.getSnapshot()[0].parameters).toMatchObject({ moebiusWidth: 0.85, moebiusLevels: 8, hatchStrength: 0.5, toonWidth: 3, toonLevels: 6 });
    store.select("tea", "toon-outline"); store.resetParameters("tea", "toon-outline");
    const next = createDebugStyles(); next.enable(storage); next.register("tea", "茶", () => {}).setDefault("toon-soft");
    expect(next.getSnapshot()[0]).toMatchObject({ actual: "toon-outline", defaultStyle: "toon-soft", parameters: { toonWidth: 1, toonLevels: 3, pixelSize: 7 } });
    store.setParameters("tea", { moebiusWidth: -100, moebiusLevels: 100, hatchStrength: 100, toonWidth: 100, toonLevels: 1 });
    expect(store.getSnapshot()[0].parameters).toMatchObject({ moebiusWidth: 0.25, moebiusLevels: 12, hatchStrength: 1, toonWidth: 4, toonLevels: 2 });
  });
  it("applies live parameters only to the requested scene without changing its preset or default", () => {
    const store = createDebugStyles(); store.enable();
    const rendered: Record<string, unknown> = {};
    store.register("tea", "茶", (style, parameters) => { rendered.tea = { style, parameters }; }).setDefault("toon-soft");
    store.register("horse", "马", (style, parameters) => { rendered.horse = { style, parameters }; }).setDefault("toon-soft");
    store.select("tea", "halftone");
    const before = store.getSnapshot();
    store.setParameters("tea", { halftoneSize: 8, halftoneStrength: 0.25 });
    expect(rendered.tea).toMatchObject({ style: "halftone", parameters: { halftoneSize: 8, halftoneStrength: 0.25, pixelSize: 3 } });
    expect(rendered.horse).toMatchObject({ style: "toon-soft", parameters: { halftoneSize: 4, halftoneStrength: 0.58, pixelSize: 3 } });
    expect(before[0].parameters.halftoneSize).toBe(4);
    expect(store.getSnapshot()[0].defaultStyle).toBe("toon-soft");
    store.select("tea", null);
    expect(store.getSnapshot()[0].actual).toBe("toon-soft");
  });

  it("restores parameters across reloads only when debug is enabled, alongside existing preset storage", () => {
    const saved = new Map<string, string>();
    const storage = { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => { saved.set(key, value); } };
    const first = createDebugStyles(); first.enable(storage);
    first.select("tea", "pixel-art"); first.setParameters("tea", { pixelSize: 7 });
    const second = createDebugStyles();
    second.register("tea", "茶", () => {}).setDefault("toon-soft");
    expect(second.getSnapshot()[0].parameters.pixelSize).toBe(3);
    second.enable(storage);
    expect(second.getSnapshot()[0]).toMatchObject({ actual: "pixel-art", defaultStyle: "toon-soft", parameters: { pixelSize: 7 } });
  });

  it("bounds persisted and live values and survives denied parameter storage", () => {
    const store = createDebugStyles();
    store.enable({ getItem: key => key.includes("parameters") ? '{"tea":{"halftoneSize":0,"halftoneStrength":2,"pixelSize":"bad"}}' : "{}",
      setItem: () => { throw Error("denied"); } });
    store.register("tea", "茶", () => {});
    expect(store.getSnapshot()[0].parameters).toMatchObject({ halftoneSize: 2, halftoneStrength: 1, pixelSize: 3 });
    store.setParameters("tea", { pixelSize: 999, halftoneSize: NaN, halftoneStrength: Infinity });
    expect(store.getSnapshot()[0].parameters).toMatchObject({ halftoneSize: 2, halftoneStrength: 1, pixelSize: 12 });
  });

  it("resets only the active effect parameters and retains them when switching presets", () => {
    const store = createDebugStyles(); store.enable(); store.register("tea", "茶", () => {});
    store.setParameters("tea", { halftoneSize: 10, halftoneStrength: 0.9, pixelSize: 8 });
    store.select("tea", "pixel-art"); store.resetParameters("tea", "pixel-art");
    expect(store.getSnapshot()[0].parameters).toMatchObject({ halftoneSize: 10, halftoneStrength: 0.9, pixelSize: 3 });
    store.select("tea", "halftone");
    expect(store.getSnapshot()[0].parameters.halftoneSize).toBe(10);
    store.resetParameters("tea", "halftone");
    expect(store.getSnapshot()[0]).toMatchObject({ actual: "halftone", parameters: { halftoneSize: 4, halftoneStrength: 0.58, pixelSize: 3 } });
  });

  it.each(["halftone", "pixel-art"] as const)("selects %s independently and restores the existing default", style => {
    const store = createDebugStyles(); store.enable();
    let rendered = "";
    const scene = store.register("tea", "茶", value => { rendered = value; });
    scene.setDefault("toon-soft");
    store.select("tea", style);
    expect(rendered).toBe(style);
    expect(store.getSnapshot()[0].defaultStyle).toBe("toon-soft");
    store.select("tea", null);
    expect(rendered).toBe("toon-soft");
  });
  it("selects cartoon outlines without changing the soft default and restores it", () => {
    const store = createDebugStyles(); store.enable();
    let rendered = "";
    const scene = store.register("horse", "木马", style => { rendered = style; });
    scene.setDefault("toon-soft");
    store.select("horse", "toon-outline");
    expect(rendered).toBe("toon-outline");
    expect(store.getSnapshot()[0].defaultStyle).toBe("toon-soft");
    store.select("horse", null);
    expect(rendered).toBe("toon-soft");
  });
  it("offers Moebius as an override while preserving and restoring the soft default", () => {
    const store = createDebugStyles(); store.enable();
    let rendered = "";
    const scene = store.register("horse", "木马", style => { rendered = style; });
    scene.setDefault("toon-soft");
    expect(rendered).toBe("toon-soft");
    store.select("horse", "moebius");
    expect(rendered).toBe("moebius");
    expect(store.getSnapshot()[0].defaultStyle).toBe("toon-soft");
    store.select("horse", null);
    expect(rendered).toBe("toon-soft");
  });
  it("restores a saved gouache choice and can return to the scene default", () => {
    const store = createDebugStyles();
    let rendered = "";
    const scene = store.register("horse", "木马", style => { rendered = style; });
    scene.setDefault("toon-soft");
    store.enable({ getItem: () => '{"horse":"gouache"}', setItem() {} });
    expect(rendered).toBe("gouache");
    store.select("horse", null);
    expect(rendered).toBe("toon-soft");
  });
  it("applies overrides independently, restores the latest content default, and detaches on disposal", () => {
    const store = createDebugStyles();
    store.enable();
    let woodfish = "", spring = "";
    const a = store.register("woodfish", "木鱼", (style) => { woodfish = style; });
    const b = store.register("spring", "泉", (style) => { spring = style; });
    a.setDefault("toon-soft");
    store.select("woodfish", "toon-ink");
    store.select("spring", "original");
    a.setDefault("original");
    expect(woodfish).toBe("toon-ink");
    expect(spring).toBe("original");
    store.select("woodfish", null);
    expect(woodfish).toBe("original");
    a.dispose();
    store.select("woodfish", "toon-soft");
    expect(woodfish).toBe("original");
    expect(store.getSnapshot().map((s) => s.id)).toEqual(["spring"]);
    b.dispose();
    expect(store.getSnapshot()).toEqual([]);
  });

  it("persists choices across mounts and reloads but never applies them without debug enabled", () => {
    let saved: string | null = null;
    const storage = { getItem: () => saved, setItem: (_key: string, value: string) => { saved = value; } };
    const first = createDebugStyles();
    first.enable(storage);
    first.select("woodfish", "toon-ink");
    const second = createDebugStyles();
    let rendered = "";
    const registration = second.register("woodfish", "木鱼", (style) => { rendered = style; });
    registration.setDefault("toon-soft");
    expect(rendered).toBe("toon-soft");
    second.enable(storage);
    expect(rendered).toBe("toon-ink");
    registration.dispose();
    second.register("woodfish", "木鱼", (style) => { rendered = style; });
    expect(rendered).toBe("toon-ink");
  });

  it("ignores invalid stored presets and keeps live switching usable when storage is denied", () => {
    const store = createDebugStyles();
    store.enable({ getItem: () => '{"woodfish":"unknown","spring":"toon-soft"}', setItem: () => { throw Error("denied"); } });
    let rendered = "";
    store.register("woodfish", "木鱼", (style) => { rendered = style; });
    expect(rendered).toBe("original");
    store.select("woodfish", "toon-ink");
    expect(rendered).toBe("toon-ink");
    const denied = createDebugStyles();
    expect(() => denied.enable({ getItem: () => { throw Error("denied"); }, setItem() {} })).not.toThrow();
  });
});
