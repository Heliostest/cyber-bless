/** Shared authoring paths for Vite and Expo's offline public asset copies. */
export const UI_SOUND_FILES = {
  navigate: 'ui-sounds/soft-garden-v1/navigate.wav',
  back: 'ui-sounds/soft-garden-v1/back.wav',
  select: 'ui-sounds/soft-garden-v1/select.wav',
  open: 'ui-sounds/soft-garden-v1/open.wav',
  close: 'ui-sounds/soft-garden-v1/close.wav',
  toggleOn: 'ui-sounds/soft-garden-v1/toggleOn.wav',
  toggleOff: 'ui-sounds/soft-garden-v1/toggleOff.wav',
  // The reserved notice cue reuses the light selection sound.
  notice: 'ui-sounds/soft-garden-v1/select.wav',
  saved: 'ui-sounds/soft-garden-v1/saved.wav',
  collect: 'ui-sounds/soft-garden-v1/collect.wav',
  complete: 'ui-sounds/soft-garden-v1/complete.wav',
} as const;

/** Protect the entire result phrase from same-action navigation feedback. */
export const RESULT_SOUND_DURATIONS = { saved: .52, collect: .61, complete: .93 } as const;
