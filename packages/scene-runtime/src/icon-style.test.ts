import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import palettes from './icon-style-palettes.generated.json';
import { SCENE_ICON_IDS } from '../../app/src/scene-icon-assets';
import { calibrateIconPigment, softenObjectLighting } from './icon-style';

describe('production icon art direction', () => {
  it('has a local, finite palette for every current and retained icon', () => {
    expect(Object.keys(palettes).sort()).toEqual([...SCENE_ICON_IDS].sort());
    for (const anchors of Object.values(palettes)) for (const anchor of anchors)
      expect(anchor.every(value => Number.isFinite(value) && value >= 0 && value <= 1)).toBe(true);
  });
  it('nudges within the same color family with bounded changes and keeps its source intact', () => {
    const source = new THREE.Color(0xb78b59), before = source.clone(), target = new THREE.Color();
    calibrateIconPigment(target, source, 'woodfish');
    const a = source.getHSL({h:0,s:0,l:0}, THREE.SRGBColorSpace), b = target.getHSL({h:0,s:0,l:0}, THREE.SRGBColorSpace);
    expect(source.equals(before)).toBe(true); expect(b.h).toBeCloseTo(a.h, 6);
    expect(Math.abs(b.s-a.s)).toBeLessThan(.08); expect(Math.abs(b.l-a.l)).toBeLessThan(.04);
    expect(target.equals(source)).toBe(false);
  });
  it.each([0x090909, 0xfaf8ef, 0x828582])('preserves protected dark, white and low-chroma colors: %s', hex => {
    const source = new THREE.Color(hex), target = new THREE.Color(); calibrateIconPigment(target, source, 'omamori-cycle'); expect(target.equals(source)).toBe(true);
  });
  it('follows new source colors and does not invent an unknown scene palette', () => {
    const source = new THREE.Color(0xb23a38), target = new THREE.Color(); calibrateIconPigment(target, source, 'omamori-cycle');
    source.set(0x578f62); calibrateIconPigment(target, source, 'omamori-cycle');
    expect(target.getHSL({h:0,s:0,l:0}, THREE.SRGBColorSpace).h).toBeCloseTo(source.getHSL({h:0,s:0,l:0}, THREE.SRGBColorSpace).h, 6);
    calibrateIconPigment(target, source, 'unknown'); expect(target.equals(source)).toBe(true);
  });
  it('softens daytime shadow contrast, keeps dim and local lighting dim, and restores exactly', () => {
    const scene = new THREE.Scene(), sun = new THREE.DirectionalLight(0xffedda, 3.8), moon = new THREE.DirectionalLight(0xabcfff, .65), lamp = new THREE.PointLight(0xff6611, .73);
    scene.add(sun, moon, lamp); sun.shadow.radius = 1; sun.shadow.intensity = .9;
    const color = sun.color.clone(), position = sun.position.clone(), frame = softenObjectLighting(scene, 'crane');
    expect(sun.intensity).toBeLessThan(3.8); expect(moon.intensity).toBeLessThanOrEqual(.65); expect(lamp.intensity).toBe(.73);
    frame.restore(); expect(sun.intensity).toBe(3.8); expect(sun.shadow.radius).toBe(1); expect(sun.shadow.intensity).toBe(.9);
    expect(sun.color.equals(color)).toBe(true); expect(sun.position.equals(position)).toBe(true);
  });
});
