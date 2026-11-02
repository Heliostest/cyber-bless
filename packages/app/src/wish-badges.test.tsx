// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createState, restore, type State } from '@wbr/core';
import { Art } from './art';
import { Context, type AppContext } from './context';
import { clickOn, renderUI } from './dom-test-utils';
import { CollectionDetail, World } from './pages';
import { FulfillWish } from './wishes';
import { SceneLibraryContext, builtInScenes } from './scene-library';
import { SCENE_ICON_IDS } from './scene-icon-assets';

const at = '2026-11-02T08:00:00.000Z';
function badgeState(sourceSceneId?: string) {
  const state = createState();
  state.wishes.push({ id: 'wish', title: '我的心愿', intention: '', status: 'fulfilled', archived: false,
    createdAt: at, realizedAt: at, fulfilledAt: at, sourceSceneId,
    notes: [{ id: 'return', text: '后来用纸鹤还愿', at, system: { type: 'scene', sceneId: 'crane' } }] });
  state.collectibles.push({ id: 'wish:wish', kind: 'badge', title: '如愿纪念章', at, wishId: 'wish' });
  return state;
}
function provider(node: ReactNode, state: State, go: AppContext['go'] = () => {}) {
  return <Context.Provider value={{ state, dispatch: () => true, go, fulfillmentDrafts: {},
    setFulfillmentDraft: () => {} } as unknown as AppContext}>
    <SceneLibraryContext.Provider value={{ entries: builtInScenes } as never}>{node}</SceneLibraryContext.Provider>
  </Context.Provider>;
}
function render(node: ReactNode, state: State) {
  return new DOMParser().parseFromString(renderToStaticMarkup(provider(node, state)), 'text/html');
}

describe('ritual-specific wish badges', () => {
  it('opens the complete wish record from both shelf and collection-grid badges', () => {
    const go = vi.fn(), ui = renderUI(provider(<World />, badgeState('tanzaku-tanabata'), go));
    try {
      const buttons = ui.host.querySelectorAll<HTMLButtonElement>('[data-collectible-id="wish:wish"]');
      expect(buttons).toHaveLength(2);
      buttons.forEach(button => clickOn(button));
      expect(go).toHaveBeenCalledTimes(2);
      expect(go).toHaveBeenNthCalledWith(1, { page: 'wish', id: 'wish' }, { sound: 'navigate' });
      expect(go).toHaveBeenNthCalledWith(2, { page: 'wish', id: 'wish' }, { sound: 'navigate' });
    } finally { ui.unmount(); }
  });

  it('renders the complete wish record for a historical badge detail link', () => {
    const doc = render(<CollectionDetail id="wish:wish" />, badgeState('tanzaku-tanabata'));
    expect(doc.querySelector('.wish-detail-page h1')?.textContent).toBe('心愿已如愿');
    expect(doc.querySelector('.wish-keepsake .badge-medallion')).not.toBeNull();
    expect(doc.querySelector('.button')).toBeNull();
  });

  it.each(['tanzaku-tanabata', 'daruma-eye-painting'])(
    'uses the original %s icon in the shelf, collection and detail after restoring a save', sceneId => {
      const state = restore(JSON.stringify(badgeState(sceneId))), before = JSON.stringify(state);
      const world = render(<World />, state), detail = render(<CollectionDetail id="wish:wish" />, state);
      const badges = [...world.querySelectorAll('.art-badge'), ...detail.querySelectorAll('.art-badge')];
      expect(badges).toHaveLength(3);
      for (const badge of badges) {
        expect(badge.querySelector('.badge-medallion img')?.getAttribute('src')).toBe(`/scene-icons/soft3d/${sceneId}.webp`);
        expect(badge.getAttribute('aria-hidden')).toBe('true');
      }
      expect(JSON.stringify(state)).toBe(before);
    });

  it('applies the same badge presentation to every bundled and historical ritual icon', () => {
    for (const sceneId of SCENE_ICON_IDS) {
      const doc = new DOMParser().parseFromString(renderToStaticMarkup(<Art kind="badge" sceneId={sceneId} small />), 'text/html');
      expect(doc.querySelector('.badge-medallion img')?.getAttribute('src'), sceneId).toBe(`/scene-icons/soft3d/${sceneId}.webp`);
    }
  });

  it.each([undefined, 'unknown-scene'])('uses a neutral badge for source %s without guessing from return notes', source => {
    const state = badgeState(source);
    const doc = render(<CollectionDetail id="wish:wish" />, state);
    expect(doc.querySelector('.badge-medallion svg')).not.toBeNull();
    expect(doc.querySelector('.art-badge img')).toBeNull();
  });

  it('keeps orphan historical badges neutral', () => {
    const state = badgeState('tanzaku-tanabata');
    state.wishes = [];
    const doc = render(<CollectionDetail id="wish:wish" />, state);
    expect(doc.querySelector('.badge-medallion svg')).not.toBeNull();
    expect(doc.querySelector('.art-badge img')).toBeNull();
  });

  it('previews the original ritual badge before fulfillment', () => {
    const state = badgeState('tanzaku-tanabata');
    state.wishes[0].status = 'realized';
    const doc = render(<FulfillWish id="wish" />, state);
    expect(doc.querySelector('.badge-preview .badge-medallion img')?.getAttribute('src')).toBe('/scene-icons/soft3d/tanzaku-tanabata.webp');
  });

  it('falls back on a broken image and retries when the source changes', () => {
    const ui = renderUI(<Art kind="badge" sceneId="crane" />);
    try {
      const image = ui.host.querySelector('img')!;
      act(() => image.dispatchEvent(new Event('error')));
      expect(ui.host.querySelector('.badge-medallion svg')).not.toBeNull();
      expect(ui.host.querySelector('img')).toBeNull();
      ui.rerender(<Art kind="badge" sceneId="tanzaku-tanabata" />);
      expect(ui.host.querySelector('.badge-medallion img')?.getAttribute('src')).toBe('/scene-icons/soft3d/tanzaku-tanabata.webp');
    } finally { ui.unmount(); }
  });
});
