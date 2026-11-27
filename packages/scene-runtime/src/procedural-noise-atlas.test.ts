import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  createProceduralNoiseAtlasData,
  getProceduralNoiseAtlas,
  NOISE_ATLAS_PARS,
  PROCEDURAL_NOISE_ATLAS_SIZE,
} from './procedural-noise-atlas';

describe('shared procedural noise atlas', () => {
  it('creates a lazy singleton 256x256 RGBA DataTexture with mipmapped repeat filtering', () => {
    const first = getProceduralNoiseAtlas();
    const second = getProceduralNoiseAtlas();

    expect(first).toBe(second);
    expect(first).toBeInstanceOf(THREE.DataTexture);
    expect(first.image.width).toBe(PROCEDURAL_NOISE_ATLAS_SIZE);
    expect(first.image.height).toBe(PROCEDURAL_NOISE_ATLAS_SIZE);
    expect(first.image.width).toBe(256);
    expect(first.image.height).toBe(256);
    expect(first.format).toBe(THREE.RGBAFormat);
    expect(first.colorSpace).toBe(THREE.NoColorSpace);
    expect(first.wrapS).toBe(THREE.RepeatWrapping);
    expect(first.wrapT).toBe(THREE.RepeatWrapping);
    expect(first.magFilter).toBe(THREE.LinearFilter);
    expect(first.minFilter).toBe(THREE.LinearMipmapLinearFilter);
    expect(first.generateMipmaps).toBe(true);
    expect(first.image.data).toBeInstanceOf(Uint8Array);
    expect(first.image.data.length).toBe(256 * 256 * 4);
  });

  it('is strictly deterministic without Math.random or DOM dependencies', () => {
    const a = createProceduralNoiseAtlasData(64, 5);
    const b = createProceduralNoiseAtlasData(64, 5);
    expect(a).toEqual(b);
  });

  it('populates all 4 channels with meaningful tonal range and anisotropic streak bias in A', () => {
    const atlas = getProceduralNoiseAtlas();
    const data = atlas.image.data as Uint8Array;
    const size = PROCEDURAL_NOISE_ATLAS_SIZE;

    const mins = [255, 255, 255, 255];
    const maxs = [0, 0, 0, 0];
    const sums = [0, 0, 0, 0];

    for (let i = 0; i < data.length; i += 4) {
      for (let c = 0; c < 4; c++) {
        const value = data[i + c];
        if (value < mins[c]) mins[c] = value;
        if (value > maxs[c]) maxs[c] = value;
        sums[c] += value;
      }
    }

    const pixels = size * size;
    for (let c = 0; c < 4; c++) {
      expect(maxs[c] - mins[c], `Channel ${c} dynamic range`).toBeGreaterThan(120);
      const mean = sums[c] / pixels;
      expect(mean, `Channel ${c} mean`).toBeGreaterThan(50);
      expect(mean, `Channel ${c} mean`).toBeLessThan(210);
    }

    // Channel A carries anisotropic streaks (sharper variation across U than along V).
    let diffU = 0;
    let diffV = 0;
    for (let y = 0; y < size; y++) {
      const yNext = (y + 1) % size;
      for (let x = 0; x < size; x++) {
        const xNext = (x + 1) % size;
        const idx = (y * size + x) * 4 + 3;
        diffU += Math.abs(data[(y * size + xNext) * 4 + 3] - data[idx]);
        diffV += Math.abs(data[(yNext * size + x) * 4 + 3] - data[idx]);
      }
    }
    expect(diffU).toBeGreaterThan(diffV * 4);
  });

  it('wraps seamlessly across U and V borders on every channel', () => {
    const atlas = getProceduralNoiseAtlas();
    const data = atlas.image.data as Uint8Array;
    const size = PROCEDURAL_NOISE_ATLAS_SIZE;

    for (let c = 0; c < 4; c++) {
      let seamU = 0;
      let interiorU = 0;
      let seamV = 0;
      let interiorV = 0;

      for (let y = 0; y < size; y++) {
        const left = (y * size + 0) * 4 + c;
        const right = (y * size + (size - 1)) * 4 + c;
        const midA = (y * size + 127) * 4 + c;
        const midB = (y * size + 128) * 4 + c;
        seamU += Math.abs(data[right] - data[left]);
        interiorU += Math.abs(data[midB] - data[midA]);
      }
      for (let x = 0; x < size; x++) {
        const top = (0 * size + x) * 4 + c;
        const bottom = ((size - 1) * size + x) * 4 + c;
        const midA = (127 * size + x) * 4 + c;
        const midB = (128 * size + x) * 4 + c;
        seamV += Math.abs(data[bottom] - data[top]);
        interiorV += Math.abs(data[midB] - data[midA]);
      }

      // Wrap delta across the border must stay in line with interior 1-texel step deltas.
      expect(seamU / size, `Channel ${c} U seam`).toBeLessThan((interiorU / size) * 1.45 + 3);
      expect(seamV / size, `Channel ${c} V seam`).toBeLessThan((interiorV / size) * 1.45 + 3);
    }
  });

  it('exports derivative-free triplanar GLSL helper with clean preprocessor formatting', () => {
    expect(NOISE_ATLAS_PARS).toContain('wbrAtlasTriplanar(sampler2D map, vec3 p, vec3 n)');
    expect(NOISE_ATLAS_PARS).not.toMatch(/\b(?:fwidth|dFdx|dFdy)\s*\(/);
    expect(NOISE_ATLAS_PARS.split('\n').filter(line => /\S.*#/.test(line))).toEqual([]);
  });
});
