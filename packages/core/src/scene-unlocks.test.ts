import { describe, expect, it } from "vitest";
import { createState, isSceneUnlocked, reduce, restore, sceneStepCount, type State } from "./index";
import { builtInScenes } from "./daily-scenes";

const at = "2026-11-02T08:00:00.000Z";
const entry = builtInScenes.find(scene => scene.id === "tanzaku-tanabata")!;
const visit = (state = createState()) => reduce(state, { type: "scene.visit", entry, at });
const progress = (state: State, count: number) => reduce(state, { type: "scene.progress", id: entry.id, progress: count });

describe("permanent scene unlocks", () => {
  it("unlocks on the final checkpoint without claiming a keepsake or starting a wish", () => {
    const fresh = visit();
    expect(isSceneUnlocked(fresh, entry.id)).toBe(false);
    const partial = progress(fresh, sceneStepCount(entry) - 1);
    expect(isSceneUnlocked(partial, entry.id)).toBe(false);
    const complete = progress(partial, sceneStepCount(entry));
    expect(isSceneUnlocked(complete, entry.id)).toBe(true);
    expect(complete.unlockedSceneIds).toContain(entry.id);
    expect(complete.collectibles).toEqual([]);
    expect(complete.wishes).toEqual([]);
    expect(isSceneUnlocked(complete, "crane")).toBe(false);
  });

  it("keeps completion after restoring, reopening and resetting for replay", () => {
    let state = restore(JSON.stringify(progress(visit(), sceneStepCount(entry))));
    state = visit(state);
    state = progress(state, 0);
    expect(state.sceneRecords[0].progress).toBe(0);
    expect(isSceneUnlocked(restore(JSON.stringify(state)), entry.id)).toBe(true);
    state = progress(state, 1);
    expect(state.unlockedSceneIds).toEqual([entry.id]);
  });

  it("remembers old completed records before a replay reset even without a restore", () => {
    const legacy = visit();
    legacy.sceneRecords[0].progress = sceneStepCount(entry);
    expect(legacy.unlockedSceneIds).toBeUndefined();
    expect(isSceneUnlocked(progress(legacy, 0), entry.id)).toBe(true);
  });

  it("migrates old completion records, legacy sessions, and collected or spent objects", () => {
    const legacy = visit();
    legacy.sceneRecords[0].progress = sceneStepCount(entry);
    legacy.sessions.push({ id: "old-crane", ritual: "crane", progress: 4, startedAt: at, completedAt: at });
    legacy.collectibles.push({ id: "old-spent", kind: "scene", sceneId: "coconut-offering",
      title: "小物", at, wishScene: true, spentAt: at });
    legacy.collectibles.push({ id: "old-object", kind: "lantern", title: "暖心灯", at });
    const migrated = restore(JSON.stringify(legacy));
    for (const id of [entry.id, "crane", "coconut-offering", "lantern"]) {
      expect(isSceneUnlocked(migrated, id), id).toBe(true);
      expect(migrated.unlockedSceneIds).toContain(id);
    }
    expect(restore(JSON.stringify(migrated)).unlockedSceneIds).toEqual(migrated.unlockedSceneIds);
  });

  it("unlocks legacy gameplay at completion before the collect action", () => {
    let state = reduce(createState(), { type: "ritual.start", id: "crane", ritual: "crane", at });
    for (let step = 0; step < 3; step++) state = reduce(state, { type: "ritual.step" });
    expect(isSceneUnlocked(state, "crane")).toBe(false);
    state = reduce(state, { type: "ritual.step" });
    expect(isSceneUnlocked(state, "crane")).toBe(true);
    expect(state.unlockedSceneIds).toContain("crane");
    expect(state.collectibles).toEqual([]);
    expect(isSceneUnlocked(restore(JSON.stringify(state)), "crane")).toBe(true);
  });

  it("waits for explicit woodfish finish rather than treating its minimum strikes as completion", () => {
    let state = reduce(createState(), { type: "ritual.start", id: "woodfish", ritual: "woodfish", at });
    for (let strike = 0; strike < 16; strike++) state = reduce(state, { type: "ritual.step" });
    expect(isSceneUnlocked(restore(JSON.stringify(state)), "woodfish")).toBe(false);
    state = reduce(state, { type: "ritual.finish", id: "woodfish", at });
    expect(isSceneUnlocked(restore(JSON.stringify(state)), "woodfish")).toBe(true);
  });

  it("does not unlock from visits, favorites, partial progress or unrelated badges", () => {
    let state = progress(visit(), 1);
    state = reduce(state, { type: "scene.favorite", id: entry.id, favorite: true });
    state.collectibles.push({ id: "badge", kind: "badge", title: "纪念章", at });
    const restored = restore(JSON.stringify(state));
    expect(isSceneUnlocked(restored, entry.id)).toBe(false);
    expect(restored.unlockedSceneIds).toBeUndefined();
    expect(isSceneUnlocked(progress(restored, 0), entry.id)).toBe(false);
  });

  it("maps old water bowl completion checkpoints before recording the unlock", () => {
    const bowls = builtInScenes.find(scene => scene.id === "tibetan-water-bowls")!;
    const legacy = reduce(createState(), { type: "scene.visit", entry: bowls, at });
    delete legacy.sceneRecords[0].steps;
    legacy.sceneRecords[0].progress = 3;
    expect(isSceneUnlocked(restore(JSON.stringify(legacy)), bowls.id)).toBe(true);
    legacy.sceneRecords[0].progress = 2;
    expect(isSceneUnlocked(restore(JSON.stringify(legacy)), bowls.id)).toBe(false);
  });

  it.each([null, "crane", [""], [7], ["crane", "crane"]].map(value => ({ value })))("rejects corrupt persistent unlock IDs: $value", ({ value: unlockedSceneIds }) => {
    expect(() => restore(JSON.stringify({ ...createState(), unlockedSceneIds }))).toThrow();
  });
});
