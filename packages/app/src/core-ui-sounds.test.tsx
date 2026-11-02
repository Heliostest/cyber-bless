// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createState, dailyCollectibleId, type Collectible, type State, type Wish } from '@wbr/core';
import { Context, type AppContext } from './context';
import { clickOn, renderUI, typeInto } from './dom-test-utils';
import { SceneLibraryContext, builtInScenes } from './scene-library';
import { Wishes, World, CollectionDetail, Me, History } from './pages';
import { FulfillWish, WishDetail, WishNote } from './wishes';
import { Today } from './home';
import { WishRitualPicker } from './wish-ritual-picker';
import { WishRitualRack } from './wish-ritual-rack';
import { WidgetNavigation } from './widget-navigation';
import { LegalInformation } from './legal';

const AT = '2026-10-07T08:00:00.000Z';
const mounted: ReturnType<typeof renderUI>[] = [];
afterEach(() => {
  mounted.splice(0).forEach(ui => ui.unmount());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function wish(status: Wish['status'] = 'active'): Wish {
  return { id: 'w1', title: '愿今天从容一点', intention: '', status, archived: false, createdAt: AT, notes: [] };
}
function keepsake(id: string, sceneId = 'tanzaku-tanabata', spent = false): Collectible {
  return { id, kind: 'scene', sceneId, title: builtInScenes.find(entry => entry.id === sceneId)!.title,
    wishScene: true, at: AT, ...(spent ? { spentAt: AT } : {}) };
}
function mount(node: ReactNode, state: State = createState(), extra: Partial<AppContext> = {}) {
  vi.stubGlobal('WebGL2RenderingContext', undefined);
  const go = vi.fn(), back = vi.fn(), uiSound = vi.fn(), feedback = vi.fn(), prepareFeedback = vi.fn();
  const dispatch = vi.fn((_action: unknown) => true), setFulfillmentDraft = vi.fn();
  const context = { state, go, back, uiSound, dispatch, feedback, prepareFeedback, active: true,
    fulfillmentDrafts: {}, setFulfillmentDraft, canHaptic: false, ...extra } as AppContext;
  const ui = renderUI(<Context.Provider value={context}>
    <SceneLibraryContext.Provider value={{ entries: builtInScenes } as never}>{node}</SceneLibraryContext.Provider>
  </Context.Provider>);
  mounted.push(ui);
  return { ...ui, go, back, uiSound, feedback, prepareFeedback, dispatch, setFulfillmentDraft };
}
function button(host: HTMLElement, copy: string) {
  const found = [...host.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.includes(copy));
  expect(found, copy).toBeTruthy();
  return found!;
}

describe('core page UI sound boundaries', () => {
  it('voices only changed wish filters, and marks explicit wish navigation', () => {
    const state = createState(); state.wishes = [wish()];
    const ui = mount(<Wishes />, state);
    clickOn(button(ui.host, '进行中'));
    expect(ui.uiSound).not.toHaveBeenCalled();
    clickOn(button(ui.host, '已如愿'));
    clickOn(button(ui.host, '已如愿'));
    clickOn(button(ui.host, '进行中'));
    expect(ui.uiSound.mock.calls).toEqual([['select'], ['select']]);
    clickOn(ui.host.querySelector('.wish-card')!);
    expect(ui.go).toHaveBeenLastCalledWith({ page: 'wish', id: 'w1' }, { sound: 'navigate' });
    clickOn(button(ui.host, '去许愿'));
    expect(ui.go).toHaveBeenLastCalledWith({ page: 'new' }, { sound: 'navigate' });
  });

  it('opens and closes wish records once, without duplicating archive or saved results', () => {
    const state = createState(); state.wishes = [{ ...wish(), notes: [
      { id: 'n1', text: '认真准备', at: AT }, { id: 'n2', text: '早睡一点', at: AT },
    ] }];
    const ui = mount(<WishDetail id="w1" />, state);
    clickOn(button(ui.host, '查看全部'));
    clickOn(button(ui.host, '收起记录'));
    expect(ui.uiSound.mock.calls).toEqual([['open'], ['close']]);
    clickOn(button(ui.host, '记一笔'));
    expect(ui.go).toHaveBeenLastCalledWith({ page: 'note', id: 'w1' }, { sound: 'navigate' });
    ui.uiSound.mockClear(); ui.go.mockClear();
    clickOn(button(ui.host, '先休息'));
    clickOn(button(ui.host, '我的心愿实现了'));
    expect(ui.dispatch.mock.calls.map(([action]) => (action as { type: string }).type)).toEqual(['wish.archive', 'wish.realize']);
    expect(ui.uiSound).not.toHaveBeenCalled();
    expect(ui.go).toHaveBeenCalledWith({ page: 'fulfill', id: 'w1' });
  });

  it('marks an already realized wish entry as navigation', () => {
    const state = createState(); state.wishes = [wish('realized')];
    const ui = mount(<WishDetail id="w1" />, state);
    clickOn(button(ui.host, '来还个愿'));
    expect(ui.go).toHaveBeenCalledWith({ page: 'fulfill', id: 'w1' }, { sound: 'navigate' });
  });

  it('keeps note editing and successful submit navigation quiet for the persisted saved cue', () => {
    const state = createState(); state.wishes = [wish()];
    const ui = mount(<WishNote id="w1" />, state);
    typeInto(ui.host.querySelector('textarea')!, '今天认真准备了');
    act(() => ui.host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(ui.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'wish.note' }));
    expect(ui.go.mock.calls).toEqual([[{ page: 'wish', id: 'w1' }]]);
    expect(ui.uiSound).not.toHaveBeenCalled();
  });

  it('keeps fulfillment submit navigation quiet for the persisted saved cue', () => {
    const state = createState(); state.wishes = [wish('realized')];
    const ui = mount(<FulfillWish id="w1" />, state, { fulfillmentDrafts: { w1: { method: 'kindness', text: '感谢帮助过我的人' } } });
    act(() => ui.host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(ui.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'wish.fulfill' }));
    expect(ui.go.mock.calls).toEqual([[{ page: 'wish', id: 'w1' }]]);
    expect(ui.uiSound).not.toHaveBeenCalled();
  });

  it('marks Today scene cards as navigation and suppresses outside-close when another button activates', () => {
    const state = createState();
    state.collectibles = [keepsake(dailyCollectibleId('2026-10-01', 'tanzaku-tanabata'))];
    const ui = mount(<Today day="2026-10-07" />, state);
    const info = ui.host.querySelector('.daily-collected-info-button')!;
    clickOn(info);
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(ui.uiSound.mock.calls).toEqual([['open'], ['close']]);
    clickOn(info); ui.uiSound.mockClear();
    clickOn(ui.host.querySelector('.daily-set-primary')!);
    expect(ui.go).toHaveBeenLastCalledWith(expect.objectContaining({ page: 'scene', daily: '2026-10-07' }), { sound: 'navigate' });
    expect(ui.uiSound).not.toHaveBeenCalled();
    expect(ui.host.querySelector('.daily-collected-info-panel')).toBeNull();
    clickOn(info); ui.uiSound.mockClear();
    clickOn(ui.host.querySelector('.daily-collected > .section-heading h2')!);
    expect(ui.uiSound.mock.calls).toEqual([['close']]);
  });

  it('leaves locked ritual picker cards quiet and marks unlocked and vessel entries as navigation', () => {
    const state = createState(); state.collectibles = [keepsake('spent', 'tanzaku-tanabata', true), keepsake('held', 'crane')];
    const ui = mount(<WishRitualPicker />, state);
    clickOn(ui.host.querySelector('.wish-scene-choice[disabled]')!);
    expect(ui.go).not.toHaveBeenCalled(); expect(ui.uiSound).not.toHaveBeenCalled();
    clickOn(ui.host.querySelector('.wish-scene-choice[data-unlocked="true"]')!);
    expect(ui.go).toHaveBeenLastCalledWith(expect.objectContaining({ page: 'scene', id: 'tanzaku-tanabata' }), { sound: 'navigate' });
    clickOn(ui.host.querySelector('.vessel-card')!);
    expect(ui.go).toHaveBeenLastCalledWith(expect.objectContaining({ page: 'scene', vessel: 'held' }), { sound: 'navigate' });
  });

  it('keeps rack object material feedback separate from browsing and explicit open navigation', () => {
    const state = createState(); state.settings.reducedMotion = true;
    state.collectibles = Array.from({ length: 4 }, (_, i) => keepsake(`object-${i}`));
    const ui = mount(<WishRitualRack />, state), row = ui.host.querySelector<HTMLElement>('.wish-rack-row')!;
    Object.defineProperties(row, { clientWidth: { value: 300 }, scrollWidth: { value: 900 } });
    row.scrollBy = vi.fn();
    act(() => row.dispatchEvent(new Event('scroll')));
    clickOn(ui.host.querySelector('.wish-rack-item')!);
    expect(ui.feedback).toHaveBeenCalledOnce(); expect(ui.prepareFeedback).toHaveBeenCalledOnce();
    expect(ui.uiSound).not.toHaveBeenCalled(); expect(ui.go).not.toHaveBeenCalled();
    clickOn(ui.host.querySelector('[aria-label="向前浏览小物"]')!);
    expect(ui.uiSound).not.toHaveBeenCalled();
    clickOn(ui.host.querySelector('[aria-label="向后浏览小物"]')!);
    expect(ui.uiSound.mock.calls).toEqual([['navigate']]);
    ui.uiSound.mockClear();
    act(() => row.dispatchEvent(new Event('scroll')));
    act(() => ui.host.querySelector('.wish-rack-item')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    expect(ui.uiSound).not.toHaveBeenCalled();
    ui.feedback.mockClear();
    const object = ui.host.querySelector('.wish-rack-item')!;
    for (const [type, x] of [['pointerdown', 100], ['pointermove', 50], ['pointerup', 50]] as const) {
      const event = new Event(type, { bubbles: true });
      Object.assign(event, { pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1, clientX: x, clientY: 10 });
      act(() => object.dispatchEvent(event));
    }
    act(() => object.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })));
    expect(ui.uiSound).not.toHaveBeenCalled(); expect(ui.feedback).not.toHaveBeenCalled();
    clickOn(ui.host.querySelector('.wish-rack-open')!);
    expect(ui.go).toHaveBeenCalledWith(expect.objectContaining({ page: 'scene' }), { sound: 'navigate' });
  });

  it('keeps automatic widget routing silent and voices the explicit stay-here dismissal', () => {
    const request = { requestId: 1, day: '2020-01-01', sceneId: 'crane' };
    const automatic = mount(<WidgetNavigation request={request} route={{ page: 'wishes' }} saved busy={false} />);
    expect(automatic.go.mock.calls).toEqual([[{ page: 'today' }]]);
    expect(automatic.uiSound).not.toHaveBeenCalled();
    const scene = mount(<WidgetNavigation request={{ requestId: 3 }} route={{ page: 'wishes' }} saved busy={false} />);
    expect(scene.go.mock.calls).toEqual([[expect.objectContaining({ page: 'scene' })]]);
    expect(scene.uiSound).not.toHaveBeenCalled();
    const blocked = mount(<WidgetNavigation request={{ requestId: 2 }} route={{ page: 'note' }} saved busy={false} />);
    clickOn(button(blocked.host, '留在这里'));
    expect(blocked.uiSound.mock.calls).toEqual([['close']]);
    expect(blocked.go).not.toHaveBeenCalled();
  });

  it('voices legal external selection and passes back semantics without forwarding its mouse event', () => {
    const ui = mount(<LegalInformation kind="support" />);
    const link = ui.host.querySelector('a')!;
    link.addEventListener('click', event => event.preventDefault());
    clickOn(link);
    expect(ui.uiSound.mock.calls).toEqual([['select']]);
    clickOn(button(ui.host, '返回我的'));
    expect(ui.back).toHaveBeenCalledWith({ sound: true });
  });

  it('marks room, collection replay, personal settings links, and history entries as user navigation', () => {
    const state = createState(); state.collectibles = [keepsake('object')];
    const world = mount(<World />, state);
    clickOn(world.host.querySelector('.collection-card')!);
    expect(world.go).toHaveBeenCalledWith({ page: 'collection', id: 'object' }, { sound: 'navigate' });
    const collection = mount(<CollectionDetail id="object" />, state);
    clickOn(button(collection.host, '回看这场仪式'));
    expect(collection.go).toHaveBeenCalledWith(expect.objectContaining({ page: 'scene', replay: true }), { sound: 'navigate' });
    const me = mount(<Me />, state);
    clickOn(button(me.host, '隐私政策'));
    expect(me.go).toHaveBeenCalledWith({ page: 'privacy' }, { sound: 'navigate' });
    state.sceneRecords = [{ ...builtInScenes.find(entry => entry.id === 'crane')!, progress: 0, favorite: false, lastOpened: AT }];
    const history = mount(<History />, state);
    clickOn(history.host.querySelector('.scene-card')!);
    expect(history.go).toHaveBeenCalledWith(expect.objectContaining({ page: 'scene', id: 'crane' }), { sound: 'navigate' });
  });
});
