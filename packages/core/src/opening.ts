import { BLESSING_SCENE_IDS, WISH_SCENE_IDS, isSceneVisibleInApp } from './daily-scenes';

export type OpeningState =
  | { status: 'new' }
  | { status: 'active'; sceneIds: [string, string, string]; completed: number }
  | { status: 'complete'; sceneIds: [string, string, string]; completed: 3; completedDay: string; completedAt: string };

export const openingCollectibleId = (sceneId: string) => `opening:${sceneId}`;
export const openingExclusions = (opening: OpeningState | undefined, day: string): readonly string[] =>
  opening?.status === 'complete' && opening.completedDay === day ? opening.sceneIds : [];

export function validOpeningSceneIds(value: unknown): value is [string, string, string] {
  return Array.isArray(value) && value.length === 3 && new Set(value).size === 3 &&
    value.slice(0, 2).every(id => (BLESSING_SCENE_IDS as readonly unknown[]).includes(id)) &&
    (WISH_SCENE_IDS as readonly unknown[]).includes(value[2]);
}

export function validOpeningDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function validOpeningState(value: unknown): value is OpeningState {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (v.status === 'new') return true;
  if (!validOpeningSceneIds(v.sceneIds) || !Number.isInteger(v.completed)) return false;
  if (v.status === 'active') return Number(v.completed) >= 0 && Number(v.completed) <= 3;
  return v.status === 'complete' && v.completed === 3 && validOpeningDay(v.completedDay) &&
    typeof v.completedAt === 'string' && Number.isFinite(Date.parse(v.completedAt));
}

/** Random without replacement; the persisted result, rather than RNG, drives later visits. */
export function chooseOpeningScenes(entries: readonly { id: string }[], random = Math.random): [string, string, string] {
  const available = new Set(entries.filter(isSceneVisibleInApp).map(e => e.id));
  const blessings = BLESSING_SCENE_IDS.filter(id => available.has(id));
  const wishes = WISH_SCENE_IDS.filter(id => available.has(id));
  if (blessings.length < 2 || !wishes.length) throw Error('开场仪式暂未准备好');
  const pick = (pool: string[]) => {
    const value = random();
    const index = Number.isFinite(value) ? Math.max(0, Math.min(pool.length - 1, Math.floor(value * pool.length))) : 0;
    return pool.splice(index, 1)[0]!;
  };
  return [pick(blessings), pick(blessings), pick(wishes)];
}

/** Retire only pending steps; past keepsakes and the user's played progress remain intact. */
export function replaceHiddenOpeningScenes(opening: OpeningState): OpeningState {
  if (opening.status !== 'active') return opening;
  const sceneIds: [string, string, string] = [...opening.sceneIds];
  let changed = false;
  for (let i = opening.completed; i < sceneIds.length; i++) {
    if (isSceneVisibleInApp({ id: sceneIds[i] })) continue;
    const pool = i < 2 ? BLESSING_SCENE_IDS : WISH_SCENE_IDS;
    const replacement = pool.find(id => isSceneVisibleInApp({ id }) && !sceneIds.includes(id));
    if (replacement) { sceneIds[i] = replacement; changed = true; }
  }
  return changed ? { ...opening, sceneIds } : opening;
}
