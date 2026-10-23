/** Completion checkpoints belong to the experience, not a fixed three-step UI. */
export function sceneStepCount(entry: { id: string; engine: string }): number {
  if (entry.engine === 'woodfish@1') return 12;
  if (entry.id === 'tibetan-water-bowls' && entry.engine === 'tibetan-water-bowls@1') return 9;
  return 3;
}

/** Old bowl saves stored lift / all seven bowls / put away as 0..3. */
export function sceneProgress(record: { id: string; engine: string; progress: number; steps?: number }): number {
  if (record.id === 'tibetan-water-bowls' && record.engine === 'tibetan-water-bowls@1'
    && (record.steps === undefined || record.steps === 3)) {
    return [0, 1, 8, 9][Math.min(record.progress, 3)]!;
  }
  return record.progress;
}
