import { message } from '@wbr/i18n';
import { getSceneVisualFeatures, type SceneVisualFeature } from '@wbr/scene-runtime/scene-visual-features';
import './scene-visual-features.css';

const icons: Record<SceneVisualFeature, string> = {
  water: '💧', liquid: '🥣', day: '☀️', night: '🌙', lighting: '💡', 'warm-light': '🟠',
  'point-light': '🔆', transparent: '🫧', glass: '🔮', flame: '🔥', smoke: '🌫️',
  broadleaf: '🌳', 'mixed-trees': '🌲', cherry: '🌸', cypress: '🌲', willow: '🌿', conifer: '🌲',
  toona: '🌿', acer: '🍃', maple: '🍁', bamboo: '🎋', bodhi: '🌳', 'wish-tree': '🌳',
};

export function sceneVisualLabels(id: string) {
  return getSceneVisualFeatures(id).map(feature => message(`app.sceneVisual.${feature}`));
}

/** Native select options cannot contain styled markup. Keep their icons and accessible text aligned. */
export function sceneVisualOptionSuffix(id: string) {
  return getSceneVisualFeatures(id).map(feature => `${icons[feature]} ${message(`app.sceneVisual.${feature}`)}`).join(' · ');
}

function Feature({ feature }: { feature: SceneVisualFeature }) {
  const label = message(`app.sceneVisual.${feature}`);
  return <span className="scene-visual-feature" data-visual-feature={feature} title={label}>
    <span aria-hidden="true">{icons[feature]}</span><span>{label}</span>
  </span>;
}

export function SceneVisualFeatures({ id }: { id: string }) {
  const features = getSceneVisualFeatures(id);
  if (!features.length) return null;
  return <span className="scene-visual-features" role="group" aria-label={message('app.sceneVisual.title')}>
    {features.map(feature => <Feature key={feature} feature={feature} />)}
  </span>;
}

export function SceneVisualLegend() {
  return <details className="scene-visual-legend">
    <summary>{message('app.sceneVisual.legend')}</summary>
    <p>{message('app.sceneVisual.help')}</p>
    <span className="scene-visual-features">
      {(Object.keys(icons) as SceneVisualFeature[]).map(feature => <Feature key={feature} feature={feature} />)}
    </span>
  </details>;
}
