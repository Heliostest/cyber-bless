import { useState } from "react";
import { Icon } from "./art";
import { assetUrl } from "./assets";
import { sceneIconFile } from "./scene-icon-assets";

/** Whether a scene has its own bundled illustration. */
export function hasSceneIcon(id: string): boolean {
  return sceneIconFile(id) !== undefined;
}

/** The scene's decorative illustration, or nothing for an unknown scene. */
export function SceneIcon({ id }: { id: string }) {
  const file = sceneIconFile(id);
  return file ? <SceneImage key={id} file={file} /> : null;
}

function SceneImage({ file }: { file: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <Icon name="leaf" />;
  return (
    <img
      className="scene-icon"
      src={assetUrl(file)}
      width={256}
      height={256}
      alt=""
      aria-hidden="true"
      draggable={false}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

/** A scene's illustration in its existing tinted list badge. */
export function SceneBadge({ id }: { id: string }) {
  return (
    <span className="scene-badge" data-scene={id} aria-hidden="true">
      {hasSceneIcon(id) ? <SceneIcon id={id} /> : <Icon name="leaf" />}
    </span>
  );
}

/** A scene illustration in the existing small item slot. */
export function SceneArt({ id }: { id: string }) {
  return (
    <div className="art art-small scene-art" data-scene={id} aria-hidden="true">
      {hasSceneIcon(id) ? <SceneIcon id={id} /> : <Icon name="leaf" />}
    </div>
  );
}
