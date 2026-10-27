// @vitest-environment jsdom
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createState, type Wish } from "@wbr/core";
import { Context, type AppContext } from "./context";
import { SceneLibraryContext, builtInScenes } from "./scene-library";
import { WishDetail } from "./wishes";

const wish: Wish = {
  id: "w1",
  title: "希望这次面试顺利",
  intention: "",
  status: "active",
  archived: false,
  createdAt: "2026-10-07T08:00:00.000Z",
  notes: [],
};

/** An active wish's detail page, with the bundled scenes, as a parsed document. */
function renderDetail(value: Wish = wish) {
  const state = { ...createState(), wishes: [value] };
  const html = renderToStaticMarkup(
    createElement(
      Context.Provider,
      {
        value: { state, dispatch: () => true, go: () => {} } as unknown as AppContext,
      },
      createElement(
        SceneLibraryContext.Provider,
        { value: { entries: builtInScenes } as never },
        createElement(WishDetail, { id: wish.id }),
      ),
    ),
  );
  return new DOMParser().parseFromString(html, "text/html");
}

describe("a wish's detail", () => {
  const doc = renderDetail();

  it("offers no practice tiles: scenes come through a 许愿小物 on 心愿", () => {
    expect(doc.querySelector(".wish-practice-detail")).toBeNull();
    expect(doc.querySelectorAll(".practice-tile")).toHaveLength(0);
    expect(doc.querySelectorAll(".wish-practice-card")).toHaveLength(0);
  });

  it("keeps 我的心愿实现了 as its one big button", () => {
    expect([...doc.querySelectorAll(".button")].map((b) => b.textContent)).toEqual([
      "我的心愿实现了",
    ]);
  });

  it("shows the actual scene a recorded wish came from", () => {
    const detail = renderDetail({ ...wish, sourceSceneId: "tanzaku-tanabata" });
    expect(detail.querySelector(".wish-source")?.textContent).toContain("短册系竹");
    expect(detail.querySelector(".art-lantern")).toBeNull();
  });

  it("does not invent a scene for a legacy wish or unknown source", () => {
    expect(doc.querySelector(".wish-source")).toBeNull();
    const detail = renderDetail({ ...wish, sourceSceneId: "unavailable-scene" });
    expect(detail.querySelector(".wish-source")).toBeNull();
    expect(detail.querySelector(".wish-title")?.textContent).toBe(wish.title);
  });
});
