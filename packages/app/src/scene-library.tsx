import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { RitualId } from "@wbr/core";
import { CACHE_BUDGET, parsePack, type Pack } from "@wbr/content";
import {
  createSceneLibrary,
  type CatalogEntry,
  type SceneManifest,
} from "@wbr/content/catalog";
import type { CacheOptions, CacheStats } from "@wbr/content/cache";
import { Icon } from "./art";
import { contentIO, useContent } from "./content";
import { useApp } from "./context";
import { SceneBadge } from "./scene-icons";
import { ritualSceneEntry, sceneSteps } from "./scene-placement";
import { PageHead } from "./page-heading";

export { builtInScenes, type BuiltInSceneEntry } from '@wbr/core/daily-scenes';
import { builtInScenes, isSceneVisibleInApp } from '@wbr/core/daily-scenes';
export const supportsScene = (engine: string) =>
  builtInScenes.some((e) => e.engine === engine);
export function woodfishPack(manifest: SceneManifest): Pack {
  return parsePack({
    ...manifest.config,
    schemaVersion: 1,
    sceneId: "woodfish",
    revision: manifest.revision,
    engine: "woodfish@1",
    model: manifest.assets.model,
    ...(manifest.assets.sound ? { sound: manifest.assets.sound } : {}),
  });
}
function validate(manifest: SceneManifest) {
  if (manifest.engine === "woodfish@1") {
    woodfishPack(manifest);
    if (
      Object.keys(manifest.assets).some((k) => !["model", "sound"].includes(k))
    )
      throw Error("Unsupported woodfish dependency");
  } else {
    if (
      Object.keys(manifest.assets).some((k) => k !== "presentation") ||
      (manifest.assets.presentation &&
        (!manifest.assets.presentation.path.endsWith(".json") ||
          manifest.assets.presentation.bytes > 8192))
    )
      throw Error("Unsupported scene dependency");
    if (Object.keys(manifest.config).length)
      throw Error("Unsupported scene configuration");
  }
}
type LibraryContext = {
  entries: CatalogEntry[];
  library: ReturnType<typeof createSceneLibrary>;
  stats?: CacheStats;
  error: string;
  ready: boolean;
  maintain(options?: CacheOptions): Promise<CacheStats | undefined>;
};
const Library = createContext<LibraryContext>(null!);
/** What `SceneLibraryProvider` provides; tests stand in their own. */
export { Library as SceneLibraryContext };
export function useSceneLibrary() {
  const value = useContext(Library);
  const entries = useMemo(() => value.entries.filter(isSceneVisibleInApp), [value.entries]);
  return { ...value, entries };
}
/**
 * Opens a core ritual as its 3D scene: 仪式时光's 再次体验 comes through here.
 * A scene keeps its progress, so a ritual whose scene is done starts over,
 * and a 还愿 visit always starts at 0: it is walked after the wish came true.
 */
export function useOpenRitual() {
  const { state, dispatch, go } = useApp(),
    { entries } = useSceneLibrary();
  return (ritual: RitualId, wishId?: string) => {
    if (!isSceneVisibleInApp({ id: ritual })) return;
    const entry = ritualSceneEntry(entries, ritual);
    if (!entry || !supportsScene(entry.engine)) {
      // TODO: every ritual ships a bundled scene, so this is only reached if
      // a remote catalog drops one or needs a newer App for it.
      go({ page: "ritual", id: ritual, wishId });
      return;
    }
    const progress =
      state.sceneRecords.find((r) => r.id === entry.id)?.progress ?? 0;
    if (progress > 0 && (wishId || progress >= sceneSteps(entry)))
      dispatch({ type: "scene.progress", id: entry.id, progress: 0 });
    // 再次体验 is a replay — it never settles 今日's keepsake, even when the
    // scene comes up as the day's main walk (a 还愿 walk never does either).
    go({ page: "scene", id: entry.id, entry, wishId, replay: !wishId });
  };
}
/** What a walk is for. The daily set resumes a half-walked scene; each other
 * flag makes it a fresh scene (progress to 0). */
export type SceneVisit = {
  opening?: boolean;
  /** 今日's daily set: the local day the keepsake is collected for. */
  daily?: string;
  /** A wish-type keepsake being used: its collectible id. */
  vessel?: string;
  /** A walk for this realized wish (还愿). */
  wishId?: string;
  /** 小天地's 回看, or 仪式时光's 再次体验: a plain fresh replay. */
  replay?: boolean;
};
/**
 * Opens a scene for a walk. 今日's daily set resumes a half-walked scene,
 * like an unflagged entry (场景目录, 仪式时光): the walk is for today either
 * way, so leaving from the card and coming back loses no steps; a finished
 * scene still starts over. The other flags (a vessel use, a 还愿, a replay)
 * always start the scene over — except a vessel already spent, which reopens
 * on its waiting keep-or-discard choice instead of a new walk. No 2D
 * fallback here: these ids come from the live catalog.
 */
export function useOpenScene() {
  const { state, dispatch, go } = useApp();
  return (entry: CatalogEntry, visit?: SceneVisit) => {
    if (!isSceneVisibleInApp(entry)) return;
    const progress =
      state.sceneRecords.find((r) => r.id === entry.id)?.progress ?? 0;
    const spentVessel =
      !!visit?.vessel &&
      state.collectibles.some((c) => c.id === visit.vessel && !!c.spentAt);
    // A fresh vessel walk starts with a clean slate: a line held on an
    // earlier, unfinished walk of this vessel is let go.
    if (visit?.vessel && !spentVessel)
      dispatch({ type: "vessel.clear", id: visit.vessel });
    const fresh = !!visit && !visit.daily && !visit.opening && !spentVessel;
    // A spent vessel never resets: it reopens on its waiting choice, not on
    // a new walk — even when the record stands done.
    if (
      progress > 0 &&
      !spentVessel &&
      !visit?.opening &&
      (fresh || progress >= sceneSteps(entry))
    )
      dispatch({ type: "scene.progress", id: entry.id, progress: 0 });
    go({
      page: "scene",
      id: entry.id,
      entry,
      daily: visit?.daily,
      vessel: visit?.vessel,
      wishId: visit?.wishId,
      replay: visit?.replay,
      opening: visit?.opening,
    });
  };
}
export function SceneLibraryProvider({ children }: { children: ReactNode }) {
  const environment = useContent(),
    { active } = useApp();
  const io = contentIO(environment);
  const library = useMemo(
    () => createSceneLibrary({ io, supports: supportsScene, validate }),
    [io],
  );
  const [entries, setEntries] = useState(builtInScenes),
    [stats, setStats] = useState<CacheStats>();
  const [error, setError] = useState(""),
    [ready, setReady] = useState(false);
  async function maintain(options?: CacheOptions) {
    if (!io.cache) return;
    if (options?.budget) await io.writeHistory("cache-budget", options.budget);
    const next = await io.cache.maintain(options);
    setStats(next);
    return next;
  }
  useEffect(() => {
    let disposed = false;
    void (async () => {
      try {
        const stored = await io
          .readHistory("cache-budget")
          .catch(() => undefined);
        const budget =
          typeof stored === "number" &&
          Number.isSafeInteger(stored) &&
          stored >= 1 &&
          stored <= 1024 * 1024 * 1024
            ? stored
            : CACHE_BUDGET;
        const next = await io.cache?.maintain({ budget });
        if (!disposed) setStats(next);
      } catch {
        if (!disposed) setError("资源缓存暂不可用；内置场景仍可打开。");
      } finally {
        if (!disposed) setReady(true);
      }
    })();
    return () => {
      disposed = true;
    };
  }, [io]);
  useEffect(() => {
    if (!environment.catalogUrl) return;
    const controller = new AbortController();
    void library
      .catalog(
        new URL(environment.catalogUrl, window.location.href).href,
        controller.signal,
      )
      .then((remote) => {
        if (!controller.signal.aborted)
          setEntries([
            ...remote,
            ...builtInScenes.filter((e) => !remote.some((r) => r.id === e.id)),
          ]);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("目录暂时无法更新，可使用已有场景和历史记录。");
      });
    return () => controller.abort();
  }, [library, environment.catalogUrl]);
  useEffect(() => {
    if (!ready) return;
    const check = () => {
      if (!document.hidden && active) void maintain().catch(() => {});
    };
    check();
    document.addEventListener("visibilitychange", check);
    return () => document.removeEventListener("visibilitychange", check);
  }, [io, active, ready]);
  return (
    <Library.Provider
      value={{ entries, library, stats, error, ready, maintain }}
    >
      {children}
    </Library.Provider>
  );
}
/** 今日's scene recommendation. */
export const formatBytes = (bytes: number) =>
  `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
/** When a search in 场景目录 finds nothing. */
export const CATALOG_EMPTY_COPY = {
  title: "没有找到相符的场景",
  body: "换个字词试试，或清空搜索，看看全部场景。",
  clear: "清空搜索",
} as const;
/** 场景目录's search field. */
export const CATALOG_SEARCH_COPY = {
  label: "搜索场景",
  placeholder: "搜索场景名",
} as const;
/** The status chip on a 场景目录 row: where the scene's content comes from. */
export const SCENE_STATUS_COPY = {
  bundled: "内置",
  cached: "已缓存",
  download: "需下载",
  update: "需更新 App",
} as const;
export type SceneStatus = keyof typeof SCENE_STATUS_COPY;
/** A row's chip, from the library's cache status for a remote scene. */
export function sceneStatus(entry: CatalogEntry, cache?: string): SceneStatus {
  if (!supportsScene(entry.engine)) return "update";
  if (!entry.manifestUrl || cache === "bundled") return "bundled";
  return cache === "cached" ? "cached" : "download";
}
/** A scene as a list row (场景目录, 仪式时光): its badge, its title over a
 * short line, and the go-to chevron of the settings rows. */
export function SceneCard({
  id,
  title,
  disabled,
  onClick,
  children,
}: {
  id: string;
  title: string;
  disabled?: boolean;
  onClick(): void;
  children: ReactNode;
}) {
  return (
    <button
      className="scene-card"
      data-scene={id}
      disabled={disabled}
      onClick={onClick}
    >
      <SceneBadge id={id} />
      <strong>{title}</strong>
      {children}
      <Icon name="arrow" />
    </button>
  );
}
export function SceneCatalog() {
  const { entries, library, stats, error, ready } = useSceneLibrary(),
    { go } = useApp();
  const openScene = useOpenScene();
  const [query, setQuery] = useState(""),
    [limit, setLimit] = useState(24);
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const search = useRef<HTMLInputElement>(null);
  const matches = entries.filter((e) => e.title.includes(query.trim()));
  const visible = matches.slice(0, limit);
  useEffect(() => {
    let disposed = false;
    const hashes = new Set(stats?.entries.map((e) => e.key));
    void Promise.all(
      visible.map(async (e) => [
        e.id,
        e.manifestUrl ? await library.status(e, hashes) : "bundled",
      ]),
    ).then((pairs) => {
      if (!disposed) setStatuses(Object.fromEntries(pairs));
    });
    return () => {
      disposed = true;
    };
  }, [entries, query, limit, stats, library]);
  return (
    <>
      <PageHead title="场景目录" eyebrow={`${entries.length} 个场景 · 按需准备`} />
      {error && <p role="status">{error}</p>}
      <label className="scene-search">
        <span className="sr-only">{CATALOG_SEARCH_COPY.label}</span>
        <Icon name="search" />
        <input
          ref={search}
          type="search"
          placeholder={CATALOG_SEARCH_COPY.placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(24);
          }}
        />
      </label>
      <div className="scene-catalog">
        {visible.map((entry) => {
          const status = sceneStatus(entry, statuses[entry.id]);
          return (
            <SceneCard
              key={entry.id}
              id={entry.id}
              title={entry.title}
              disabled={!ready}
              onClick={() => openScene(entry)}
            >
              <span className="scene-status" data-status={status}>
                {SCENE_STATUS_COPY[status]}
              </span>
            </SceneCard>
          );
        })}
      </div>
      {query.trim() !== "" && matches.length === 0 && (
        <div className="empty" role="status">
          <Icon name="leaf" />
          <h3>{CATALOG_EMPTY_COPY.title}</h3>
          <p>{CATALOG_EMPTY_COPY.body}</p>
          <button
            className="button secondary"
            onClick={() => {
              setQuery("");
              search.current?.focus();
            }}
          >
            {CATALOG_EMPTY_COPY.clear}
          </button>
        </div>
      )}
      {matches.length > limit && (
        <button
          className="button secondary"
          onClick={() => setLimit((n) => n + 24)}
        >
          显示更多
        </button>
      )}
      <button className="text-button" onClick={() => go({ page: "cache" })}>
        管理资源缓存
      </button>
    </>
  );
}
export function CacheManager() {
  const { stats, maintain } = useSceneLibrary();
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const run = async (options?: CacheOptions) => {
    setBusy(true);
    setMessage("");
    try {
      await maintain(options);
      setMessage(
        options?.clear
          ? "已清理可删除资源，历史记录和进度保持不变。"
          : "缓存状态已更新。",
      );
    } catch {
      setMessage("暂时无法管理缓存，请重试。");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void run();
  }, []);
  return (
    <section className="cache-manager">
      <PageHead title="资源缓存" eyebrow="所有场景共享容量；收藏不会永久保留离线资源。" />
      <strong className="cache-usage">
        {formatBytes(stats?.bytes ?? 0)} /{" "}
        {formatBytes(stats?.budget ?? CACHE_BUDGET)}
      </strong>
      <p>
        使用中 {formatBytes(stats?.protectedBytes ?? 0)} · 下载预留{" "}
        {formatBytes(stats?.reservedBytes ?? 0)}
      </p>
      <label>
        缓存上限
        <select
          aria-label="缓存上限"
          disabled={busy}
          value={stats?.budget ?? CACHE_BUDGET}
          onChange={(e) => void run({ budget: Number(e.target.value) })}
        >
          {[64, 128, 256, 512].map((n) => (
            <option key={n} value={n * 1024 * 1024}>
              {n} MiB
            </option>
          ))}
        </select>
      </label>
      {stats?.overBudget && (
        <p role="status">使用中资源暂时超过上限，退出场景后会自动清理。</p>
      )}
      <button
        className="button secondary"
        disabled={busy}
        onClick={() => void run({ clear: true })}
      >
        清理可删除资源
      </button>
      <p role="status">{message}</p>
      <p className="quiet">
        再次打开历史场景时，缺失的资源会重新下载。系统也可能回收资源缓存。
      </p>
    </section>
  );
}
