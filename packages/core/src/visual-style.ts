export const visualStyleOptions = [
  { id: "halftone", label: "网点印刷", detail: "彩色油墨 · CMYK 网点" },
  { id: "pixel-art", label: "复古像素", detail: "像素色块 · 单像素边缘" },
  { id: "toon-outline", label: "卡通描边", detail: "分层明暗 · 深色外轮廓" },
  { id: "moebius", label: "Moebius 手绘漫画", detail: "细墨线 · 清晰色块 · 暗部排线" },
  { id: "gouache", label: "水粉插画", detail: "柔润色彩 · 轻笔触 · 细轮廓" },
  { id: "original", label: "原始光照", detail: "保留材质与自然明暗" },
  { id: "toon-ink", label: "墨线卡通", detail: "插画色块 · 几何细轮廓" },
  { id: "toon-soft", label: "柔和卡通", detail: "哑光玩具 · 柔和明暗" },
  { id: "gallery-toon", label: "图库卡通", detail: "分层明暗 · 轻轮廓光" },
  { id: "pencil-hatch", label: "铅笔排线", detail: "暗部排线 · 保留原色" },
  { id: "height-palette", label: "高度配色", detail: "高度渐变 · 分层色彩" },
  { id: "normal-palette", label: "法线配色", detail: "朝向着色 · 彩色表面" },
  { id: "sketch-contour", label: "纸墨轮廓", detail: "纸色填充 · 手绘细线" },
  { id: "gallery-outline", label: "法线描边", detail: "几何折角 · 清晰轮廓" },
  { id: "space-grade", label: "柔光调色", detail: "柔光扩散 · 暗角颗粒" },
  { id: "depth-rim", label: "深度边缘光", detail: "方向轮廓光 · 深色细边" },
] as const;

/** Validated visual controls shared by the App and development tools; content defaults stay independent. */
export const styleParameterControls = [
  { style: "halftone", key: "halftoneSize", label: "网点大小", min: 2, max: 16, step: 0.5, unit: "px" },
  { style: "halftone", key: "halftoneStrength", label: "效果强度", min: 0, max: 1, step: 0.01, unit: "%" },
  { style: "pixel-art", key: "pixelSize", label: "像素大小", min: 1, max: 12, step: 1, unit: "px" },
  { style: "moebius", key: "moebiusWidth", label: "描边粗细", min: 0.25, max: 3, step: 0.05, unit: "px" },
  { style: "moebius", key: "moebiusLevels", label: "色阶", min: 2, max: 12, step: 1, unit: "级" },
  { style: "moebius", key: "hatchStrength", label: "排线强度", min: 0, max: 1, step: 0.01, unit: "%" },
  { style: "toon-outline", key: "toonWidth", label: "描边粗细", min: 0.5, max: 4, step: 0.25, unit: "×" },
  { style: "toon-outline", key: "toonLevels", label: "色阶", min: 2, max: 8, step: 1, unit: "级" },
  { style: "gallery-toon", key: "galleryLevels", label: "色阶", min: 2, max: 8, step: 1, unit: "级" },
  { style: "gallery-toon", key: "galleryRim", label: "轮廓光强度", min: 0, max: 1, step: 0.01, unit: "%" },
  { style: "pencil-hatch", key: "pencilScale", label: "排线密度", min: 6, max: 60, step: 1, unit: "×" },
  { style: "pencil-hatch", key: "pencilStrength", label: "排线强度", min: 0, max: 1, step: 0.01, unit: "%" },
  { style: "height-palette", key: "paletteStrength", label: "配色强度", min: 0, max: 1, step: 0.01, unit: "%" },
  { style: "normal-palette", key: "normalStrength", label: "法线色彩强度", min: 0, max: 1, step: 0.01, unit: "%" },
  { style: "sketch-contour", key: "sketchWidth", label: "描边粗细", min: 0.5, max: 3, step: 0.1, unit: "px" },
  { style: "sketch-contour", key: "sketchStrength", label: "纸墨强度", min: 0, max: 1, step: 0.01, unit: "%" },
  { style: "gallery-outline", key: "galleryOutlineWidth", label: "描边粗细", min: 0.5, max: 3, step: 0.1, unit: "px" },
  { style: "gallery-outline", key: "galleryOutlineLevels", label: "色阶", min: 2, max: 8, step: 1, unit: "级" },
  { style: "space-grade", key: "glowStrength", label: "柔光强度", min: 0, max: 1, step: 0.01, unit: "%" },
  { style: "space-grade", key: "vignetteStrength", label: "暗角强度", min: 0, max: 0.6, step: 0.01, unit: "%" },
  { style: "space-grade", key: "grainStrength", label: "颗粒强度", min: 0, max: 0.08, step: 0.005, unit: "%" },
  { style: "depth-rim", key: "rimWidth", label: "边缘光宽度", min: 1, max: 8, step: 0.5, unit: "px" },
  { style: "depth-rim", key: "rimStrength", label: "边缘光强度", min: 0, max: 1, step: 0.01, unit: "%" },
  { style: "depth-rim", key: "rimDirection", label: "边缘光方向", min: 0, max: 360, step: 5, unit: "°" },
] as const;

export type RenderStyleParameters = Record<typeof styleParameterControls[number]["key"], number>;
export const DEFAULT_STYLE_PARAMETERS: Readonly<RenderStyleParameters> = Object.freeze({
  halftoneSize: 4, halftoneStrength: 0.58, pixelSize: 3,
  moebiusWidth: 0.85, moebiusLevels: 8, hatchStrength: 0.5, toonWidth: 1, toonLevels: 3,
  galleryLevels: 4, galleryRim: 0.18, pencilScale: 24, pencilStrength: 0.65,
  paletteStrength: 0.65, normalStrength: 0.7, sketchWidth: 1.2, sketchStrength: 0.85,
  galleryOutlineWidth: 1.1, galleryOutlineLevels: 4, glowStrength: 0.3,
  vignetteStrength: 0.18, grainStrength: 0.02, rimWidth: 3, rimStrength: 0.6, rimDirection: 40,
});

export function normalizeStyleParameters(value: unknown, base = DEFAULT_STYLE_PARAMETERS): RenderStyleParameters {
  const parameters = { ...base };
  if (!value || typeof value !== "object" || Array.isArray(value)) return parameters;
  const input = value as Record<string, unknown>;
  for (const control of styleParameterControls) {
    const candidate = input[control.key];
    if (typeof candidate !== "number" || !Number.isFinite(candidate)) continue;
    const bounded = Math.min(control.max, Math.max(control.min, candidate));
    parameters[control.key] = Number((Math.round(bounded / control.step) * control.step).toFixed(4));
  }
  return parameters;
}

export type VisualStyleId = typeof visualStyleOptions[number]["id"];
export type VisualStylePreference = { style: VisualStyleId; parameters: RenderStyleParameters };
export type VisualPreferenceInput = { style: VisualStyleId; parameters?: Partial<RenderStyleParameters> };
/** Local overrides take priority; unopened rituals also inherit the shared choice. */
export function getSceneVisualPreference(state: {
  visualStyles?: Record<string, VisualStylePreference>;
  globalVisualStyle?: VisualStylePreference;
}, id: string): VisualStylePreference | undefined {
  return state.visualStyles?.[id] ?? state.globalVisualStyle;
}
export const isVisualStyle = (value: unknown): value is VisualStyleId => visualStyleOptions.some(option => option.id === value);
export const isVisualSceneId = (value: string) => /^[a-zA-Z0-9][a-zA-Z0-9._@-]{0,95}$/.test(value) && !["__proto__", "constructor", "prototype"].includes(value);

/** Cosmetic corruption must never prevent access to wishes or ritual progress. */
export function normalizeVisualPreference(value: unknown): VisualStylePreference | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  return isVisualStyle(record.style) ? { style: record.style, parameters: normalizeStyleParameters(record.parameters) } : null;
}
export function restoreVisualStyles(value: unknown): Record<string, VisualStylePreference> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).flatMap(([id, data]) => {
    const preference = normalizeVisualPreference(data);
    return isVisualSceneId(id) && preference ? [[id, preference]] : [];
  }));
}
