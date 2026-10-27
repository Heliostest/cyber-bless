import { describe, expect, it } from "vitest";
import { createState, reduce, restore } from "./index";
import { getSceneVisualPreference, normalizeStyleParameters } from "./visual-style";

describe("saved per-ritual visual preferences", () => {
  it("keeps preferences independent from progress and other rituals, across a host save", () => {
    const before = createState();
    const tea = reduce(before, { type: "scene.visual", id: "blang-tea", style: "moebius", parameters: { hatchStrength: 0.2 } });
    const both = reduce(tea, { type: "scene.visual", id: "crane", style: "pixel-art", parameters: { pixelSize: 8 } });
    const restored = restore(JSON.stringify(both));
    expect(restored.visualStyles?.["blang-tea"]).toMatchObject({ style: "moebius", parameters: { hatchStrength: 0.2 } });
    expect(restored.visualStyles?.crane).toMatchObject({ style: "pixel-art", parameters: { pixelSize: 8 } });
    expect(restored.sceneRecords).toEqual(before.sceneRecords);
    expect(restored.collectibles).toEqual(before.collectibles);
    const reset = reduce(restored, { type: "scene.visual", id: "blang-tea", style: null });
    expect(reset.visualStyles?.["blang-tea"]).toBeUndefined();
    expect(reset.visualStyles?.crane).toEqual(restored.visualStyles?.crane);
  });

  it("accepts old saves and discards only corrupt optional preferences", () => {
    const legacy = createState();
    expect(restore(JSON.stringify(legacy)).visualStyles ?? {}).toEqual({});
    const repaired = restore(JSON.stringify({ ...legacy, visualStyles: {
      tea: { style: "halftone", parameters: { halftoneSize: 500, halftoneStrength: "bad" } },
      crane: { style: "future-style", parameters: {} },
      bad: null,
    } }));
    expect(repaired.visualStyles?.tea).toMatchObject({ style: "halftone", parameters: { halftoneSize: 16, halftoneStrength: 0.58 } });
    expect(Object.keys(repaired.visualStyles ?? {})).toEqual(["tea"]);
    expect(repaired.wishes).toEqual(legacy.wishes);
  });

  it("bounds live values, preserves other effect parameters and rejects invalid style choices", () => {
    expect(reduce(createState(), { type: "scene.visual", id: "remote.Scene@2", style: "original" }).visualStyles?.["remote.Scene@2"].style).toBe("original");
    const state = reduce(createState(), { type: "scene.visual", id: "tea", style: "pixel-art", parameters: { pixelSize: 5 } });
    const changed = reduce(state, { type: "scene.visual", id: "tea", style: "moebius", parameters: { moebiusWidth: NaN, moebiusLevels: 500 } });
    expect(changed.visualStyles?.tea.parameters).toMatchObject({ pixelSize: 5, moebiusWidth: 0.85, moebiusLevels: 12 });
    expect(() => reduce(state, { type: "scene.visual", id: "tea", style: "remote-code" as never })).toThrow();
  });
});

describe("visual preferences applied to every ritual", () => {
  it("replaces existing overrides and persists a default for rituals not opened yet", () => {
    const before = reduce(createState(), { type: "scene.visual", id: "crane", style: "pixel-art", parameters: { pixelSize: 8 } });
    const all = reduce(before, { type: "scene.visual.all", style: "moebius", parameters: { hatchStrength: 0.2 } });
    expect(all).toMatchObject({ globalVisualStyle: { style: "moebius", parameters: { hatchStrength: 0.2 } }, visualStyles: {} });
    expect(all.wishes).toBe(before.wishes);
    expect(all.sceneRecords).toBe(before.sceneRecords);
    expect(all.collectibles).toBe(before.collectibles);
    const restored = restore(JSON.stringify(all));
    expect(getSceneVisualPreference(restored, "not-opened-yet")).toMatchObject({ style: "moebius", parameters: { hatchStrength: 0.2 } });
  });

  it("lets one ritual override the global choice and follows it again after removing the override", () => {
    const globalVisualStyle = { style: "halftone" as const, parameters: normalizeStyleParameters({ halftoneSize: 7 }) };
    const all = { ...createState(), globalVisualStyle };
    const local = reduce(all, { type: "scene.visual", id: "crane", style: "pixel-art", parameters: { pixelSize: 6 } });
    expect(getSceneVisualPreference(local, "crane")).toMatchObject({ style: "pixel-art", parameters: { pixelSize: 6 } });
    expect(getSceneVisualPreference(local, "woodfish")).toEqual(globalVisualStyle);
    const reset = reduce(local, { type: "scene.visual", id: "crane", style: null });
    expect(getSceneVisualPreference(reset, "crane")).toEqual(globalVisualStyle);
    expect(getSceneVisualPreference(createState(), "crane")).toBeUndefined();
  });

  it("restores content defaults everywhere by clearing the global choice and every override", () => {
    const localOnly = reduce(createState(), { type: "scene.visual", id: "crane", style: "pixel-art" });
    const withGlobal = { ...localOnly, globalVisualStyle: { style: "moebius" as const, parameters: normalizeStyleParameters(undefined) } };
    for (const before of [localOnly, withGlobal]) {
      const reset = reduce(before, { type: "scene.visual.all", style: null });
      expect(reset).toMatchObject({ visualStyles: {} });
      expect(reset.globalVisualStyle).toBeUndefined();
      expect(getSceneVisualPreference(reset, "crane")).toBeUndefined();
      expect(reduce(reset, { type: "scene.visual.all", style: null })).toBe(reset);
    }
  });

  it("normalizes global parameters, preserves other effect controls and rejects unknown styles", () => {
    const all = reduce(createState(), { type: "scene.visual.all", style: "pixel-art", parameters: { pixelSize: 50 } });
    expect(all).toMatchObject({ globalVisualStyle: { style: "pixel-art", parameters: { pixelSize: 12 } } });
    const changed = reduce(all, { type: "scene.visual.all", style: "moebius", parameters: { moebiusWidth: NaN, moebiusLevels: 500 } });
    expect(changed.globalVisualStyle?.parameters).toMatchObject({ pixelSize: 12, moebiusWidth: 0.85, moebiusLevels: 12 });
    expect(() => reduce(all, { type: "scene.visual.all", style: "remote-code" as never })).toThrow();
    expect(reduce(changed, { type: "scene.visual.all", ...changed.globalVisualStyle! })).toBe(changed);
  });

  it("repairs a global preference without rejecting an otherwise valid legacy save", () => {
    const before = reduce(createState(), { type: "scene.visual", id: "crane", style: "pixel-art" });
    const repaired = restore(JSON.stringify({ ...before, globalVisualStyle: {
      style: "halftone", parameters: { halftoneSize: 500, halftoneStrength: "bad" },
    } }));
    expect(repaired.globalVisualStyle).toMatchObject({ style: "halftone", parameters: { halftoneSize: 16, halftoneStrength: 0.58 } });
    expect(repaired.visualStyles?.crane.style).toBe("pixel-art");
    for (const globalVisualStyle of [null, [], "bad", { style: "future-style" }]) {
      const restored = restore(JSON.stringify({ ...before, globalVisualStyle }));
      expect(restored.globalVisualStyle).toBeUndefined();
      expect(restored.visualStyles).toEqual(before.visualStyles);
      expect(restored.wishes).toEqual(before.wishes);
    }
    expect(restore(JSON.stringify(createState())).globalVisualStyle).toBeUndefined();
  });
});
