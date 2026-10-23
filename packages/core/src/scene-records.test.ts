import { describe, expect, it } from "vitest";
import { createState, reduce, restore, sceneStepCount } from "./index";

const entry = {
  id: "spring",
  title: "Spring",
  engine: "spring@1",
  revision: "v1",
  manifestUrl: "https://cdn.test/spring-v1.json",
};
describe("durable scene records", () => {
  it('keeps woodfish strikes beyond its minimum through restore and clears them for a fresh visit', () => {
    const woodfish = { ...entry, id: 'woodfish', engine: 'woodfish@1' };
    let state = reduce(createState(), { type: 'scene.visit', entry: woodfish, at: '2026-10-12T00:00:00Z' });
    state = reduce(state, { type: 'scene.progress', id: woodfish.id, progress: 11, strikes: 16 });
    state = restore(JSON.stringify(state));
    state = reduce(state, { type: 'scene.visit', entry: woodfish, at: '2026-10-13T00:00:00Z' });
    expect(state.sceneRecords[0]).toMatchObject({ progress: 11, strikes: 16 });
    state = reduce(state, { type: 'scene.progress', id: woodfish.id, progress: 12 });
    expect(state.sceneRecords[0]).toMatchObject({ progress: 12, strikes: 16 });
    state = reduce(state, { type: 'scene.progress', id: woodfish.id, progress: 0 });
    expect(restore(JSON.stringify(state)).sceneRecords[0]).toMatchObject({ progress: 0, strikes: 0 });
  });
  it('keeps a legacy woodfish session open and saves every strike beyond twelve', () => {
    let state = reduce(createState(), { type: 'ritual.start', id: 'session', ritual: 'woodfish', at: '2026-10-12T00:00:00Z' });
    for (let n = 0; n < 16; n++) state = reduce(state, { type: 'ritual.step' });
    expect(restore(JSON.stringify(state)).activeSession).toMatchObject({ progress: 12, strikes: 16 });
    expect(state.collectibles).toEqual([]);
    state = reduce(state, { type: 'ritual.finish', id: 'session', at: '2026-10-13T00:00:00Z' });
    expect(restore(JSON.stringify(state)).sessions[0]).toMatchObject({ progress: 12, strikes: 16 });
    expect(state.collectibles).toHaveLength(1);
  });
  const bowls = { ...entry, id: 'tibetan-water-bowls', engine: 'tibetan-water-bowls@1' };
  it('uses the actual completion count rather than assuming three checkpoints', () => {
    expect(sceneStepCount(bowls)).toBe(9);
    expect(sceneStepCount(entry)).toBe(3);
    expect(sceneStepCount({ id: 'woodfish', engine: 'woodfish@1' })).toBe(12);
  });
  it.each([[0, 0], [1, 1], [2, 8], [3, 9]])('maps legacy bowl checkpoint %i to %i exactly once', (old, expected) => {
    const state = { ...createState(), sceneRecords: [{ ...bowls, progress: old, favorite: true, lastOpened: '2026-10-12T00:00:00Z' }] };
    const loaded = restore(JSON.stringify(state));
    expect(loaded.sceneRecords[0]).toMatchObject({ progress: expected, steps: 9, favorite: true });
    expect(restore(JSON.stringify(loaded)).sceneRecords[0].progress).toBe(expected);
    expect(reduce(state, { type: 'scene.visit', entry: bowls, at: '2026-10-13T00:00:00Z' }).sceneRecords[0].progress).toBe(expected);
  });
  it('keeps new intermediate bowl checkpoints and resets in their own scale', () => {
    let state = reduce(createState(), { type: 'scene.visit', entry: bowls, at: '2026-10-12T00:00:00Z' });
    for (const progress of [2, 3, 6, 8, 9, 0]) {
      state = reduce(state, { type: 'scene.progress', id: bowls.id, progress });
      state = restore(JSON.stringify(state));
      state = reduce(state, { type: 'scene.visit', entry: bowls, at: '2026-10-13T00:00:00Z' });
      expect(state.sceneRecords[0]).toMatchObject({ progress, steps: 9 });
    }
  });
  it("keeps a selected object variant across progress, restore and reopening", () => {
    let state = reduce(createState(), { type: "scene.visit", entry, at: "2026-10-12T00:00:00Z" });
    state = reduce(state, { type: "scene.variant", id: entry.id, variant: "hand" });
    state = reduce(state, { type: "scene.progress", id: entry.id, progress: 2 });
    state = restore(JSON.stringify(state));
    state = reduce(state, { type: "scene.visit", entry, at: "2026-10-13T00:00:00Z" });
    expect(state.sceneRecords[0]).toMatchObject({ progress: 2, variant: "hand" });
    expect(state.wishes).toHaveLength(0);
  });
  it("rejects invalid variants while accepting older records without one", () => {
    const state = reduce(createState(), { type: "scene.visit", entry, at: "2026-10-12T00:00:00Z" });
    expect(restore(JSON.stringify(state)).sceneRecords[0].variant).toBeUndefined();
    expect(() => reduce(state, { type: "scene.variant", id: entry.id, variant: "../bad" })).toThrow();
    state.sceneRecords[0].variant = "../bad";
    expect(() => restore(JSON.stringify(state))).toThrow();
  });
  it("preserves progress and favorites across repeat opens and a save restore", () => {
    let state = reduce(createState(), {
      type: "scene.visit",
      entry,
      at: "2026-09-24T00:00:00Z",
    });
    state = reduce(state, {
      type: "scene.progress",
      id: entry.id,
      progress: 2,
    });
    state = reduce(state, {
      type: "scene.favorite",
      id: entry.id,
      favorite: true,
    });
    state = restore(JSON.stringify(state));
    state = reduce(state, {
      type: "scene.visit",
      entry,
      at: "2026-09-25T00:00:00Z",
    });
    expect(state.sceneRecords).toHaveLength(1);
    expect(state.sceneRecords[0]).toMatchObject({
      progress: 2,
      favorite: true,
      revision: "v1",
    });
    expect(state.ledger).toEqual([]);
  });
  it("migrates previous saves without scene records and rejects corrupt progress", () => {
    const old = createState();
    delete (old as any).sceneRecords;
    expect(restore(JSON.stringify(old)).sceneRecords).toEqual([]);
    const state = reduce(createState(), {
      type: "scene.visit",
      entry,
      at: "2026-09-24T00:00:00Z",
    });
    expect(() =>
      reduce(state, { type: "scene.progress", id: entry.id, progress: -1 }),
    ).toThrow();
    state.sceneRecords[0].progress = NaN;
    expect(() => restore(JSON.stringify(state))).toThrow();
  });
});
