import { useState, useSyncExternalStore } from "react";
import { debugStyles, styleOptions, styleParameterControls } from "@wbr/scene-runtime/debug-styles";
import "./debug-overlay.css";
import { translate as tr, translateScene, formatNumber } from '@wbr/i18n';
import { useDeveloperLocale } from './locale';

export const debugEnabled = import.meta.env.DEV ||
  new URLSearchParams(window.location.search).get("debug") === "1";

if (debugEnabled) {
  let storage: Storage | undefined;
  try { storage = window.localStorage; } catch { /* Preview works without storage. */ }
  debugStyles.enable(storage);
}

export function DebugOverlay() {
  useDeveloperLocale();
  const scenes = useSyncExternalStore(debugStyles.subscribe, debugStyles.getSnapshot);
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const scene = scenes.find((item) => item.id === selectedId) ?? scenes[0];
  const selected = scene?.override ?? scene?.userStyle ?? scene?.defaultStyle;
  const actualLabel = styleOptions.find((style) => style.id === scene?.actual)?.label;
  const controls = styleParameterControls.filter(control => control.style === selected);

  return (
    <aside className="debug-overlay" aria-label={tr('场景 Shader 调试')}>
      <button className="debug-overlay-toggle" type="button" aria-expanded={open}
        aria-controls="debug-overlay-panel" onClick={() => setOpen(!open)}>
        <span aria-hidden="true">◈</span> {tr('Shader 调试台')} <span>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <section id="debug-overlay-panel" className="debug-overlay-panel">
          <header><span>{tr('实时风格预览')}</span><small>THREE.JS</small></header>
          {scene ? <>
            <label className="debug-overlay-label" htmlFor="debug-scene">{tr('当前场景')}</label>
            <select id="debug-scene" value={scene.id} onChange={(event) => setSelectedId(event.target.value)}>
              {scenes.map((item, index) => <option key={`${item.id}-${index}`} value={item.id}>{translateScene(item.label)}</option>)}
            </select>
            {controls.length > 0 && <fieldset className="debug-overlay-parameters">
              <legend>{tr('风格参数')}</legend>
              {controls.map(control => {
                const value = scene.parameters[control.key];
                const formatted = control.unit === "%" ? formatNumber(value, { style: 'percent' }) : `${formatNumber(value)} ${tr(control.unit)}`;
                return <div className="debug-overlay-parameter" key={control.key}>
                  <div><label htmlFor={`debug-${control.key}`}>{tr(control.label)}</label>
                    <output htmlFor={`debug-${control.key}`}>{formatted}</output></div>
                  <input id={`debug-${control.key}`} type="range" min={control.min} max={control.max}
                    step={control.step} value={value} aria-valuetext={formatted}
                    onChange={event => debugStyles.setParameters(scene.id, { [control.key]: Number(event.target.value) })} />
                </div>;
              })}
              <button type="button" className="debug-overlay-parameter-reset"
                onClick={() => debugStyles.resetParameters(scene.id, selected!)}>{tr('重置参数')}</button>
            </fieldset>}
            <div className="debug-overlay-presets" role="group" aria-label={tr('Shader 风格')}>
              {styleOptions.map((style, index) => (
                <button key={style.id} type="button" aria-pressed={selected === style.id}
                  onClick={() => debugStyles.select(scene.id, style.id)}>
                  <span className={`debug-overlay-swatch debug-overlay-swatch-${style.id}`} aria-hidden="true" />
                  <span><strong>{tr(style.label)}</strong><small>{tr(style.detail)}</small></span>
                  <em>{formatNumber(index + 1, { minimumIntegerDigits: 2 })}</em>
                </button>
              ))}
            </div>
            <p className="debug-overlay-status" role="status">
              {scene.actual !== selected ? tr('Shader 未生效，已回退至{style}', { style: tr(actualLabel ?? '') }) : tr('正在使用{style}', { style: tr(actualLabel ?? '') })}
              <small>{scene.override !== null ? tr('本机调试覆盖 · 已即时应用') : scene.userStyle !== null ? tr('跟随此仪式的视觉设置') : tr('跟随内容默认值')}</small>
            </p>
            <button className="debug-overlay-reset" type="button" disabled={scene.override === null}
              onClick={() => debugStyles.select(scene.id, null)}>{scene.userStyle !== null ? tr('恢复用户设置') : tr('恢复内容默认')}</button>
          </> : <p className="debug-overlay-empty">{tr('进入一个 Three.js 场景后，即可实时切换风格。')}</p>}
          <footer>{tr('按场景保存在此浏览器，仅在调试模式生效。')}</footer>
        </section>
      )}
    </aside>
  );
}
