import { describe, expect, it } from 'vitest';
import { restore } from '../packages/core/src/index';
import { LAYOUT_ACTIVE_WISH, USER_NOTE_COLLISION, USER_NOTE_DRAFT, USER_WISH_TITLE,
  emptyLayoutState, populatedLayoutState } from './fixtures/i18n-layout-state.mjs';

describe('browser layout saved-state fixtures', () => {
  it.each(['zh-Hans', 'zh-Hant', 'en', 'ja', 'ko', 'es', 'pt', 'fr'])('restores meaningful populated routes and exact user text in %s', locale => {
    const state = restore(JSON.stringify(populatedLayoutState(locale)));
    expect(state.settings.locale).toBe(locale);
    const wish = state.wishes.find(wish => wish.id === LAYOUT_ACTIVE_WISH)!;
    expect(wish.title).toBe(USER_WISH_TITLE);
    expect(wish.notes[0].text).toBe(USER_NOTE_COLLISION);
    expect(wish.notes).toHaveLength(3);
    expect(state.collectibles).toHaveLength(6);
    expect(state.sessions).toHaveLength(1);
    expect(state.sceneRecords).toHaveLength(2);
    expect(state.vesselDrafts?.['layout-vessel-pending'].line).toBe('Un vœu gardé · 平安 🌿');
  });
  it('keeps editor stress text within actual user-perceived input limits', () => {
    const count = (text: string) => [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].length;
    expect(count(USER_WISH_TITLE)).toBeLessThanOrEqual(60);
    expect(count(USER_NOTE_DRAFT)).toBeLessThanOrEqual(500);
    expect(restore(JSON.stringify(emptyLayoutState('fr'))).wishes).toHaveLength(0);
  });
});
