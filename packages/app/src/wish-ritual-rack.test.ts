// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createState, type Collectible, type State } from "@wbr/core";
import { Context, type AppContext } from "./context";
import { clickOn, renderUI } from "./dom-test-utils";
import { Wishes } from "./pages";
import { SceneLibraryContext, builtInScenes } from "./scene-library";

const AT = "2026-10-27T08:00:00.000Z";
const mounted: ReturnType<typeof renderUI>[] = [];
afterEach(() => mounted.splice(0).forEach(ui => ui.unmount()));
function keepsake(id: string, sceneId: string, spent = false): Collectible {
  return { id, kind: "scene", title: sceneId, sceneId, wishScene: true, at: AT,
    ...(spent ? { spentAt: AT } : {}) };
}
function open(state: State) {
  const go = vi.fn(), dispatch = vi.fn((_action: unknown) => true);
  const ui = renderUI(createElement(Context.Provider,
    { value: { state, go, dispatch } as unknown as AppContext },
    createElement(SceneLibraryContext.Provider,
      { value: { entries: builtInScenes } as never }, createElement(Wishes))));
  mounted.push(ui);
  return { ...ui, go, dispatch };
}
function item(ui: ReturnType<typeof open>, id: string) {
  return ui.host.querySelector<HTMLButtonElement>(`.wish-rack-item[data-collectible-id="${id}"]`)!;
}

describe("collected prayer rituals on the wish rack", () => {
  it("shows acquired prayer objects and puts unused objects before used ones", () => {
    const state = createState();
    state.collectibles = [keepsake("used", "tanzaku-tanabata", true), keepsake("unused", "crane"),
      { ...keepsake("blessing", "woodfish"), wishScene: false },
      { id: "badge", kind: "badge", title: "如愿", at: AT },
      keepsake("hidden", "lantern")];
    const ui = open(state);
    expect([...ui.host.querySelectorAll(".wish-rack-item")].map(el => el.getAttribute("data-collectible-id"))).toEqual(["unused", "used"]);
    expect(item(ui, "unused").dataset.rackStatus).toBe("unused");
    expect(item(ui, "used").dataset.rackStatus).toBe("used");
    expect(ui.host.querySelector(".wish-rack-count")?.textContent).toBe("1 个未用");
    expect(item(ui, "unused").textContent).toContain("折一只纸鹤");
  });
  it("opens the exact unused vessel without spending it or creating a wish on click", () => {
    const state = createState();
    state.collectibles = [keepsake("unused", "crane")];
    const ui = open(state);
    clickOn(item(ui, "unused"));
    expect(ui.go).toHaveBeenCalledWith(expect.objectContaining({ page: "scene", id: "crane", vessel: "unused" }));
    expect(state.collectibles[0].spentAt).toBeUndefined();
    expect(ui.dispatch.mock.calls.some(([a]) => ["collectible.spend", "wish.create"].includes((a as {type:string}).type))).toBe(false);
  });
  it("shows used and non-writing acquired objects through their own collection details", () => {
    const state = createState();
    state.collectibles = [keepsake("used", "crane", true), keepsake("no-writing", "alasita-miniature-house")];
    const ui = open(state);
    clickOn(item(ui, "used"));
    expect(ui.go).toHaveBeenLastCalledWith({ page: "collection", id: "used" });
    clickOn(item(ui, "no-writing"));
    expect(ui.go).toHaveBeenLastCalledWith({ page: "collection", id: "no-writing" });
    expect(item(ui, "no-writing").dataset.rackStatus).toBe("unused");
  });
  it("continues a spent old draft before other objects without clearing its text or progress", () => {
    const state = createState();
    state.collectibles = [keepsake("unused", "crane"), keepsake("pending", "alasita-miniature-house", true)];
    state.vesselDrafts = { pending: { line: "愿家人平安", at: AT } };
    const ui = open(state);
    expect(ui.host.querySelector(".wish-rack-item")?.getAttribute("data-collectible-id")).toBe("pending");
    expect(item(ui, "pending").dataset.rackStatus).toBe("pending");
    clickOn(item(ui, "pending"));
    expect(ui.go).toHaveBeenCalledWith(expect.objectContaining({ page: "scene", vessel: "pending" }));
    expect(ui.dispatch).not.toHaveBeenCalled();
    expect(state.vesselDrafts.pending.line).toBe("愿家人平安");
  });
  it("keeps same-scene copies separate and reveals the remaining collection on demand", () => {
    const state = createState();
    state.collectibles = [keepsake("a", "crane", true), keepsake("b", "crane"), keepsake("c", "tanzaku-tanabata"), keepsake("d", "daruma-eye-painting")];
    const ui = open(state);
    expect(ui.host.querySelectorAll(".wish-rack-item")).toHaveLength(3);
    clickOn(ui.host.querySelector(".wish-rack-toggle")!);
    expect(ui.host.querySelectorAll(".wish-rack-item")).toHaveLength(4);
    expect(item(ui, "a").dataset.rackStatus).toBe("used");
    expect(item(ui, "b").dataset.rackStatus).toBe("unused");
  });
  it("leaves no empty showcase when the user has not acquired a prayer object", () => {
    const ui = open(createState());
    expect(ui.host.querySelector(".wish-ritual-rack")).toBeNull();
    expect(ui.host.querySelectorAll(".pray-button")).toHaveLength(1);
  });
});
