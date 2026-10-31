import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assetFiles } from "../../../scripts/prepare-app-assets.mjs";
import { fontStyles } from "./assets";
import { builtInScenes } from "./scene-library";

/** Each @font-face block of the font CSS the App injects. */
const faces = fontStyles.match(/@font-face\{[^}]*\}/g) ?? [];
const nunito = faces.filter((face) => face.includes("font-family:'Nunito'"));

describe("bundled fonts", () => {
  it("ships Nunito's latin subset at 500, 700 and 900, so digits are rounded on every device", () => {
    expect(nunito.map((face) => face.match(/font-weight:(\d+);/)?.[1])).toEqual([
      "500",
      "700",
      "900",
    ]);
    for (const face of nunito) {
      // Let the bundled font provide its punctuation and Extended Latin glyphs.
      expect(face).not.toMatch(/unicode-range:U\+0000-00FF;/);
      expect(face).toMatch(/font-display:swap;/);
    }
  });

  it("loads every face from the App's own assets, never the network", () => {
    const files = faces.map((face) => face.match(/src:url\('\/([^']+)'\)/)?.[1]);
    expect(files).toHaveLength(4);
    for (const file of files) {
      expect(file).toMatch(/^fonts\/[\w.-]+\.woff2$/);
      // Copied into both apps' public dirs (and checked in the Expo export).
      expect(assetFiles).toContain(file);
      expect(existsSync(new URL(`../../../assets/${file}`, import.meta.url)), file).toBe(true);
    }
    // The OFL travels with Nunito, as with Noto Sans SC.
    expect(assetFiles).toContain("fonts/nunito-OFL.txt");
  });

  it("puts the bundled Nunito first in the island's rounded stack", () => {
    const css = readFileSync(new URL("./style.css", import.meta.url), "utf8");
    expect(css).toMatch(/--font-round: "Nunito", /);
  });
});

describe("bundled scene illustrations", () => {
  it("retires the old ritual sheet while retaining the active badge sheet", () => {
    expect(assetFiles).not.toContain("reference-ui/rituals.png");
    expect(existsSync(new URL("../../../assets/reference-ui/rituals.png", import.meta.url))).toBe(false);
    expect(assetFiles).toContain("reference-ui/wishes.png");
    expect(existsSync(new URL("../../../assets/reference-ui/wishes.png", import.meta.url))).toBe(true);
  });

  it("keeps the subject review inventory aligned with current and historical scenes", () => {
    const inventory = JSON.parse(readFileSync(new URL("../../../assets/scene-icons/soft3d/subjects.json", import.meta.url), "utf8")) as { subjects: { id: string }[] };
    expect(inventory.subjects.map(({ id }) => id).sort()).toEqual(builtInScenes.map(({ id }) => id).sort());
  });

  it("includes every current and historical scene image in both apps' public assets", () => {
    const icons = assetFiles.filter(file => file.startsWith("scene-icons/soft3d/"));
    expect(icons.sort()).toEqual(builtInScenes.map(({ id }) => `scene-icons/soft3d/${id}.webp`).sort());
  });

  it("ships nonempty WebP data for every listed illustration", () => {
    for (const { id } of builtInScenes) {
      const file = `scene-icons/soft3d/${id}.webp`;
      const source = new URL(`../../../assets/${file}`, import.meta.url);
      expect(existsSync(source), file).toBe(true);
      const bytes = readFileSync(source);
      expect(bytes.length, file).toBeGreaterThan(12);
      expect(bytes.toString("ascii", 0, 4), file).toBe("RIFF");
      expect(bytes.toString("ascii", 8, 12), file).toBe("WEBP");
    }
  });
});
