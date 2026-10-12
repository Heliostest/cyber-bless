import { describe, expect, it } from "vitest";
import { createState, reduce, restore } from "./index";

const entry = {
  id: "spring",
  title: "Spring",
  engine: "spring@1",
  revision: "v1",
  manifestUrl: "https://cdn.test/spring-v1.json",
};
describe("durable scene records", () => {
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
