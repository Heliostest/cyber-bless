import { describe, expect, it } from 'vitest';
import { BLESSING_SCENE_IDS, WISH_SCENE_IDS, builtInScenes, dailyPrimaryScene, isSceneVisibleInApp } from './daily-scenes';
import { sceneIntention } from './scene-intentions';

const id = 'hindu-coconut-offering';

describe('coconut offering catalog integration', () => {
  it('offers the sourced coconut fragment as a visible daily blessing without a wish form', () => {
    const entry = builtInScenes.find(scene => scene.id === id);
    expect(entry).toMatchObject({ id, title: '椰果献愿', engine: `${id}@1`, traditionSlug: id });
    expect(isSceneVisibleInApp({ id })).toBe(true);
    expect(BLESSING_SCENE_IDS).toContain(id);
    expect(WISH_SCENE_IDS).not.toContain(id);
    expect(dailyPrimaryScene([entry!], '2026-10-23')?.id).toBe(id);
    expect(sceneIntention(id)).toMatchObject({ kind: 'blessing', optionalWish: false });
  });

  it('keeps the temple explanation separate from the three product gestures', () => {
    const narrative = builtInScenes.find(scene => scene.id === id)?.narrative ?? '';
    const paragraphs = narrative.split('\n\n');
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]).toContain('神明');
    expect(paragraphs[0]).toContain('象头神');
    expect(paragraphs[1]).toContain('三段');
    expect(paragraphs[1]).toContain('托盘');
    for (const paragraph of paragraphs) expect(paragraph.length).toBeLessThan(160);
  });
});
