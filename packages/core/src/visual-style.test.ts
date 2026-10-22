import { describe, expect, it } from "vitest";
import { createState, reduce, restore } from "./index";

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
