// @vitest-environment jsdom
import { act, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createState,
  dailyCollectibleId,
  localDay,
  reduce,
  type State,
} from "@wbr/core";
import type { CatalogEntry } from "@wbr/content/catalog";
import type { HapticStrength } from "@wbr/runtime";
import { assertSafeCopy } from "@wbr/shared";
import { BlessingApp } from "./App";
import { Context, type AppContext } from "./context";
import { HISTORY_SCENE_LINE } from "./pages";
import {
  SCENE_DAILY_CAPTION,
  SCENE_DAILY_CTA,
  SCENE_DISCARD_CTA,
  SCENE_DISCARDED_COPY,
  SCENE_DONE_COPY,
  SCENE_DONE_CTA,
  SCENE_DONE_WISH_CTA,
  SCENE_KEEP_CTA,
  SCENE_KEEP_QUESTION,
  SCENE_RETURN_CTA,
  SCENE_RETURN_DONE_COPY,
  SCENE_VESSEL_DONE_COPY,
  sceneDailyAnnounce,
  sceneDailyDoneCopy,
} from "./scene-experience";
import {
  SceneLibraryContext,
  builtInScenes,
  useOpenScene,
  useOpenRitual,
} from "./scene-library";
import { dailyPrimaryScene, isWishScene } from "./scene-placement";
import { FULFILL_VESSEL_COPY, VESSEL_COPY } from "./vessels";
import { clickOn, renderUI, settle, typeInto } from "./dom-test-utils";

// The 3D scenes are not under test: keep the context the last one was given.
type Given = {
  progress?: number;
  deferWishWriting?: boolean;
  checkpoint?(n: number): void;
  saveWish?(text: string): void;
  haptic?(strength?: HapticStrength): void;
};
const scene = vi.hoisted(() => ({ context: undefined as Given | undefined }));
vi.mock("@wbr/scene-runtime", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@wbr/scene-runtime")>()),
  mountScene: (config: { context: Given; ready(): void }) => {
    scene.context = config.context;
    queueMicrotask(() => config.ready());
    const lifecycle = { setActive() {}, setReducedMotion() {}, dispose() {} };
    return {
      ...lifecycle,
      initialized: Promise.resolve(),
      controller: {
        ...lifecycle,
        strike() {},
        whenIdle: () => Promise.resolve(),
        movePointer() {},
        stopFollowing() {},
        inspect() {},
      },
    };
  },
}));

const AT = "2026-10-05T08:00:00.000Z";
const DAY = localDay();
const entryOf = (id: string) => builtInScenes.find((e) => e.id === id)!;

/** `state` with each named scene's record saved `progress` steps in. */
function withRecords(progress: Record<string, number>, state = createState()) {
  return {
    ...state,
    sceneRecords: Object.entries(progress).map(([id, n]) => {
      const { title, engine, revision, manifestUrl } = entryOf(id);
      return {
        id,
        title,
        engine,
        revision,
        manifestUrl,
        progress: n,
        favorite: false,
        lastOpened: AT,
      };
    }),
  };
}
/** A save holding w1, 面试顺利, already realized. */
function withRealizedWish(returnMethod: "kindness" | "ritual" = "ritual") {
  const state = reduce(createState(), {
    type: "wish.create",
    id: "w1",
    title: "面试顺利",
    intention: "",
    returnMethod,
    at: AT,
  });
  return reduce(state, { type: "wish.realize", id: "w1", at: AT });
}
/** One collected daily keepsake for `sceneId`, spent for a wish when `spent`. */
function keepsake(sceneId: string, day: string, spent?: string) {
  return {
    id: dailyCollectibleId(day, sceneId),
    kind: "scene" as const,
    title: entryOf(sceneId).title,
    at: `${day}T08:00:00.000Z`,
    sceneId,
    ...(isWishScene(sceneId) ? { wishScene: true } : {}),
    ...(spent ? { spentAt: spent } : {}),
  };
}

beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
  scene.context = undefined;
});

/** The App on a memory host, loaded to 今日; `saved()` reads its last save. */
async function openApp(state: State) {
  let raw = JSON.stringify(state);
  const host = {
    read: async () => raw,
    haptic: vi.fn(async (_strength?: HapticStrength) => {}),
    write: async (next: string) => {
      raw = next;
    },
  };
  const ui = renderUI(createElement(BlessingApp, { host }));
  await settle();
  const all = (selector: string) => [...ui.host.querySelectorAll(selector)];
  return {
    ...ui,
    haptic: host.haptic,
    saved: async () => {
      await settle();
      return JSON.parse(raw) as State;
    },
    page: () => ui.host.querySelector<HTMLElement>(".app-shell")!.dataset.page,
    sceneTitle: () => ui.host.querySelector(".app-topbar .title-ribbon")?.textContent,
    sceneProgress: () => ui.host.querySelector(".scene-progress")?.textContent,
    doneButtons: () =>
      all(".scene-done-row button:not(.favorite-chip)").map((b) => b.textContent),
    /** The first button whose text includes `text`. */
    button: (text: string, within = "") =>
      all(`${within} button`).find((b) => b.textContent?.includes(text))!,
    /** Taps `el`, then lets the page that opens settle. */
    async tap(el: Element) {
      clickOn(el);
      await settle();
    },
    /** Walks the open procedural scene to its last step. */
    async walk() {
      for (const n of [1, 2, 3]) act(() => scene.context!.checkpoint!(n));
      await settle();
    },
  };
}

describe("今日's daily set", () => {
  // A day whose main walk is a 许愿 scene, walked by its three checkpoints;
  // the App reads the day off the clock, so the clock is set to it.
  const WISH_DAY = Array.from(
    { length: 28 },
    (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}`,
  ).find((d) => isWishScene(dailyPrimaryScene(builtInScenes, d)!.id))!;
  const sceneId = dailyPrimaryScene(builtInScenes, WISH_DAY)!.id;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${WISH_DAY}T12:00:00`));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("collects the day's keepsake once: a walk, a sticker, a flight to 小天地", async () => {
    const ui = await openApp(createState());
    const card = ui.host.querySelector(
      `.daily-set-primary[data-scene="${sceneId}"]`,
    )!;
    await ui.tap(card);
    expect(ui.page()).toBe("scene");
    expect(ui.sceneTitle()).toBe(entryOf(sceneId).title);
    expect(ui.host.querySelector(".scene-experience h1")).toBeNull();
    expect(ui.host.querySelector('.scene-progress')?.classList.contains('sr-only')).toBe(true);
    expect(ui.host.querySelector(".scene-caption")?.textContent).toBe(
      SCENE_DAILY_CAPTION,
    );
    const favorite = ui.host.querySelector(".favorite-chip")!;
    expect(favorite.getAttribute("aria-pressed")).toBe("false");
    await ui.tap(favorite);
    expect(favorite.getAttribute("aria-pressed")).toBe("true");

    await ui.walk();
    expect(ui.host.querySelector(".scene-done")?.textContent).toBe(
      sceneDailyDoneCopy(entryOf(sceneId).title),
    );
    expect(ui.doneButtons()).toEqual([SCENE_DAILY_CTA]);
    const collectedFavorite = ui.button(SCENE_DAILY_CTA, ".scene-completion-actions")
      ?.parentElement?.querySelector(".favorite-chip");
    expect(collectedFavorite).toBeTruthy();
    expect(collectedFavorite?.getAttribute("aria-pressed")).toBe("true");
    expect(ui.host.querySelectorAll(".favorite-chip")).toHaveLength(1);
    await ui.tap(collectedFavorite!);
    expect((await ui.saved()).sceneRecords.find(r => r.id === sceneId)?.favorite).toBe(false);
    expect(
      ui.host.querySelector("[data-reward-sticker] .scene-art"),
    ).not.toBeNull();

    await ui.tap(ui.button(SCENE_DAILY_CTA, ".scene-done-row"));
    expect(ui.page()).toBe("world");
    // The sticker landed on its new shelf slot.
    expect(
      ui.host.querySelector(
        `[data-collectible-id="${dailyCollectibleId(WISH_DAY, sceneId)}"]`,
      ),
    ).not.toBeNull();
    const saved = await ui.saved();
    expect(saved.collectibles).toHaveLength(1);
    expect(saved.collectibles[0]).toMatchObject({
      id: dailyCollectibleId(WISH_DAY, sceneId),
      kind: "scene",
      sceneId,
      wishScene: true,
    });
    expect(saved.ledger).toEqual([]);
    ui.unmount();
  });

  it("toggles feedback from the scene header and preserves it when another scene opens", async () => {
    const ui = await openApp(createState());
    await ui.tap(ui.host.querySelector(`.daily-set-primary[data-scene="${sceneId}"]`)!);
    const sound = ui.host.querySelector('.app-topbar button[aria-label="音效"]')!;
    const haptics = ui.host.querySelector('.app-topbar button[aria-label="震动"]')!;
    expect(sound).not.toBeNull();
    expect(haptics).not.toBeNull();
    const enabledIcon = sound.querySelector('svg')!.innerHTML;
    await ui.tap(sound);
    await ui.tap(haptics);
    expect(sound.getAttribute('aria-pressed')).toBe('false');
    expect(sound.querySelector('svg')!.innerHTML).not.toBe(enabledIcon);
    expect(ui.host.querySelector('.scene-experience .feedback-controls')).toBeNull();
    expect((await ui.saved()).settings).toMatchObject({ sound: false, haptics: false });
    await ui.tap(ui.host.querySelector('.back-button')!);
    await ui.tap(ui.host.querySelector(`.daily-set-primary[data-scene="${sceneId}"]`)!);
    expect(ui.host.querySelector('.app-topbar button[aria-label="音效"]')!.getAttribute('aria-pressed')).toBe('false');
    ui.unmount();
  });

  it("forwards each scene impact strength and reads the haptics toggle live", async () => {
    const ui = await openApp(createState());
    await ui.tap(ui.host.querySelector(`.daily-set-primary[data-scene="${sceneId}"]`)!);
    const haptics = ui.host.querySelector('.app-topbar button[aria-label="震动"]')!;
    const haptic = scene.context!.haptic!;
    for (const strength of ["light", "medium", "heavy"] as const) haptic(strength);
    haptic();
    expect(ui.haptic.mock.calls).toEqual([["light"], ["medium"], ["heavy"], [undefined]]);

    await ui.tap(haptics);
    ui.haptic.mockClear();
    haptic("heavy");
    haptic();
    expect(ui.haptic).not.toHaveBeenCalled();

    await ui.tap(haptics);
    haptic("medium");
    expect(ui.haptic).toHaveBeenCalledExactlyOnceWith("medium");
    ui.unmount();
  });

  it("settles the day only once: a second walk of the same scene collects nothing", async () => {
    const ui = await openApp(createState());
    await ui.tap(ui.host.querySelector(`.daily-set-primary[data-scene="${sceneId}"]`)!);
    await ui.walk();
    await ui.tap(ui.button(SCENE_DAILY_CTA, ".scene-done-row"));
    await ui.tap(ui.host.querySelector('[data-tab="today"]')!);
    const card = ui.host.querySelector(`.daily-set-primary[data-scene="${sceneId}"]`)!;
    expect(card.querySelector("small")!.textContent!.trim()).toBe("今天已收下");
    // Today's keepsake joins the picks from 小天地 tomorrow, not today.
    expect(ui.host.querySelector(".daily-collected .daily-set-card")).toBeNull();
    await ui.tap(card);
    // A flagged visit starts the scene over.
    expect(ui.sceneProgress()).toBe("已完成 0 / 3");
    await ui.walk();
    expect(ui.host.querySelector(".scene-complete-status")?.textContent).toBe(
      SCENE_DONE_COPY,
    );
    expect(ui.doneButtons()).toEqual([SCENE_DONE_CTA]);
    const saved = await ui.saved();
    expect(saved.collectibles).toHaveLength(1);
    expect(saved.ledger).toEqual([]);
    ui.unmount();
  });

  it("keeps a half-walked 主仪式's steps when 今日 is left and re-entered", async () => {
    const ui = await openApp(createState());
    await ui.tap(ui.host.querySelector(`.daily-set-primary[data-scene="${sceneId}"]`)!);
    expect(ui.sceneProgress()).toBe("已完成 0 / 3");
    act(() => scene.context!.checkpoint!(1));
    await settle();
    await ui.tap(ui.host.querySelector(".back-button")!);
    expect(ui.page()).toBe("today");
    await ui.tap(ui.host.querySelector(`.daily-set-primary[data-scene="${sceneId}"]`)!);
    // The daily set resumes its own half-walked scene, the same as an entry
    // from 场景目录 would: the flag no longer silently zeroes the steps.
    expect(ui.sceneProgress()).toBe("已完成 1 / 3");
    expect(scene.context?.progress).toBe(1);
    ui.unmount();
  });

  it("settles the day's keepsake when the 主仪式 is finished from 场景目录", async () => {
    const ui = await openApp(createState());
    await ui.tap(ui.host.querySelector(`.daily-set-primary[data-scene="${sceneId}"]`)!);
    act(() => scene.context!.checkpoint!(1));
    await settle();
    await ui.tap(ui.host.querySelector(".back-button")!);
    // The same scene, continued from 我的 › 场景目录 — no daily flag this time.
    await ui.tap(ui.host.querySelector('[data-tab="me"]')!);
    await ui.tap(ui.button("场景目录", ".settings-card"));
    if (!ui.host.querySelector(`.scene-card[data-scene="${sceneId}"]`)) {
      while (!ui.host.querySelector('.scene-catalog .scene-card[data-scene="crane"]')) {
      await ui.tap(ui.button("显示更多"));
    }
    }
    await ui.tap(
      ui.host.querySelector(`.scene-catalog .scene-card[data-scene="${sceneId}"]`)!,
    );
    expect(ui.sceneProgress()).toBe("已完成 1 / 3");
    await ui.walk();
    // The walk counts for today, whichever entry finished it (仪式时光's scene
    // cards land here too: the same unflagged open).
    expect(ui.host.querySelector(".scene-done")?.textContent).toBe(
      sceneDailyDoneCopy(entryOf(sceneId).title),
    );
    expect(ui.doneButtons()).toEqual([SCENE_DAILY_CTA]);
    const saved = await ui.saved();
    expect(saved.collectibles).toHaveLength(1);
    expect(saved.collectibles[0]).toMatchObject({
      id: dailyCollectibleId(WISH_DAY, sceneId),
      sceneId,
      wishScene: true,
    });
    expect(saved.ledger).toEqual([]);
    // 收下它 flies the sticker into 小天地; 今日 knows the walk is collected.
    await ui.tap(ui.button(SCENE_DAILY_CTA, ".scene-done-row"));
    expect(ui.page()).toBe("world");
    await ui.tap(ui.host.querySelector('[data-tab="today"]')!);
    const card = ui.host.querySelector(`.daily-set-primary[data-scene="${sceneId}"]`)!;
    expect(card.querySelector("small")!.textContent!.trim()).toBe("今天已收下");
    ui.unmount();
  });

  it("settles the day only once when the 主仪式 is finished again from the catalog", async () => {
    // Already collected today, and the record stands done.
    const state = withRecords({ [sceneId]: 3 });
    state.collectibles.push(keepsake(sceneId, WISH_DAY));
    const ui = await openApp(state);
    await ui.tap(ui.host.querySelector('[data-tab="me"]')!);
    await ui.tap(ui.button("场景目录", ".settings-card"));
    if (!ui.host.querySelector(`.scene-card[data-scene="${sceneId}"]`)) {
      while (!ui.host.querySelector('.scene-catalog .scene-card[data-scene="crane"]')) {
      await ui.tap(ui.button("显示更多"));
    }
    }
    await ui.tap(
      ui.host.querySelector(`.scene-catalog .scene-card[data-scene="${sceneId}"]`)!,
    );
    expect(ui.sceneProgress()).toBe("已完成 0 / 3");
    await ui.walk();
    // A finished-again walk settles nothing further, and says so plainly.
    expect(ui.host.querySelector(".scene-complete-status")?.textContent).toBe(
      SCENE_DONE_COPY,
    );
    expect(ui.doneButtons()).toEqual([SCENE_DONE_CTA]);
    const saved = await ui.saved();
    expect(saved.collectibles).toHaveLength(1);
    expect(saved.ledger).toHaveLength(0);
    ui.unmount();
  });

  it("collects nothing when today's 主仪式 is walked again as a 回看", async () => {
    // The day's main scene, kept from an earlier day, sits in today's picks.
    const state = createState();
    state.collectibles.push(keepsake(sceneId, "2026-09-30"));
    const ui = await openApp(state);
    await ui.tap(
      ui.host.querySelector(`.daily-collected [data-scene="${sceneId}"]`)!,
    );
    expect(ui.host.querySelector(".scene-caption")).toBeNull();
    await ui.walk();
    expect(ui.host.querySelector(".scene-complete-status")?.textContent).toBe(
      SCENE_DONE_COPY,
    );
    const saved = await ui.saved();
    expect(saved.collectibles).toHaveLength(1);
    expect(saved.ledger).toEqual([]);
    ui.unmount();
  });

  it("walks a pick from 小天地 again as a 回看: nothing collected, nothing spent", async () => {
    const kept = [
      keepsake("tanzaku-tanabata", "2026-09-30"),
      keepsake("furin-wind-chime", "2026-09-29"),
      keepsake("shinto-torii", "2026-09-28"),
    ];
    const ui = await openApp({ ...createState(), collectibles: kept });
    const picks = [...ui.host.querySelectorAll(".daily-collected .daily-set-card")];
    expect(picks.map((c) => c.getAttribute("data-scene")).sort()).toEqual(
      ["furin-wind-chime", "shinto-torii", "tanzaku-tanabata"],
    );
    await ui.tap(
      ui.host.querySelector('.daily-collected [data-scene="tanzaku-tanabata"]')!,
    );
    expect(ui.page()).toBe("scene");
    expect(ui.sceneTitle()).toBe(entryOf("tanzaku-tanabata").title);
    // Not the day's walk: no daily caption, and the plain done row.
    expect(ui.host.querySelector(".scene-caption")).toBeNull();
    await ui.walk();
    expect(ui.host.querySelector(".scene-complete-status")?.textContent).toBe(
      SCENE_DONE_COPY,
    );
    expect(ui.doneButtons()).toEqual([SCENE_DONE_CTA]);
    const saved = await ui.saved();
    expect(saved.collectibles).toEqual(kept);
    expect(saved.ledger).toEqual([]);
    ui.unmount();
  });

  it("leaves the resume banner on the 2D page, for a session begun there", async () => {
    const ui = await openApp({
      ...createState(),
      activeSession: { id: "s1", ritual: "crane", progress: 1, startedAt: AT },
    });
    await ui.tap(ui.host.querySelector(".resume-banner")!);
    expect(ui.page()).toBe("ritual");
    ui.unmount();
  });
});

describe("许愿 through a keepsake", () => {
  async function openVessel(sceneId: string, state = createState()) {
    state.collectibles.push(keepsake(sceneId, "2026-10-05"));
    const ui = await openApp(state);
    await ui.tap(ui.host.querySelector('[data-tab="wishes"]')!);
    // 祈愿 unfolds the picker of 许愿小物 under the list.
    await ui.tap(ui.button(VESSEL_COPY.pray, ".app-content"));
    const card = ui.host.querySelector(
      `#vessel-picker .wish-practice-card[data-scene="${sceneId}"]`,
    )!;
    expect(card.querySelector("small")!.textContent).toBe(VESSEL_COPY.use);
    await ui.tap(card);
    expect(ui.page()).toBe("scene");
    // A 许愿 walk carries no caption: it is not for a wish.
    expect(ui.host.querySelector(".scene-caption")).toBeNull();
    return ui;
  }

  it("spends the keepsake by the walk, then keeps the line as a new 心愿", async () => {
    const ui = await openVessel("crane");
    act(() => scene.context!.saveWish!("面试顺利"));
    await ui.walk();
    expect(ui.host.querySelector(".scene-done")?.textContent).toBe(
      SCENE_VESSEL_DONE_COPY,
    );
    expect(ui.host.querySelector(".scene-keep-line")?.textContent).toBe(
      "「面试顺利」",
    );
    expect(ui.host.querySelector(".scene-keep-question")?.textContent).toBe(
      SCENE_KEEP_QUESTION,
    );
    expect(ui.doneButtons()).toEqual([SCENE_KEEP_CTA, SCENE_DISCARD_CTA]);
    expect(ui.host.querySelectorAll(".favorite-chip")).toHaveLength(1);
    // The keepsake is spent whichever way the line goes; no wish yet.
    let saved = await ui.saved();
    expect(saved.collectibles[0]).toMatchObject({ spentAt: expect.any(String) });
    expect(saved.wishes).toHaveLength(0);

    await ui.tap(ui.button(SCENE_KEEP_CTA, ".scene-done-row"));
    expect(ui.doneButtons()).toEqual([SCENE_DONE_WISH_CTA]);
    expect(ui.button(SCENE_DONE_WISH_CTA, ".scene-completion-actions")?.parentElement?.querySelector(".favorite-chip")).toBeTruthy();
    expect(ui.host.querySelectorAll(".favorite-chip")).toHaveLength(1);
    await ui.tap(ui.button(SCENE_DONE_WISH_CTA, ".scene-done-row"));
    expect(ui.page()).toBe("wishes");
    expect(ui.host.querySelector(".wish-card strong")?.textContent).toBe(
      "面试顺利",
    );
    saved = await ui.saved();
    expect(saved.wishes[0]).toMatchObject({ title: "面试顺利", status: "active" });
    // Keeping the line settles the draft: the save lets it go.
    expect(
      saved.vesselDrafts?.[dailyCollectibleId("2026-10-05", "crane")],
    ).toBeUndefined();
    ui.unmount();
  });

  it("keeps the held line through a reload: the picker returns to the choice", async () => {
    let ui = await openVessel("crane");
    const vessel = dailyCollectibleId("2026-10-05", "crane");
    act(() => scene.context!.saveWish!("面试顺利"));
    await ui.walk();
    expect(ui.host.querySelector(".scene-keep-line")?.textContent).toBe(
      "「面试顺利」",
    );
    const spent = await ui.saved();
    expect(spent.collectibles[0]).toMatchObject({ spentAt: expect.any(String) });
    ui.unmount();

    // A reload from the save: the spent keepsake still holds the line, and
    // the 祈愿 picker lists it, so the choice can be returned to.
    ui = await openApp(spent);
    await ui.tap(ui.host.querySelector('[data-tab="wishes"]')!);
    await ui.tap(ui.button(VESSEL_COPY.pray, ".app-content"));
    const card = ui.host.querySelector(
      `#vessel-picker .wish-practice-card[data-scene="crane"]`,
    )!;
    expect(card.querySelector("small")!.textContent).toBe(VESSEL_COPY.pending);
    await ui.tap(card);
    // The spent vessel reopens on the choice itself, not on a new walk.
    expect(ui.page()).toBe("scene");
    expect(ui.sceneProgress()).toBe("已完成 3 / 3");
    expect(ui.host.querySelector(".scene-keep-line")?.textContent).toBe(
      "「面试顺利」",
    );
    expect(ui.host.querySelector(".scene-keep-question")?.textContent).toBe(
      SCENE_KEEP_QUESTION,
    );
    expect(ui.doneButtons()).toEqual([SCENE_KEEP_CTA, SCENE_DISCARD_CTA]);
    let saved = await ui.saved();
    expect(saved.collectibles[0]).toMatchObject({ spentAt: expect.any(String) });
    expect(saved.vesselDrafts?.[vessel]).toMatchObject({ line: "面试顺利" });

    // The choice still works after the reload, and settles the draft.
    await ui.tap(ui.button(SCENE_KEEP_CTA, ".scene-done-row"));
    expect(ui.doneButtons()).toEqual([SCENE_DONE_WISH_CTA]);
    saved = await ui.saved();
    expect(saved.wishes[0]).toMatchObject({ title: "面试顺利" });
    expect(saved.vesselDrafts?.[vessel]).toBeUndefined();
    ui.unmount();
  });

  it("keeps nothing when the line is not kept", async () => {
    const ui = await openVessel("tanzaku-tanabata");
    act(() => scene.context!.saveWish!("希望家人平安"));
    await ui.walk();
    await ui.tap(ui.button(SCENE_DISCARD_CTA, ".scene-done-row"));
    expect(ui.host.querySelector(".scene-done")?.textContent).toBe(
      SCENE_DISCARDED_COPY,
    );
    expect(ui.doneButtons()).toEqual([SCENE_DONE_CTA]);
    expect(ui.button(SCENE_DONE_CTA, ".scene-completion-actions")?.parentElement?.querySelector(".favorite-chip")).toBeTruthy();
    expect(ui.host.querySelectorAll(".favorite-chip")).toHaveLength(1);
    const saved = await ui.saved();
    expect(saved.wishes).toHaveLength(0);
    // Not keeping it settles the draft too: nothing waits, nothing lingers.
    expect(
      saved.vesselDrafts?.[dailyCollectibleId("2026-10-05", "tanzaku-tanabata")],
    ).toBeUndefined();
    expect(saved.collectibles[0]).toMatchObject({ spentAt: expect.any(String) });
    ui.unmount();
  });

  it("offers its own line for a scene with no wish box", async () => {
    const ui = await openVessel("yeondeunghoe");
    await ui.walk();
    expect(ui.host.querySelector(".scene-done")?.textContent).toBe(
      SCENE_VESSEL_DONE_COPY,
    );
    expect(ui.host.querySelector(".scene-post-wish input")).toBeNull();
    await ui.tap(ui.host.querySelector(".scene-wish-invite")!);
    typeInto(ui.host.querySelector(".scene-post-wish input")!, "家人平安");
    await ui.tap(ui.host.querySelector(".scene-post-wish button[type='submit']")!);
    expect(ui.doneButtons()).toEqual([SCENE_DONE_WISH_CTA]);
    const saved = await ui.saved();
    expect(saved.wishes[0]).toMatchObject({ title: "家人平安" });
    expect(saved.collectibles[0]).toMatchObject({ spentAt: expect.any(String) });
    ui.unmount();
  });
});

describe("还愿 through a keepsake", () => {
  it.each([["daruma-eye-painting", "另一目"], ["omamori-cycle", "返纳盒"]])(
    "shows gratitude and the returning action for %s", async (id, action) => {
      const state = withRealizedWish();
      state.collectibles.push(keepsake(id, "2026-10-05"));
      const ui = await openApp(state);
      await ui.tap(ui.host.querySelector('[data-tab="wishes"]')!);
      await ui.tap(ui.host.querySelector('.wish-card[data-wish-id="w1"]')!);
      await ui.tap(ui.button("来还个愿", ".wish-detail-page"));
      await ui.tap(ui.host.querySelector(`.vessel-card[data-scene="${id}"]`)!);
      const intention = ui.host.querySelector('.scene-intention[data-kind="gratitude"]');
      expect(intention?.textContent ?? "").toContain("面试顺利");
      expect(intention?.textContent ?? "").toContain(action);
      expect(ui.host.querySelector(".scene-post-wish")).toBeNull();
      ui.unmount();
    });
  it("spends the keepsake for the wish: a note, no merit, the badge only", async () => {
    const state = withRecords({ crane: 2 }, withRealizedWish());
    state.collectibles.push(keepsake("crane", "2026-10-05"));
    const ui = await openApp(state);
    await ui.tap(ui.host.querySelector('[data-tab="wishes"]')!);
    await ui.tap(ui.host.querySelector('.wish-card[data-wish-id="w1"]')!);
    await ui.tap(ui.button("来还个愿", ".wish-detail-page"));
    expect(ui.page()).toBe("fulfill");
    expect(ui.host.querySelector(".linked-ritual")!.textContent).toContain(
      FULFILL_VESSEL_COPY.pick,
    );
    // The crane record stands half-walked: a 还愿 visit still starts at 0.
    await ui.tap(ui.host.querySelector('.vessel-card[data-scene="crane"]')!);
    expect(ui.page()).toBe("scene");
    expect(ui.sceneProgress()).toBe("已完成 0 / 3");
    expect(scene.context?.progress).toBe(0);
    expect(ui.host.querySelector(".scene-caption")!.textContent).toBe(
      "这一次，为「面试顺利」还愿。",
    );
    // A 还愿 walk keeps nothing from its box: the box says so itself.
    expect(scene.context?.saveWish).toBeUndefined();

    await ui.walk();
    expect(ui.host.querySelector(".scene-done")?.textContent).toBe(
      SCENE_RETURN_DONE_COPY,
    );
    expect(ui.doneButtons()).toEqual([SCENE_RETURN_CTA]);
    expect(ui.button(SCENE_RETURN_CTA, ".scene-completion-actions")?.parentElement?.querySelector(".favorite-chip")).toBeTruthy();
    expect(ui.host.querySelectorAll(".favorite-chip")).toHaveLength(1);
    let saved = await ui.saved();
    // The vessel path leaves no session: the spent keepsake is the record.
    expect(saved.sessions).toHaveLength(0);
    expect(saved.collectibles[0]).toMatchObject({
      spentAt: expect.any(String),
      wishId: "w1",
    });
    expect(saved.wishes[0].notes.map((n) => n.text)).toEqual([
      "为这个心愿，折一只纸鹤",
    ]);
    expect(saved.ledger).toEqual([]);

    await ui.tap(ui.button(SCENE_RETURN_CTA, ".scene-done-row"));
    expect(ui.page()).toBe("fulfill");
    expect(ui.host.querySelector(".linked-ritual")?.textContent).toContain(
      "已为这个心愿完成小仪式",
    );
    typeInto(ui.host.querySelector("#return-note")!, "谢谢一直努力的自己");
    await ui.tap(ui.button("完成还愿", "form"));
    expect(ui.page()).toBe("collection");
    saved = await ui.saved();
    expect(saved.wishes[0]).toMatchObject({
      status: "fulfilled",
      returnMethod: "ritual",
    });
    // The 如愿 badge joins the spent keepsake, and no merit was ever given.
    expect(saved.collectibles.map((c) => c.kind)).toEqual(["scene", "badge"]);
    expect(saved.ledger).toEqual([]);
    ui.unmount();
  });

  it("points back to 今日 when no keepsake is usable yet", async () => {
    const ui = await openApp(withRealizedWish());
    await ui.tap(ui.host.querySelector('[data-tab="wishes"]')!);
    await ui.tap(ui.host.querySelector('.wish-card[data-wish-id="w1"]')!);
    await ui.tap(ui.button("来还个愿", ".wish-detail-page"));
    const linked = ui.host.querySelector(".linked-ritual")!;
    expect(linked.textContent).toContain(FULFILL_VESSEL_COPY.none);
    await ui.tap(ui.button(FULFILL_VESSEL_COPY.noneAction, ".linked-ritual"));
    expect(ui.page()).toBe("today");
    ui.unmount();
  });
});

describe("小天地's 回看", () => {
  it("reopens the collected scene from its start, and says where a spent keepsake went", async () => {
    const state = withRecords({ crane: 3 });
    state.collectibles.push(
      keepsake("crane", "2026-10-05", "2026-10-06T08:00:00.000Z"),
      keepsake("woodfish", "2026-10-06"),
    );
    const ui = await openApp(state);
    await ui.tap(ui.host.querySelector('[data-tab="world"]')!);
    // A collected scene shows its drawn icon, in the shelf and the grid.
    expect(ui.host.querySelectorAll(".room-shelf .scene-art")).toHaveLength(2);
    expect(ui.host.querySelectorAll(".collection-grid .scene-art")).toHaveLength(2);
    await ui.tap(
      ui.host.querySelector(
        `[data-collectible-id="${dailyCollectibleId("2026-10-05", "crane")}"]`,
      )!,
    );
    expect(ui.page()).toBe("collection");
    expect(ui.host.querySelector(".form-card .tag")?.textContent).toBe(
      "许愿小物",
    );
    const spent = ui.host.querySelector(".vessel-spent-line")!.textContent!;
    expect(spent).toBe("已拿去许过愿");
    expect(() => assertSafeCopy(spent)).not.toThrow();

    await ui.tap(ui.button("回看这场仪式", ".form-card"));
    expect(ui.page()).toBe("scene");
    expect(ui.sceneTitle()).toBe(entryOf("crane").title);
    expect(ui.sceneProgress()).toBe("已完成 0 / 3");
    ui.unmount();
  });
});

describe("仪式时光", () => {
  it("keeps collection and wish notes, and 再次体验 opens the scene afresh", async () => {
    // A completed 2D lantern, then a crane walked as a scene for w1.
    let state: State = withRecords({ crane: 3 }, withRealizedWish());
    state = reduce(state, { type: "ritual.start", id: "r2d", ritual: "lantern", at: AT });
    for (let i = 0; i < 3; i++) state = reduce(state, { type: "ritual.step" });
    state = reduce(state, { type: "ritual.finish", id: "r2d", at: AT });
    state = reduce(state, {
      type: "ritual.scene",
      id: "visit",
      ritual: "crane",
      wishId: "w1",
      startedAt: AT,
      at: AT,
    });
    const ui = await openApp(state);
    await ui.tap(ui.host.querySelector('[data-tab="me"]')!);
    expect([...ui.host.querySelectorAll('.stats > div')].map(el => el.textContent)).toEqual(['3仪式记录', '1小天地收藏']);
    expect(ui.host.textContent).not.toContain('功德');
    await ui.tap(ui.button("仪式时光", ".settings-card"));
    const lines = [...ui.host.querySelectorAll(".timeline li p")].map(
      (p) => p.textContent!,
    );
    // Newest first.
    expect(lines).toEqual([
      `${HISTORY_SCENE_LINE} · 为「面试顺利」记了一笔`,
      "收藏了暖心灯",
    ]);
    expect(() => assertSafeCopy(lines[0])).not.toThrow();

    await ui.tap(ui.button("再次体验", ".timeline li:first-child"));
    expect(ui.page()).toBe("scene");
    expect(ui.sceneTitle()).toBe(entryOf("crane").title);
    expect(ui.sceneProgress()).toBe("已完成 0 / 3");
    ui.unmount();
  });

  it("reopens a finished scene card from its first step", async () => {
    const ui = await openApp(withRecords({ crane: 3 }));
    await ui.tap(ui.host.querySelector('[data-tab="me"]')!);
    await ui.tap(ui.button("仪式时光", ".settings-card"));
    await ui.tap(
      ui.host.querySelector('.scene-catalog .scene-card[data-scene="crane"]')!,
    );
    expect(ui.page()).toBe("scene");
    expect(ui.sceneProgress()).toBe("已完成 0 / 3");
    ui.unmount();
  });
});

describe("场景目录", () => {
  it("reopens a finished scene from its first step, not its done row", async () => {
    const ui = await openApp(withRecords({ crane: 3 }));
    await ui.tap(ui.host.querySelector('[data-tab="me"]')!);
    await ui.tap(ui.button("场景目录", ".settings-card"));
    while (!ui.host.querySelector('.scene-catalog .scene-card[data-scene="crane"]')) {
      await ui.tap(ui.button("显示更多"));
    }
    await ui.tap(
      ui.host.querySelector('.scene-catalog .scene-card[data-scene="crane"]')!,
    );
    expect(ui.page()).toBe("scene");
    expect(ui.sceneTitle()).toBe(entryOf("crane").title);
    expect(ui.sceneProgress()).toBe("已完成 0 / 3");
    ui.unmount();
  });
});

describe("useOpenRitual", () => {
  /** The hook as 仪式时光 holds it, over `state` and a catalog of `entries`. */
  function opener(state: State, entries: CatalogEntry[] = builtInScenes) {
    const go = vi.fn();
    const dispatch = vi.fn(() => true);
    let open!: ReturnType<typeof useOpenRitual>;
    function Probe() {
      open = useOpenRitual();
      return null;
    }
    renderToStaticMarkup(
      createElement(
        Context.Provider,
        { value: { state, go, dispatch } as unknown as AppContext },
        createElement(
          SceneLibraryContext.Provider,
          { value: { entries } as never },
          createElement(Probe),
        ),
      ),
    );
    return { open, go, dispatch };
  }
  const reset = (id: string) => ({ type: "scene.progress", id, progress: 0 });

  it("opens the scene as it stands, unless it is done", () => {
    const fresh = opener(createState());
    fresh.open("crane");
    expect(fresh.dispatch).not.toHaveBeenCalled();
    expect(fresh.go).toHaveBeenCalledWith({
      page: "scene",
      id: "crane",
      entry: entryOf("crane"),
      wishId: undefined,
      // 再次体验 is a replay: it never settles 今日's keepsake.
      replay: true,
    });
    const half = opener(withRecords({ woodfish: 11 }));
    half.open("woodfish");
    expect(half.dispatch).not.toHaveBeenCalled();
    const done = opener(withRecords({ woodfish: 12 }));
    done.open("woodfish");
    expect(done.dispatch).toHaveBeenCalledWith(reset("woodfish"));
  });

  it("starts a 还愿 visit at 0, even half-walked", () => {
    const { open, go, dispatch } = opener(withRecords({ crane: 1 }));
    open("crane", "w1");
    expect(dispatch).toHaveBeenCalledWith(reset("crane"));
    expect(go).toHaveBeenCalledWith(
      expect.objectContaining({ page: "scene", id: "crane", wishId: "w1" }),
    );
  });

  it("falls back to the 2D page only when the catalog has no playable scene", () => {
    const without = opener(
      createState(),
      builtInScenes.filter((e) => e.id !== "crane"),
    );
    without.open("crane", "w1");
    expect(without.go).toHaveBeenCalledWith({
      page: "ritual",
      id: "crane",
      wishId: "w1",
    });
    const newer = opener(createState(), [
      { ...entryOf("crane"), engine: "crane@9" },
    ]);
    newer.open("crane");
    expect(newer.go).toHaveBeenCalledWith(
      expect.objectContaining({ page: "ritual", id: "crane" }),
    );
    expect(newer.dispatch).not.toHaveBeenCalled();
  });

  it('does not reopen a hidden legacy ritual through the 2D fallback', () => {
    const hidden = opener(createState());hidden.open('lantern');
    expect(hidden.go).not.toHaveBeenCalled();expect(hidden.dispatch).not.toHaveBeenCalled();
  });
});

describe("useOpenScene", () => {
  /** The hook as 今日/心愿/小天地 hold it, over `state` and a catalog. */
  function opener(state: State) {
    const go = vi.fn();
    const dispatch = vi.fn(() => true);
    let open!: ReturnType<typeof useOpenScene>;
    function Probe() {
      open = useOpenScene();
      return null;
    }
    renderToStaticMarkup(
      createElement(
        Context.Provider,
        { value: { state, go, dispatch } as unknown as AppContext },
        createElement(
          SceneLibraryContext.Provider,
          { value: { entries: builtInScenes } as never },
          createElement(Probe),
        ),
      ),
    );
    return { open, go, dispatch };
  }
  const reset = (id: string) => ({ type: "scene.progress", id, progress: 0 });

  it("opens a scene as it stands, unless it is done; the daily set resumes a half-walked scene", () => {
    const fresh = opener(createState());
    fresh.open(entryOf("crane"));
    expect(fresh.dispatch).not.toHaveBeenCalled();
    expect(fresh.go).toHaveBeenCalledWith({
      page: "scene",
      id: "crane",
      entry: entryOf("crane"),
      daily: undefined,
      vessel: undefined,
      wishId: undefined,
      replay: undefined,
    });
    // A half-walked scene, unflagged (场景目录, 仪式时光): continued as it stands.
    const half = opener(withRecords({ woodfish: 11 }));
    half.open(entryOf("woodfish"));
    expect(half.dispatch).not.toHaveBeenCalled();
    // A done scene, unflagged: restarted from its first step.
    const done = opener(withRecords({ woodfish: 12 }));
    done.open(entryOf("woodfish"));
    expect(done.dispatch).toHaveBeenCalledWith(reset("woodfish"));
    // 今日's daily set resumes a half-walked scene — leaving the card and
    // coming back loses no steps — and restarts a finished one, like an
    // unflagged entry.
    const dailyHalf = opener(withRecords({ crane: 1 }));
    dailyHalf.open(entryOf("crane"), { daily: DAY });
    expect(dailyHalf.dispatch).not.toHaveBeenCalled();
    const dailyDone = opener(withRecords({ crane: 3 }));
    dailyDone.open(entryOf("crane"), { daily: DAY });
    expect(dailyDone.dispatch).toHaveBeenCalledWith(reset("crane"));
    // Every other flag — vessel, 还愿, 回看 — still always starts over.
    const flagged = opener(withRecords({ crane: 1 }));
    flagged.open(entryOf("crane"), { vessel: "v1" });
    expect(flagged.dispatch).toHaveBeenCalledWith(reset("crane"));
    const walked = opener(withRecords({ crane: 3 }));
    walked.open(entryOf("crane"), { replay: true });
    expect(walked.dispatch).toHaveBeenCalledWith(reset("crane"));
    // A vessel already spent reopens on its waiting keep-or-discard choice —
    // even a done record stays put, rather than walking again.
    const pending = {
      ...withRecords({ crane: 3 }),
      collectibles: [keepsake("crane", "2026-10-05", AT)],
    };
    const reopened = opener(pending);
    reopened.open(entryOf("crane"), {
      vessel: dailyCollectibleId("2026-10-05", "crane"),
    });
    expect(reopened.dispatch).not.toHaveBeenCalled();
  });

  it("passes the visit's flags on to the scene route", () => {
    const { open, go } = opener(createState());
    open(entryOf("tanzaku-tanabata"), {
      daily: DAY,
      vessel: "v1",
      wishId: "w1",
    });
    expect(go).toHaveBeenCalledWith({
      page: "scene",
      id: "tanzaku-tanabata",
      entry: entryOf("tanzaku-tanabata"),
      daily: DAY,
      vessel: "v1",
      wishId: "w1",
      replay: undefined,
    });
  });
  it("resumes partial cloth folds but clears them when a new wrapping visit begins", () => {
    const state = withRecords({ "korean-bojagi-wrap": 0 });
    state.sceneRecords[0].variant = "bojagi-step-2";
    const resumed = opener(state);
    resumed.open(entryOf("korean-bojagi-wrap"), { daily: DAY });
    expect(resumed.dispatch).not.toHaveBeenCalled();
    const restarted = opener(state);
    restarted.open(entryOf("korean-bojagi-wrap"), { replay: true });
    expect(restarted.dispatch).toHaveBeenCalledWith({ type: "scene.variant", id: "korean-bojagi-wrap", variant: "bojagi-step-0" });
    const doneState = withRecords({ "korean-bojagi-wrap": 3 });
    doneState.sceneRecords[0].variant = "bojagi-step-7";
    const done = opener(doneState);
    done.open(entryOf("korean-bojagi-wrap"));
    expect(done.dispatch).toHaveBeenCalledWith({ type: "scene.variant", id: "korean-bojagi-wrap", variant: "bojagi-step-0" });
    expect(done.dispatch).toHaveBeenCalledWith(reset("korean-bojagi-wrap"));
  });
});

describe("ritual scene copy", () => {
  it("keeps the daily, vessel and 还愿 lines safe", () => {
    for (const text of [
      SCENE_RETURN_DONE_COPY,
      SCENE_RETURN_CTA,
      SCENE_VESSEL_DONE_COPY,
      SCENE_KEEP_QUESTION,
      SCENE_KEEP_CTA,
      SCENE_DISCARD_CTA,
      SCENE_DISCARDED_COPY,
      SCENE_DAILY_CTA,
      SCENE_DAILY_CAPTION,
      sceneDailyDoneCopy("短册系竹"),
      sceneDailyAnnounce("短册系竹"),
      ...Object.values(VESSEL_COPY),
      FULFILL_VESSEL_COPY.pick,
      FULFILL_VESSEL_COPY.none,
      FULFILL_VESSEL_COPY.noneAction,
      "已拿去许过愿",
      "回看这场仪式",
    ])
      expect(() => assertSafeCopy(text)).not.toThrow();
  });
});

describe("optional wishes after the ritual", () => {
  async function openCatalogScene(id: string) {
    const ui = await openApp(createState());
    await ui.tap(ui.host.querySelector('[data-tab="me"]')!);
    await ui.tap(ui.button("场景目录", ".settings-card"));
    while (!ui.host.querySelector(`.scene-catalog .scene-card[data-scene="${id}"]`)) {
      const more = ui.button("显示更多");
      expect(more).toBeTruthy();
      await ui.tap(more);
    }
    await ui.tap(ui.host.querySelector(`.scene-catalog .scene-card[data-scene="${id}"]`)!);
    return ui;
  }

  it("shows the purpose during the actions and defers writing until the ritual is done", async () => {
    const ui = await openCatalogScene("tanzaku-tanabata");
    const intention = ui.host.querySelector('.scene-intention[data-kind="wish"]');
    expect(intention?.textContent ?? "").toContain("短册");
    expect(ui.host.querySelector(".scene-post-wish")).toBeNull();
    expect(scene.context?.deferWishWriting).toBe(true);
    await ui.walk();
    expect(ui.host.querySelector(".scene-post-wish .scene-wish-invite")).not.toBeNull();
    expect(ui.host.querySelector(".scene-post-wish input")).toBeNull();
    expect((await ui.saved()).wishes).toEqual([]);
    ui.unmount();
  });

  it("completes and leaves a wishing ritual without a written wish", async () => {
    const ui = await openCatalogScene("tanzaku-tanabata");
    await ui.walk();
    const exit = ui.host.querySelector(".scene-completion-actions button.primary");
    expect(exit).not.toBeNull();
    await ui.tap(exit!);
    expect(ui.page()).not.toBe("scene");
    expect((await ui.saved()).wishes).toEqual([]);
    ui.unmount();
  });

  it("saves one trimmed wish only after an explicit post-ritual submit", async () => {
    const ui = await openCatalogScene("tanzaku-tanabata");
    await ui.walk();
    await ui.tap(ui.host.querySelector(".scene-wish-invite")!);
    const input = ui.host.querySelector<HTMLInputElement>(".scene-post-wish input")!;
    typeInto(input, "   ");
    const form = input.form!;
    act(() => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect((await ui.saved()).wishes).toEqual([]);
    typeInto(input, "  愿家人平安  ");
    expect((await ui.saved()).wishes).toEqual([]);
    await ui.tap(form.querySelector('button[type="submit"]')!);
    expect((await ui.saved()).wishes).toMatchObject([{ title: "愿家人平安", sourceSceneId: "tanzaku-tanabata" }]);
    act(() => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect((await ui.saved()).wishes).toHaveLength(1);
    expect(ui.host.querySelector(".scene-post-wish input")).toBeNull();
    await ui.tap(ui.button(SCENE_DONE_WISH_CTA));
    expect(ui.page()).toBe("wishes");
    expect(ui.host.querySelector(".wish-card strong")?.textContent).toBe("愿家人平安");
    ui.unmount();
  });

  it("lets an unfinished post-ritual draft go without saving it", async () => {
    const ui = await openCatalogScene("korean-bojagi-wrap");
    await ui.walk();
    await ui.tap(ui.host.querySelector(".scene-wish-invite")!);
    typeInto(ui.host.querySelector<HTMLInputElement>(".scene-post-wish input")!, "还没想好");
    await ui.tap(ui.host.querySelector(".scene-post-wish .scene-wish-cancel")!);
    expect(ui.host.querySelector(".scene-post-wish input")).toBeNull();
    expect((await ui.saved()).wishes).toEqual([]);
    await ui.tap(ui.host.querySelector(".scene-wish-invite")!);
    expect(ui.host.querySelector<HTMLInputElement>(".scene-post-wish input")?.value).toBe("");
    ui.unmount();
  });

  it("keeps reflection practices focused on their own action", async () => {
    const ui = await openCatalogScene("omikuji");
    expect(ui.host.querySelector('.scene-intention[data-kind="reflection"]')).not.toBeNull();
    await ui.walk();
    expect(ui.host.querySelector(".scene-post-wish")).toBeNull();
    expect((await ui.saved()).wishes).toEqual([]);
    ui.unmount();
  });
});
