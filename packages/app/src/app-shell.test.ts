// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { BlessingApp } from "./App";
import { createState } from '@wbr/core';
import { clickOn, renderUI, settle } from "./dom-test-utils";

const elementScrollTo = HTMLElement.prototype.scrollTo;
afterEach(() => {
  HTMLElement.prototype.scrollTo = elementScrollTo;
  vi.restoreAllMocks();
});

it("opens a new page at the top of the shell, which scrolls inside the desktop frame", async () => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const shellScrolls: unknown[][] = [];
  HTMLElement.prototype.scrollTo = function (this: HTMLElement, ...args: unknown[]) {
    if (this.classList.contains("app-shell")) shellScrolls.push(args);
  } as typeof HTMLElement.prototype.scrollTo;
  const ui = renderUI(
    createElement(BlessingApp, {
      host: { read: async () => JSON.stringify(createState()), write: async () => {} },
    }),
  );
  await settle();
  const tab = [...ui.host.querySelectorAll(".bottom-nav button")].find((b) =>
    b.textContent?.includes("心愿"),
  )!;
  clickOn(tab);
  expect(shellScrolls).toEqual([[0, 0]]);
  expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  ui.unmount();
});

it("uses one shared title and supporting line on regular pages", async () => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const ui = renderUI(
    createElement(BlessingApp, {
      host: { read: async () => JSON.stringify(createState()), write: async () => {} },
    }),
  );
  await settle();
  const ribbon = () => ui.host.querySelector(".app-topbar .title-ribbon")?.textContent ?? null;
  const tap = (selector: string, text: string) =>
    clickOn(
      [...ui.host.querySelectorAll(selector)].find((el) =>
        el.textContent?.includes(text),
      )!,
    );
  tap(".bottom-nav button", "我的");
  await settle();
  // The back button shares the title row, without a second title above it.
  for (const row of ["场景目录", "资源缓存", "仪式时光"]) {
    tap(".settings-row", row);
    await settle();
    expect(ribbon(), row).toBeNull();
    expect(ui.host.querySelector(".app-content h1")?.textContent, row).toBe(row);
    expect(ui.host.querySelectorAll('h1')).toHaveLength(1);
    const heading = ui.host.querySelector('.page-heading')!;
    expect(heading.firstElementChild?.querySelector('h1')?.textContent).toBe(row);
    expect(heading.lastElementChild?.className).toBe('page-tagline');
    clickOn(ui.host.querySelector(".back-button")!);
    await settle();
  }
  tap(".bottom-nav button", "心愿");
  await settle();
  clickOn(ui.host.querySelector('.round-button[aria-label="许个心愿"]')!);
  await settle();
  expect(ribbon()).toBeNull();
  expect(ui.host.querySelector('.page-heading h1')?.textContent).toBe('许个小心愿');
  ui.unmount();
});

it("marks every dock tab with data-tab, so reward flights can land on one", async () => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const ui = renderUI(
    createElement(BlessingApp, {
      host: { read: async () => JSON.stringify(createState()), write: async () => {} },
    }),
  );
  await settle();
  expect(
    [...ui.host.querySelectorAll(".bottom-nav button")].map(
      (b) => b.dataset.tab,
    ),
  ).toEqual(["today", "wishes", "world", "me"]);
  ui.unmount();
});
