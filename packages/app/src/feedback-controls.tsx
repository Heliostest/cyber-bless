import { Icon } from "./art";
import { useApp } from "./context";

/**
 * Compact feedback controls in the scene header. The glyph and pressed state
 * both reflect the saved setting; unsupported haptics stay out of the header.
 */
export function FeedbackControls() {
  const { state, dispatch, canHaptic } = useApp();
  return (
    <div className="feedback-controls" role="group" aria-label="体验反馈">
      {(
        [
          ["sound", "音效"],
          ["haptics", "震动"],
        ] as const
      )
        .filter(([key]) => key !== "haptics" || canHaptic)
        .map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-label={label}
            aria-pressed={state.settings[key]}
            title={`${label}已${state.settings[key] ? "开启" : "关闭"}`}
            onClick={() => dispatch({ type: "settings", key, value: !state.settings[key] })}
          >
            <Icon name={state.settings[key] ? key : `${key}-off`} />
          </button>
        ))}
    </div>
  );
}
