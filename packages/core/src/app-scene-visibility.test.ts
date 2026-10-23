import { describe, expect, it } from 'vitest';
import { createState, chooseOpeningScenes, reduce, restore } from './index';
import { APP_HIDDEN_SCENE_IDS, BLESSING_SCENE_IDS, WISH_SCENE_IDS, builtInScenes, dailyPrimaryScene, isSceneVisibleInApp } from './daily-scenes';
import { createWidgetSnapshot, selectWidgetDay } from './widgets';

describe('App scene availability', () => {
  it('keeps exactly the 67 approved scenes visible and all 134 sources available', () => {
    const approved = [
    "nanakusa-gayu",
    "brat-bride-cloth",
    "korean-sotdae",
    "alasita-miniature-house",
    "yusheng-lohei",
    "kitano-nadeushi",
    "finnish-virpominen",
    "scottish-first-footing",
    "polish-oplatek-sharing",
    "tamagushi-offering",
    "tibetan-water-bowls",
    "kagami-biraki-sake",
    "tibetan-prayer-flags",
    "rosh-hashanah-apple-honey",
    "thai-songkran-elders",
    "kameido-usokae",
    "persian-esfand",
    "mochigase-nagashibina",
    "greek-vasilopita",
    "tibetan-khata-greeting",
    "shichigosan-chitose-ame",
    "mongolian-ovoo",
    "fgs-buddha-bathing",
    "balinese-canang-sari",
    "bulgarian-survakane",
    "lanna-sand-pagoda",
    "chinese-fu-paper",
    "turkish-nazar-bead",
    "japanese-hamaya",
    "vietnamese-five-fruit-tray",
    "chinese-ruyi-scepter",
    "setsubun-mamemaki",
    "sternsinger-house-blessing",
    "lam-tsuen-wishing-tree",
    "kagami-mochi-offering",
    "romanian-martisor",
    "sumiyoshi-godairiki",
    "lao-baci-wrist", "udo-undama", "zeniarai-coin-washing", "chinowa-kuguri", "bonfim-ribbon", "greek-new-year-pomegranate", "hiiragi-iwashi",
    "aland-votive-ship",
    "barcelos-clay-rooster",
    "basque-sunflower",
    "bokjori",
    "chinese-incense",
    "clootie-well-rag",
    "crane",
    "croatian-licitar-heart",
    "daruma-eye-painting",
    "diya-oil-lamp",
    "ema-votive-plaque",
    "floating-lantern-loy-krathong",
    "furin-wind-chime",
    "italian-ex-voto",
    "japanese-koinobori",
    "korean-bojagi-wrap",
    "lithuanian-straw-garden",
    "milagros",
    "mizuhiki",
    "navruz-sumalak",
    "omamori-cycle",
    "omikuji",
    "phuang-malai",
    "polish-blessing-basket",
    "shinto-torii",
    "shrine-suzu-bell",
    "slavic-wreath",
    "sorbian-painted-egg",
    "st-brigids-cross",
    "tanzaku-tanabata",
    "tibetan-wheel",
    "votive-candle-catholic",
    "welsh-love-spoon",
    "woodfish",
    "yeondeunghoe"
];
    expect(builtInScenes).toHaveLength(134);
    expect(APP_HIDDEN_SCENE_IDS).toHaveLength(67);
    expect(builtInScenes.filter(isSceneVisibleInApp).map(e => e.id).sort()).toEqual(approved.sort());
    expect(new Set(APP_HIDDEN_SCENE_IDS).size).toBe(67);
    for (const id of APP_HIDDEN_SCENE_IDS) {
      const source = builtInScenes.find(e => e.id === id)!;
      expect(source).toBeDefined();
      expect(isSceneVisibleInApp({ ...source, id: 'remote-alias' })).toBe(false);
      expect(dailyPrimaryScene([source], '2026-10-19')).toBeUndefined();
    }
  });

  it('migrates every pending hidden opening without changing the saved source records', () => {
    for (const id of APP_HIDDEN_SCENE_IDS) {
      const isWish = WISH_SCENE_IDS.includes(id as never);
      const queue: [string, string, string] = isWish ? ['woodfish', 'shinto-torii', id] : [id, 'woodfish', 'crane'];
      const state = reduce(restore(null), { type: 'opening.start', sceneIds: queue });
      const next = restore(JSON.stringify(state));
      if (next.opening?.status !== 'active') throw Error('expected active opening');
      expect(next.opening.completed).toBe(0);
      expect(new Set(next.opening.sceneIds).size).toBe(3);
      expect(next.opening.sceneIds.every(sceneId => isSceneVisibleInApp({ id: sceneId }))).toBe(true);
      expect(next.opening.sceneIds.slice(0, 2).every(sceneId => BLESSING_SCENE_IDS.includes(sceneId as never))).toBe(true);
      expect(WISH_SCENE_IDS).toContain(next.opening.sceneIds[2]);
      expect(next.sceneRecords).toEqual(state.sceneRecords);
      expect(next.collectibles).toEqual(state.collectibles);
    }
  });

  it('retains the abacus source catalog but excludes it from every daily selection', () => {
    const abacus = builtInScenes.find(e => e.id === 'chinese-suanpan')!;
    expect(abacus.engine).toBe('chinese-suanpan@1');
    expect(dailyPrimaryScene([abacus], '2026-10-19')).toBeUndefined();
    for (let i = 0; i < 180; i++) {
      const day = new Date(Date.UTC(2026, 0, i + 1)).toISOString().slice(0, 10);
      expect(dailyPrimaryScene(builtInScenes, day)?.id).not.toBe(abacus.id);
    }
  });

  it('never assigns the hidden abacus to a new opening', () => {
    const entries = builtInScenes.filter(e => ['woodfish', 'shinto-torii', 'chinese-suanpan', 'crane' ].includes(e.id));
    for (const random of [0, .3, .7, .99]) {
      expect(chooseOpeningScenes(entries, () => random)).not.toContain('chinese-suanpan');
    }
  });

  it('replaces only unplayed hidden opening steps while retaining old records', () => {
    let state = reduce(restore(null), { type: 'opening.start', sceneIds: ['chinese-suanpan', 'woodfish', 'crane'] });
    state = reduce(state, { type: 'scene.visit', entry: builtInScenes.find(e => e.id === 'chinese-suanpan')!, at: '2026-10-18T12:00:00Z' });
    state = reduce(state, { type: 'scene.progress', id: 'chinese-suanpan', progress: 1 });
    const next = restore(JSON.stringify(state));
    expect(next.opening).toMatchObject({ status: 'active', completed: 0 });
    if (next.opening?.status === 'active') {
      expect(next.opening.sceneIds).not.toContain('chinese-suanpan');
      expect(next.opening.sceneIds.slice(1)).toEqual(['woodfish', 'crane']);
    }
    expect(next.sceneRecords).toEqual(state.sceneRecords);
    expect(next.collectibles).toEqual(state.collectibles);
  });

  it('keeps widget recommendations in step with the filtered App catalog', () => {
    const raw = JSON.stringify(createState());
    for (let month = 0; month < 12; month++) {
      const clock = new Date(2026, month, 1, 12), snapshot = createWidgetSnapshot(raw, clock, 'visibility-test');
      expect(snapshot.days).toHaveLength(7);
      expect(snapshot.days.map(e => e.sceneId)).not.toContain('chinese-suanpan');
      expect(selectWidgetDay(snapshot, clock)?.sceneId).toBe(snapshot.days[0].sceneId);
    }
  });

  it('preserves a hidden scene that was already collected in an old opening', () => {
    let state = reduce(restore(null), { type: 'opening.start', sceneIds: ['chinese-suanpan', 'woodfish', 'crane'] });
    state = reduce(state, { type: 'scene.visit', entry: builtInScenes.find(e => e.id === 'chinese-suanpan')!, at: '2026-10-18T12:00:00Z' });
    state = reduce(state, { type: 'scene.progress', id: 'chinese-suanpan', progress: 3 });
    state = reduce(state, { type: 'opening.collect', sceneId: 'chinese-suanpan', at: '2026-10-18T12:00:00Z' });
    expect(restore(JSON.stringify(state))).toEqual(state);
  });
});
