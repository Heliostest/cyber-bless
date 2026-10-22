import { BlendFunction, Effect, EffectAttribute } from "postprocessing";
import { Uniform } from "three";

/**
 * Small, edge-preserving Kuwahara footprint, inspired by Maxime Heckel's
 * "On Crafting Painterly Shaders". Original implementation: four overlapping
 * quadrants share nine texture reads, with continuous variance weights to
 * avoid sector-switch flicker. No time noise, UV distortion or remote assets.
 * Runs after tone mapping, in linear display-range RGB, before sRGB output.
 */
export function createGouacheEffect() {
  return new Effect("Gouache", /* glsl */ `
    uniform float brushRadius;
    uniform float paintStrength;

    void accumulatePaint(vec4 a, vec4 b, vec4 c, vec4 d, inout vec3 paint, inout float weight) {
      // Premultiply only for filtering: transparent neighbors must not bleed black.
      float coverage = a.a + b.a + c.a + d.a;
      vec3 mean = (a.rgb*a.a + b.rgb*b.a + c.rgb*c.a + d.rgb*d.a) / max(coverage, 0.0001);
      vec3 square = (a.rgb*a.rgb*a.a + b.rgb*b.rgb*b.a + c.rgb*c.rgb*c.a + d.rgb*d.rgb*d.a) / max(coverage, 0.0001);
      float variance = dot(max(vec3(0.0), square - mean*mean), vec3(0.2126, 0.7152, 0.0722));
      float w = pow(1.0 + 180.0*variance, -4.0) * coverage;
      paint += mean*w;
      weight += w;
    }

    void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
      if (inputColor.a < 0.001) { outputColor = inputColor; return; }
      vec2 px = texelSize * brushRadius;
      vec4 nw = texture2D(inputBuffer, uv + px*vec2(-1.0, 1.0));
      vec4 n  = texture2D(inputBuffer, uv + px*vec2( 0.0, 1.0));
      vec4 ne = texture2D(inputBuffer, uv + px*vec2( 1.0, 1.0));
      vec4 w  = texture2D(inputBuffer, uv + px*vec2(-1.0, 0.0));
      vec4 e  = texture2D(inputBuffer, uv + px*vec2( 1.0, 0.0));
      vec4 sw = texture2D(inputBuffer, uv + px*vec2(-1.0,-1.0));
      vec4 s  = texture2D(inputBuffer, uv + px*vec2( 0.0,-1.0));
      vec4 se = texture2D(inputBuffer, uv + px*vec2( 1.0,-1.0));
      vec3 paint = vec3(0.0);
      float weight = 0.0;
      accumulatePaint(inputColor, n, w, nw, paint, weight);
      accumulatePaint(inputColor, n, e, ne, paint, weight);
      accumulatePaint(inputColor, s, w, sw, paint, weight);
      accumulatePaint(inputColor, s, e, se, paint, weight);
      // Keep pigment boundaries and small markings crisp; soften surface detail.
      float edge = length(fwidth(inputColor.rgb));
      vec3 color = mix(inputColor.rgb, paint/max(weight, 0.0001), paintStrength*(1.0-smoothstep(0.025, 0.16, edge)));
      float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
      color = mix(vec3(luminance), color, 0.94);
      // Bring yellow-green foliage toward sage without rotating reds or blues.
      float foliage = smoothstep(0.015, 0.12, color.g-color.r) * smoothstep(0.025, 0.16, color.g-color.b);
      color = mix(color, luminance*vec3(0.78, 1.07, 0.86), foliage*0.42);
      // Cool shaded pigment, warm lit paper; preserve blacks and luminous flames.
      float shadows = (1.0-smoothstep(0.12, 0.65, luminance))*smoothstep(0.0, 0.07, luminance);
      color += vec3(-0.006, 0.002, 0.018)*shadows;
      color += vec3(0.012, 0.003,-0.008)*smoothstep(0.35, 0.85, luminance);
      // A static sub-pixel paper tooth, intentionally below obvious screen noise.
      vec2 paper = uv*resolution;
      float grain = fract(52.9829189*fract(dot(floor(paper), vec2(0.06711056, 0.00583715))))-0.5;
      color += grain*0.006*smoothstep(0.0, 0.12, luminance);
      outputColor = vec4(clamp(color, 0.0, 1.0), inputColor.a);
    }
  `, {
    blendFunction: BlendFunction.NORMAL,
    attributes: EffectAttribute.CONVOLUTION,
    uniforms: new Map([
      ["brushRadius", new Uniform(2.4)],
      ["paintStrength", new Uniform(0.88)],
    ]),
  });
}
