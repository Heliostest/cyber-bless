/** Completion checkpoints belong to the experience, not a fixed three-step UI. */
export function sceneStepCount(entry: { id: string; engine: string }): number {
  if (entry.engine === 'woodfish@1') return 12;
  if (entry.id === 'tibetan-water-bowls' && entry.engine === 'tibetan-water-bowls@1') return 9;
  if (entry.id === 'furin-wind-chime' && entry.engine === 'furin-wind-chime@1') return 5;
  return 3;
}

/** Preserve legacy three-step checkpoints when a scene gains preparation steps. */
export function sceneProgress(record: { id: string; engine: string; progress: number; steps?: number }): number {
  if (record.id === 'furin-wind-chime' && record.engine === 'furin-wind-chime@1'
    && (record.steps === undefined || record.steps === 3)) {
    return [0, 3, 4, 5][Math.min(record.progress, 3)]!;
  }
  if (record.id === 'tibetan-water-bowls' && record.engine === 'tibetan-water-bowls@1'
    && (record.steps === undefined || record.steps === 3)) {
    return [0, 1, 8, 9][Math.min(record.progress, 3)]!;
  }
  return record.progress;
}
