// @vitest-environment jsdom
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createState, type Wish } from "@wbr/core";
import { Context, type AppContext } from "./context";
import { SceneLibraryContext, builtInScenes } from "./scene-library";
import { WishDetail, WishNote } from "./wishes";

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
function renderDetail(value: Wish = wish, Component = WishDetail) {
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
        createElement(Component, { id: wish.id }),
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
    const record = detail.querySelector(".wish-record");
    expect(record?.querySelector(".wish-title")?.textContent).toBe(wish.title);
    expect(record?.querySelector(".scene-icon")?.getAttribute("src")).toBe("/scene-icons/soft3d/tanzaku-tanabata.webp");
    expect(record?.querySelector(".wish-source")).not.toBeNull();
    expect(record?.querySelector(".wish-meta")).not.toBeNull();
    expect(detail.querySelector(".art-lantern")).toBeNull();
  });

  it.each([
    ["active", false, "心愿进行中"],
    ["realized", false, "心愿已实现"],
    ["fulfilled", false, "心愿已如愿"],
    ["active", true, "心愿休息中"],
  ] as const)("uses the %s status as the page title (archived: %s)", (status, archived, title) => {
    const detail = renderDetail({ ...wish, status, archived });
    expect(detail.querySelector("h1")?.textContent).toBe(title);
    expect(detail.querySelector(".status-pill")).toBeNull();
  });

  it("does not invent a scene for a legacy wish or unknown source", () => {
    expect(doc.querySelector(".wish-source")).toBeNull();
    const detail = renderDetail({ ...wish, sourceSceneId: "unavailable-scene" });
    expect(detail.querySelector(".wish-source")).toBeNull();
    expect(detail.querySelector(".wish-title")?.textContent).toBe(wish.title);
  });

  it.each(["active", "realized"] as const)("shows kindness for an unfinished legacy ritual plan (%s)", status => {
    const detail = renderDetail({ ...wish, status, returnMethod: "ritual" });
    expect(detail.querySelector(".return-summary")?.textContent).toBe("实现后：做一件小善事");
  });

  it("preserves the actual method of a historically fulfilled ritual wish", () => {
    const detail = renderDetail({ ...wish, status: "fulfilled", returnMethod: "ritual" });
    expect(detail.querySelector(".return-summary")?.textContent).toBe("已还愿：完成一个小仪式");
  });

  it("shows the original ritual badge inline after fulfillment, without another badge-page button", () => {
    const detail = renderDetail({ ...wish, status: "fulfilled", fulfilledAt: wish.createdAt, sourceSceneId: "tanzaku-tanabata" });
    expect(detail.querySelector(".wish-keepsake .badge-medallion img")?.getAttribute("src")).toBe("/scene-icons/soft3d/tanzaku-tanabata.webp");
    expect(detail.querySelector(".wish-keepsake h2")?.textContent).toBe("如愿纪念章");
    expect([...detail.querySelectorAll("button")].some(button => button.textContent?.includes("看看我的"))).toBe(false);
    expect(doc.querySelector(".wish-keepsake")).toBeNull();
  });

  it("closes effort recording after fulfillment and keeps existing notes readable", () => {
    const detail = renderDetail({ ...wish, status: "fulfilled", notes: [{ id: "n1", text: "每天练习", at: wish.createdAt }] });
    expect(detail.querySelector(".effort-card h2")?.textContent).toBe("我为这个愿望努力过");
    expect(detail.querySelector(".effort-card .small-button")).toBeNull();
    expect(detail.querySelector(".note-preview p")?.textContent).toBe("每天练习");
  });

  it("does not expose a note editor through a stale route after fulfillment", () => {
    const detail = renderDetail({ ...wish, status: "fulfilled" }, WishNote);
    expect(detail.querySelector("textarea, form")).toBeNull();
    expect(detail.querySelector(".wish-keepsake")).not.toBeNull();
    expect(detail.querySelector(".empty-note")?.textContent).toBe("没有留下努力记录。");
  });
});
