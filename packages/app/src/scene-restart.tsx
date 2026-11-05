import { translate as tr } from '@wbr/i18n';

/** Shared by App completions and the public scene player. */
export function SceneRestartButton({ onRestart, disabled = false }: {
  onRestart(): void;
  disabled?: boolean;
}) {
  return <button type="button" data-audio-cue="navigate" className="button outline scene-restart"
    disabled={disabled} onClick={event => { if (event.detail <= 1) onRestart(); }}>
    {tr('从头体验')}
  </button>;
}
