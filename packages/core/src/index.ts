import { builtInScenes } from './daily-scenes';
import { isVisualSceneId, isVisualStyle, normalizeStyleParameters, restoreVisualStyles, type VisualStylePreference, type VisualPreferenceInput } from "./visual-style";
import { openingCollectibleId, replaceHiddenOpeningScenes, validOpeningSceneIds, validOpeningState, validOpeningDay, type OpeningState } from './opening';
export { chooseOpeningScenes, openingCollectibleId, openingExclusions } from './opening';
export type { OpeningState } from './opening';
export { sceneIntention } from './scene-intentions';
export type { SceneIntention, SceneIntentionKind } from './scene-intentions';

export const rituals = {
  woodfish: {
    name: "敲一敲木鱼",
    short: "木鱼",
    object: "小木鱼",
    subtitle: "把纷纷扰扰，轻轻放下",
    steps: 12,
    prompts: ["轻敲木鱼，让心慢下来"],
  },
  crane: {
    name: "折一只纸鹤",
    short: "纸鹤",
    object: "千纸鹤",
    subtitle: "把小小的期待，折进翅膀里",
    steps: 4,
    prompts: [
      "摊开一张纸，留一点期待",
      "对折，把心事轻轻收好",
      "折出翅膀，让愿望有方向",
      "展开纸鹤，把祝福留给自己",
    ],
  },
  lantern: {
    name: "点一盏心愿灯",
    short: "心愿灯",
    object: "暖心灯",
    subtitle: "愿你的每一份期待，都有微光",
    steps: 3,
    prompts: ["安放一盏灯", "为心里的愿望点一束光", "让这份温暖，陪你慢慢向前"],
  },
} as const;
export type RitualId = keyof typeof rituals;
export type WishStatus = "active" | "realized" | "fulfilled";
export type WishCategory = "study" | "work" | "life";
export type ReturnMethod = "kindness" | "ritual";
export type Note = { id: string; text: string; at: string };
/** Longest wish title and intention (小约定), in UTF-16 units. */
export const WISH_TITLE_MAX = 60;
export const WISH_INTENTION_MAX = 160;
export type Wish = {
  id: string;
  title: string;
  intention: string;
  category?: WishCategory;
  returnMethod?: ReturnMethod;
  /** The scene whose wish box this wish was written in, if any. */
  sourceSceneId?: string;
  status: WishStatus;
  archived: boolean;
  createdAt: string;
  realizedAt?: string;
  fulfilledAt?: string;
  notes: Note[];
};
export type Session = {
  id: string;
  ritual: RitualId;
  progress: number;
  startedAt: string;
  wishId?: string;
  completedAt?: string;
};
export type Collectible = {
  id: string;
  kind: RitualId | "badge" | "scene";
  title: string;
  at: string;
  wishId?: string;
  /** kind "scene": the scene this keepsake opens again from 小天地 (回看). */
  sceneId?: string;
  /** kind "scene": this one can be used in 心愿 for 许愿/还愿. */
  wishScene?: boolean;
  /** kind "scene": when it was used for a wish; a spent keepsake stays for 回看. */
  spentAt?: string;
};
/** The one keepsake a day's walk of a scene leaves in 小天地. */
export const dailyCollectibleId = (day: string, sceneId: string) =>
  `daily:${day}:${sceneId}`;
/**
 * A 许愿 walk's held line, waiting on its keep-or-discard choice. Keyed by
 * the vessel's collectible id in `State.vesselDrafts`, so the choice (and
 * the phrase) survive leaving the page or the App; the choice itself —
 * keep, discard, or a fresh walk of the vessel — clears it.
 */
export type VesselDraft = { line: string; at: string };
export type SceneRecord = {
  id: string; title: string; engine: string; revision: string; manifestUrl: string;
  progress: number; favorite: boolean; lastOpened: string;
  /** A durable cosmetic/object choice, independent of the integer progress. */
  variant?: string;
};
export type State = {
  /** Absent on legacy saves. Only an empty host starts the first-play opening. */
  opening?: OpeningState;
  sceneRecords: SceneRecord[];
  version: 1;
  wishes: Wish[];
  activeSession: Session | null;
  sessions: Session[];
  collectibles: Collectible[];
  /** Legacy score data retained for save compatibility; new rituals do not add entries. */
  ledger: { id: string; amount: number; at: string }[];
  settings: { sound: boolean; haptics: boolean; reducedMotion: boolean };
  /** Optional on old saves; each ritual keeps its own cosmetic preference. */
  visualStyles?: Record<string, VisualStylePreference>;
  /** Held lines of vessel 许愿 walks still waiting on their choice. Absent
   * on saves from before it existed; empty once every choice is settled. */
  vesselDrafts?: Record<string, VesselDraft>;
};
export type Action =
  | ({ type: "scene.visual"; id: string } & ({ style: null } | VisualPreferenceInput))
  | { type: "opening.start"; sceneIds: [string, string, string] }
  | { type: "opening.collect"; sceneId: string; at: string }
  | { type: "opening.finish"; day: string; at: string }
  | { type: "scene.visit"; entry: Pick<SceneRecord, "id" | "title" | "engine" | "revision" | "manifestUrl">; at: string }
  | { type: "scene.progress"; id: string; progress: number }
  | { type: "scene.favorite"; id: string; favorite: boolean }
  | { type: "scene.variant"; id: string; variant: string }
  | {
      type: "wish.create";
      id: string;
      title: string;
      intention: string;
      category?: WishCategory;
      returnMethod?: ReturnMethod;
      sourceSceneId?: string;
      at: string;
    }
  | { type: "wish.note"; id: string; noteId: string; text: string; at: string }
  | { type: "wish.realize"; id: string; at: string }
  | {
      type: "wish.fulfill";
      method?: ReturnMethod;
      id: string;
      noteId: string;
      text: string;
      at: string;
    }
  | { type: "wish.archive"; id: string; archived: boolean }
  | {
      type: "ritual.start" | "ritual.strike";
      id: string;
      ritual: RitualId;
      wishId?: string;
      at: string;
    }
  | { type: "ritual.step" }
  | { type: "ritual.finish"; id: string; at: string }
  /**
   * A ritual walked as its 3D scene for a wish (还愿): one completed session
   * and a note on the wish, at once. Never an extra collectible (the
   * scene red line), and any 2D session in progress is left alone.
   */
  | {
      type: "ritual.scene";
      id: string;
      ritual: RitualId;
      wishId: string;
      startedAt: string;
      at: string;
    }
  /**
   * A scene walked on 今日's daily set: one keepsake in 小天地,
   * once per scene per day. Idempotent: a scene already collected
   * today (or a last step reported again) settles nothing.
   */
  | {
      type: "daily.scene";
      id: string;
      sceneId: string;
      title: string;
      wishScene: boolean;
      day: string;
      startedAt: string;
      at: string;
    }
  /**
   * Uses a wish-type keepsake from 小天地: for 许愿 (nothing kept here — the
   * App asks first) or for 还愿 (`wishId`: the keepsake is marked spent and
   * the wish gets its note, so the wish can be fulfilled by ritual).
   */
  | { type: "collectible.spend"; id: string; wishId?: string; at: string }
  /** A vessel 许愿 walk holds (or re-holds) its line, keyed by the vessel. */
  | { type: "vessel.hold"; id: string; line: string; at: string }
  /** The vessel's choice settled: the line was kept, or not. */
  | { type: "vessel.clear"; id: string }
  | { type: "settings"; key: keyof State["settings"]; value: boolean };

/** A fresh state; `settings` overrides defaults (e.g. the system's motion preference). */
export function createState(settings: Partial<State["settings"]> = {}): State {
  return {
    sceneRecords: [],
    version: 1,
    wishes: [],
    activeSession: null,
    sessions: [],
    collectibles: [],
    ledger: [],
    settings: { sound: true, haptics: true, reducedMotion: false, ...settings },
  };
}
function text(value: string, max: number) {
  const clean = value.trim();
  if (!clean || clean.length > max) throw new Error(`请填写 1–${max} 个字`);
  return clean;
}
function wishOf(s: State, id: string) {
  const w = s.wishes.find((w) => w.id === id);
  if (!w) throw new Error("没有找到这个心愿");
  return w;
}
function updateWish(s: State, w: Wish): State {
  return { ...s, wishes: s.wishes.map((old) => (old.id === w.id ? w : old)) };
}
/** The note a completed ritual leaves on its linked wish. */
function ritualNote(sessionId: string, ritual: RitualId, at: string): Note {
  return {
    id: `ritual:${sessionId}`,
    text: `为这个心愿，${rituals[ritual].name}`,
    at,
  };
}
export function reduce(s: State, a: Action): State {
  switch (a.type) {
    case 'opening.start': {
      if (s.opening?.status !== 'new') return s;
      if (!validOpeningSceneIds(a.sceneIds)) throw Error('开场仪式组合无效');
      return { ...s, opening: { status: 'active', sceneIds: [...a.sceneIds], completed: 0 } };
    }
    case 'opening.collect': {
      const opening = s.opening;
      if (!opening || opening.status === 'new') throw Error('开场体验尚未开始');
      const index = opening.sceneIds.indexOf(a.sceneId);
      if (index >= 0 && index < opening.completed) return s;
      if (opening.status !== 'active' || opening.sceneIds[opening.completed] !== a.sceneId)
        throw Error('请按顺序完成开场仪式');
      const entry = builtInScenes.find(e => e.id === a.sceneId)!;
      const record = s.sceneRecords.find(r => r.id === a.sceneId);
      if (!record || record.engine !== entry.engine || record.progress < (entry.engine === 'woodfish@1' ? 12 : 3) || !date(a.at))
        throw Error('先完成这场仪式，再收下小物');
      return {
        ...s,
        opening: { ...opening, completed: opening.completed + 1 },
        collectibles: [...s.collectibles, { id: openingCollectibleId(entry.id), kind: 'scene', sceneId: entry.id,
          title: entry.title, wishScene: index === 2, at: a.at }],
      };
    }
    case 'opening.finish': {
      if (s.opening?.status === 'complete') return s;
      if (s.opening?.status !== 'active' || s.opening.completed !== 3 || !validOpeningDay(a.day) || !date(a.at))
        throw Error('请先完成三场开场仪式');
      return { ...s, opening: { ...s.opening, status: 'complete', completed: 3, completedDay: a.day, completedAt: a.at } };
    }
    case "scene.visit": {
      const old = s.sceneRecords.find(r => r.id === a.entry.id);
      // A saved interaction belongs to an engine contract, not a visual revision.
      if (old && old.engine !== a.entry.engine) throw Error("此场景的玩法版本已变化，请从历史记录打开原版本");
      const record = { ...a.entry, progress: old?.progress ?? 0, favorite: old?.favorite ?? false, lastOpened: a.at };
      if (old?.variant !== undefined) Object.assign(record, { variant: old.variant });
      if (!sceneRecord(record)) throw Error("场景记录无效");
      return { ...s, sceneRecords: [record, ...s.sceneRecords.filter(r => r.id !== a.entry.id)] };
    }
    case "scene.progress":
      if (!Number.isSafeInteger(a.progress) || a.progress < 0 || a.progress > 1000000) throw Error("场景进度无效");
      return { ...s, sceneRecords: s.sceneRecords.map(r => r.id === a.id ? { ...r, progress: a.progress } : r) };
    case "scene.favorite":
      return { ...s, sceneRecords: s.sceneRecords.map(r => r.id === a.id ? { ...r, favorite: a.favorite } : r) };
    case "scene.variant":
      if (!sceneVariant(a.variant)) throw Error("场景选项无效");
      return { ...s, sceneRecords: s.sceneRecords.map(r => r.id === a.id ? { ...r, variant: a.variant } : r) };
    case "wish.create":
      if (s.wishes.some((w) => w.id === a.id)) return s;
      if (a.intention.length > WISH_INTENTION_MAX)
        throw new Error(`小约定请控制在 ${WISH_INTENTION_MAX} 字以内`);
      if (!optionalId(a.sourceSceneId)) throw new Error("心愿的来源场景无效");
      return {
        ...s,
        wishes: [
          {
            id: a.id,
            title: text(a.title, WISH_TITLE_MAX),
            intention: a.intention.trim(),
            category: a.category ?? "life",
            returnMethod: a.returnMethod ?? "kindness",
            ...(a.sourceSceneId === undefined
              ? {}
              : { sourceSceneId: a.sourceSceneId }),
            createdAt: a.at,
            status: "active",
            archived: false,
            notes: [],
          },
          ...s.wishes,
        ],
      };
    case "wish.note": {
      const w = wishOf(s, a.id);
      if (w.archived) throw new Error("先把心愿重新拾起，再记一笔吧");
      if (w.notes.some((n) => n.id === a.noteId)) return s;
      return updateWish(s, {
        ...w,
        notes: [
          ...w.notes,
          { id: a.noteId, text: text(a.text, 500), at: a.at },
        ],
      });
    }
    case "wish.realize": {
      const w = wishOf(s, a.id);
      if (w.status !== "active" || w.archived)
        throw new Error("这个心愿目前不能标记实现");
      return updateWish(s, { ...w, status: "realized", realizedAt: a.at });
    }
    case "wish.fulfill": {
      const w = wishOf(s, a.id);
      if (w.status === "fulfilled") return s;
      if (w.status !== "realized" || w.archived)
        throw new Error("先确认心愿实现，再来还愿吧");
      const method = a.method ?? "kindness";
      if (method === "ritual" && !hasReturnRitual(s, w))
        throw new Error("先为这个已实现的心愿完成一个小仪式吧");
      const next = updateWish(s, {
        ...w,
        status: "fulfilled",
        fulfilledAt: a.at,
        returnMethod: method,
        notes: [
          ...w.notes,
          { id: a.noteId, text: text(a.text, 500), at: a.at },
        ],
      });
      return {
        ...next,
        collectibles: [
          ...s.collectibles,
          {
            id: `wish:${w.id}`,
            kind: "badge",
            title: "如愿纪念章",
            at: a.at,
            wishId: w.id,
          },
        ],
      };
    }
    case "wish.archive":
      return updateWish(s, { ...wishOf(s, a.id), archived: a.archived });
    case "ritual.strike": {
      if (s.activeSession && s.activeSession.ritual !== a.ritual) return s;
      const started = s.activeSession
        ? s
        : reduce(s, { ...a, type: "ritual.start" });
      return reduce(started, { type: "ritual.step" });
    }
    case "ritual.start": {
      if (s.activeSession) throw new Error("还有一个小仪式等你继续");
      if (s.sessions.some((r) => r.id === a.id)) return s;
      if (a.wishId) {
        const w = wishOf(s, a.wishId);
        if (w.archived || w.status === "fulfilled")
          throw new Error("请选择进行中的心愿");
      }
      return {
        ...s,
        activeSession: {
          id: a.id,
          ritual: a.ritual,
          wishId: a.wishId,
          progress: 0,
          startedAt: a.at,
        },
      };
    }
    case "ritual.step": {
      if (!s.activeSession) return s;
      const r = s.activeSession;
      if (r.progress >= rituals[r.ritual].steps) return s;
      return {
        ...s,
        activeSession: {
          ...r,
          progress: Math.min(rituals[r.ritual].steps, r.progress + 1),
        },
      };
    }
    case "ritual.finish": {
      if (s.sessions.some((r) => r.id === a.id)) return s;
      const r = s.activeSession;
      if (!r || r.id !== a.id || r.progress < rituals[r.ritual].steps)
        throw new Error("先完成这个小仪式吧");
      let next = s;
      if (r.wishId) {
        const w = wishOf(s, r.wishId);
        next = updateWish(s, {
          ...w,
          notes: [...w.notes, ritualNote(r.id, r.ritual, a.at)],
        });
      }
      return {
        ...next,
        activeSession: null,
        sessions: [...s.sessions, { ...r, completedAt: a.at }],
        collectibles: [
          ...s.collectibles,
          {
            id: `ritual:${r.id}`,
            kind: r.ritual,
            title: rituals[r.ritual].object,
            at: a.at,
            wishId: r.wishId,
          },
        ],
      };
    }
    case "ritual.scene": {
      if (s.sessions.some((r) => r.id === a.id)) return s;
      // Checked like a save is on restore, so a record can never break one;
      // nor may it take the 2D session's id, which could then never settle.
      if (
        !id(a.id) ||
        a.id === s.activeSession?.id ||
        !kind(a.ritual) ||
        !date(a.startedAt) ||
        !date(a.at)
      )
        throw new Error("这次仪式的记录无效");
      const w = wishOf(s, a.wishId);
      if (w.archived || w.status === "fulfilled")
        throw new Error("请选择进行中的心愿");
      const next = updateWish(s, {
        ...w,
        notes: [...w.notes, ritualNote(a.id, a.ritual, a.at)],
      });
      return {
        ...next,
        sessions: [
          ...s.sessions,
          {
            id: a.id,
            ritual: a.ritual,
            progress: rituals[a.ritual].steps,
            startedAt: a.startedAt,
            wishId: a.wishId,
            completedAt: a.at,
          },
        ],
      };
    }
    case "daily.scene": {
      // One per scene per day: a re-fired last step, or a second walk the
      // same day, settles nothing further.
      if (s.collectibles.some((c) => c.id === dailyCollectibleId(a.day, a.sceneId)))
        return s;
      if (
        !id(a.id) ||
        !id(a.sceneId) ||
        !str(a.title) ||
        a.title.trim().length < 1 ||
        a.title.length > 100 ||
        !/^\d{4}-\d{2}-\d{2}$/.test(a.day) ||
        !date(a.startedAt) ||
        !date(a.at) ||
        typeof a.wishScene !== "boolean"
      )
        throw new Error("这次仪式的记录无效");
      return {
        ...s,
        collectibles: [
          ...s.collectibles,
          {
            id: dailyCollectibleId(a.day, a.sceneId),
            kind: "scene",
            title: a.title,
            at: a.at,
            sceneId: a.sceneId,
            ...(a.wishScene ? { wishScene: true } : {}),
          },
        ],
      };
    }
    case "collectible.spend": {
      if (!id(a.id) || !date(a.at) || !optionalId(a.wishId))
        throw new Error("这次祈愿的记录无效");
      const c = s.collectibles.find((c) => c.id === a.id);
      if (!c || c.kind !== "scene" || !c.wishScene)
        throw new Error("没有找到这个许愿小物");
      // Spent once: a re-fired last step settles nothing further.
      if (c.spentAt) return s;
      let next = s;
      if (a.wishId) {
        const w = wishOf(s, a.wishId);
        if (w.archived || w.status === "fulfilled")
          throw new Error("请选择进行中的心愿");
        next = updateWish(s, {
          ...w,
          notes: [
            ...w.notes,
            { id: `vessel:${c.id}`, text: `为这个心愿，${c.title}`, at: a.at },
          ],
        });
      }
      return {
        ...next,
        collectibles: next.collectibles.map((old) =>
          old.id === a.id
            ? {
                ...c,
                spentAt: a.at,
                ...(a.wishId ? { wishId: a.wishId } : {}),
              }
            : old,
        ),
      };
    }
    case "vessel.hold": {
      if (!id(a.id) || !str(a.line) || !date(a.at))
        throw new Error("这次祈愿的记录无效");
      const line = a.line.trim();
      // As long as a title with its overrun intention could hold it.
      if (!line || line.length > WISH_TITLE_MAX + WISH_INTENTION_MAX)
        throw new Error("这次祈愿的记录无效");
      return {
        ...s,
        vesselDrafts: { ...s.vesselDrafts, [a.id]: { line, at: a.at } },
      };
    }
    case "vessel.clear": {
      if (!id(a.id)) throw new Error("这次祈愿的记录无效");
      if (!s.vesselDrafts?.[a.id]) return s;
      const drafts = { ...s.vesselDrafts };
      delete drafts[a.id];
      return { ...s, vesselDrafts: drafts };
    }
    case "settings":
      return { ...s, settings: { ...s.settings, [a.key]: a.value } };
    case "scene.visual": {
      if (!isVisualSceneId(a.id) || (a.style !== null && !isVisualStyle(a.style))) throw Error("这个视觉风格暂不可用");
      const visualStyles = { ...s.visualStyles };
      if (a.style === null) {
        if (!visualStyles[a.id]) return s;
        delete visualStyles[a.id];
      } else {
        const previous = visualStyles[a.id];
        const preference = { style: a.style, parameters: normalizeStyleParameters(a.parameters, previous?.parameters) };
        if (JSON.stringify(previous) === JSON.stringify(preference)) return s;
        visualStyles[a.id] = preference;
      }
      return { ...s, visualStyles };
    }
  }
}
export function localDay(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function hasReturnRitual(state: State, wish: Wish): boolean {
  return Boolean(
    wish.realizedAt &&
      (state.sessions.some(
        (s) =>
          s.wishId === wish.id &&
          s.completedAt &&
          s.startedAt >= wish.realizedAt!,
      ) ||
        // A wish-type keepsake spent for the wish (the vessel 还愿) counts
        // the same way a recorded scene session does.
        state.collectibles.some(
          (c) =>
            c.wishId === wish.id && c.spentAt && c.spentAt >= wish.realizedAt!,
        )),
  );
}

// Validate before mounting the UI. Invalid saves stay untouched for recovery.
const obj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === "string";
const date = (v: unknown) => str(v) && Number.isFinite(Date.parse(v));
const id = (v: unknown) => str(v) && v.length > 0;
const optionalId = (v: unknown) => v === undefined || id(v);
const kind = (v: unknown): v is RitualId =>
  v === "woodfish" || v === "crane" || v === "lantern";
/** One keepsake in 小天地: a ritual object, a 如愿 badge, or a collected
 * scene (which carries its scene, and may be a spent wish vessel). */
const collectible = (v: unknown) =>
  obj(v) &&
  id(v.id) &&
  (kind(v.kind) || v.kind === "badge" || v.kind === "scene") &&
  str(v.title) &&
  date(v.at) &&
  optionalId(v.wishId) &&
  (v.kind === "scene"
    ? id(v.sceneId) &&
      (v.wishScene === undefined || typeof v.wishScene === "boolean") &&
      // A scene keepsake carries a wish only once it has been spent for one.
      (v.spentAt === undefined
        ? v.wishId === undefined
        : date(v.spentAt))
    : v.sceneId === undefined &&
      v.wishScene === undefined &&
      v.spentAt === undefined);
const list = (v: unknown, valid: (x: unknown) => boolean) =>
  Array.isArray(v) &&
  v.every(valid) &&
  new Set(v.map((x) => x.id)).size === v.length;
/** A vessel walk's held line, keyed by the vessel's collectible id. */
const draft = (v: unknown) =>
  obj(v) &&
  str(v.line) &&
  v.line.trim().length > 0 &&
  v.line.length <= WISH_TITLE_MAX + WISH_INTENTION_MAX &&
  date(v.at);
const session = (v: unknown) =>
  obj(v) &&
  id(v.id) &&
  kind(v.ritual) &&
  Number.isInteger(v.progress) &&
  Number(v.progress) >= 0 &&
  Number(v.progress) <= rituals[v.ritual].steps &&
  date(v.startedAt) &&
  optionalId(v.wishId);
const sceneVariant = (v: unknown) => typeof v === "string" && /^[a-z0-9-]{1,32}$/.test(v);
const sceneRecord = (v: unknown) => obj(v) && id(v.id) && str(v.title) && v.title.length <= 100 && id(v.engine) && id(v.revision) && str(v.manifestUrl) && v.manifestUrl.length <= 2048 && Number.isSafeInteger(v.progress) && Number(v.progress) >= 0 && Number(v.progress) <= 1000000 && typeof v.favorite === "boolean" && date(v.lastOpened) && (v.variant === undefined || sceneVariant(v.variant));
/** Restores a save; without one yet, starts fresh with `initialSettings`. */
export function restore(
  raw: string | null,
  initialSettings?: Partial<State["settings"]>,
): State {
  if (raw === null) return { ...createState(initialSettings), opening: { status: 'new' } };
  const v: unknown = JSON.parse(raw);
  const settings = obj(v) ? v.settings : null;
  const valid =
    obj(v) &&
    v.version === 1 &&
    (v.opening === undefined || validOpeningState(v.opening)) &&
    (v.sceneRecords === undefined || list(v.sceneRecords, sceneRecord)) &&
    obj(settings) &&
    ["sound", "haptics", "reducedMotion"].every(
      (k) => typeof settings[k] === "boolean",
    ) &&
    list(
      v.wishes,
      (w) =>
        obj(w) &&
        id(w.id) &&
        str(w.title) &&
        w.title.trim().length > 0 &&
        w.title.length <= WISH_TITLE_MAX &&
        str(w.intention) &&
        (w.category === undefined ||
          ["study", "work", "life"].includes(String(w.category))) &&
        (w.returnMethod === undefined ||
          ["kindness", "ritual"].includes(String(w.returnMethod))) &&
        optionalId(w.sourceSceneId) &&
        typeof w.archived === "boolean" &&
        ["active", "realized", "fulfilled"].includes(String(w.status)) &&
        date(w.createdAt) &&
        (w.status === "active" || date(w.realizedAt)) &&
        (w.status !== "fulfilled" || date(w.fulfilledAt)) &&
        list(w.notes, (n) => obj(n) && id(n.id) && str(n.text) && date(n.at)),
    ) &&
    (v.activeSession === null || session(v.activeSession)) &&
    list(
      v.sessions,
      (r) =>
        session(r) &&
        obj(r) &&
        date(r.completedAt) &&
        kind(r.ritual) &&
        r.progress === rituals[r.ritual].steps,
    ) &&
    list(v.collectibles, collectible) &&
    list(
      v.ledger,
      (l) =>
        obj(l) &&
        id(l.id) &&
        Number.isInteger(l.amount) &&
        Number(l.amount) > 0 &&
        date(l.at),
    ) &&
    // Optional since it postdates the first saves: absent is simply none yet.
    (v.vesselDrafts === undefined ||
      (obj(v.vesselDrafts) &&
        Object.entries(v.vesselDrafts).every(([key, d]) => id(key) && draft(d))));
  if (!valid) throw new Error("存档格式不受支持或已损坏，原数据已保留");
  const s = v as State;
  if (s.visualStyles !== undefined) s.visualStyles = restoreVisualStyles(s.visualStyles);
  s.sceneRecords ??= [];
  if (s.opening && s.opening.status !== 'new' &&
      s.opening.sceneIds.slice(0, s.opening.completed).some((sceneId, i) =>
        !s.collectibles.some(c => c.id === openingCollectibleId(sceneId) && c.kind === 'scene' &&
          c.sceneId === sceneId && c.wishScene === (i === 2))))
    throw new Error('开场体验的收藏记录不完整，原数据已保留');
  if (
    [
      ...s.sessions,
      ...(s.activeSession ? [s.activeSession] : []),
      ...s.collectibles,
    ].some((r) => r.wishId && !s.wishes.some((w) => w.id === r.wishId))
  )
    throw new Error("存档的心愿关联不完整，原数据已保留");
  if (s.opening) s.opening = replaceHiddenOpeningScenes(s.opening);
  return s;
}
