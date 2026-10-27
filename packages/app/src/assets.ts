declare const process: { env: { EXPO_BASE_URL?: string } };
/** Expo embeds public resources next to its DOM HTML; Vite serves them at /. */
export function assetUrl(file: string) {
  const base = process.env.EXPO_BASE_URL || "/";
  return `${base.replace(/\/$/, "")}/${file.replace(/^\/+/, "")}`;
}
const face = (family: string, file: string, weight: string, extra = "") =>
  `@font-face{font-family:'${family}';src:url('${assetUrl(`fonts/${file}`)}') format('woff2');font-weight:${weight};font-style:normal;font-display:swap;${extra}}`;
/** The local Nunito files include Latin punctuation beyond U+00FF. Do not
 * artificially exclude it. Locale stacks choose regional CJK system fonts;
 * the bundled SC face is only the Simplified Chinese offline fallback. */
export const fontStyles =
  face("Blessing Sans", "noto-sans-sc.woff2", "100 900") +
  [500, 700, 900]
    .map((weight) =>
      face("Nunito", `nunito-latin-${weight}-normal.woff2`, `${weight}`),
    )
    .join("");
