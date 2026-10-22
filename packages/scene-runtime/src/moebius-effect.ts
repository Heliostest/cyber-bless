import { BlendFunction, Effect, EffectAttribute } from "postprocessing";
import { Texture, Uniform } from "three";

/** Original lightweight interpretation of depth/normal ink and crosshatched tones.
 * Reference: Maxime Heckel, "Moebius-style post-processing and other stylized shaders".
 * The input is tone-mapped linear RGB; only the final EffectPass encodes sRGB.
 */
export function createMoebiusEffect(normalTexture: Texture, subjectDepth: Texture, pixelRatio: number) {
  return new Effect("Moebius", /* glsl */ `
    uniform sampler2D normalTexture;
    uniform sampler2D subjectDepth;
    uniform float pixelRatio;
    uniform float lineWidth;
    uniform float colorLevels;
    uniform float hatchStrength;

    float stripe(float coordinate) {
      float distance = abs(fract(coordinate/7.0)-0.5)*7.0;
      return 1.0-smoothstep(0.35, 0.35+max(fwidth(coordinate), 0.65)*0.7, distance);
    }

    void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
      float depth = readDepth(uv);
      // No ink or hatching in the sky, empty alpha, or the far scenery.
      if (inputColor.a < 0.001 || depth >= 0.999999) { outputColor = inputColor; return; }
      float distanceToCamera = -getViewZ(depth);
      vec4 normalSample = texture2D(normalTexture, uv);
      float subjectDistance = -getViewZ(texture2D(subjectDepth, uv).r);
      // A selected object behind a wall/table must not draw a ghost line through it.
      float subject = normalSample.a*float(abs(subjectDistance-distanceToCamera) < max(0.004, distanceToCamera*0.002));
      float nearDetail = 1.0-smoothstep(8.0, 18.0, distanceToCamera);
      vec2 px = texelSize*pixelRatio*lineWidth;
      vec3 centerNormal = normalSample.rgb;
      float normalEdge = 0.0;
      float depthEdge = 0.0;
      for (int i=0; i<4; i++) {
        vec2 direction = i == 0 ? vec2(1.0,0.0) : i == 1 ? vec2(-1.0,0.0) : i == 2 ? vec2(0.0,1.0) : vec2(0.0,-1.0);
        vec2 sampleUv = clamp(uv+direction*px, vec2(0.0), vec2(1.0));
        normalEdge = max(normalEdge, length(centerNormal-texture2D(normalTexture, sampleUv).rgb));
        depthEdge = max(depthEdge, abs(getViewZ(readDepth(sampleUv))+distanceToCamera)/max(distanceToCamera, 0.1));
      }
      vec3 color = pow(max(inputColor.rgb, vec3(0.0)), vec3(1.0/2.2));
      float luma = dot(color, vec3(0.2126,0.7152,0.0722));
      // Quantize luminance rather than RGB channels to keep authored pigment hues.
      float steps = max(colorLevels-1.0, 1.0);
      float flatLuma = floor(luma*steps+0.5)/steps;
      color *= mix(1.0, flatLuma/max(luma,0.025), 0.48);
      color = mix(color, vec3(0.96,0.94,0.87), 0.055);
      vec2 paper = uv*resolution/pixelRatio;
      float diagonal = stripe((paper.x+paper.y)*0.7071);
      float cross = stripe((paper.x-paper.y)*0.7071);
      float horizontal = stripe(paper.y);
      float hatch = diagonal*(1.0-smoothstep(0.43,0.66,luma));
      hatch = max(hatch, cross*(1.0-smoothstep(0.24,0.43,luma)));
      hatch = max(hatch, horizontal*(1.0-smoothstep(0.10,0.24,luma)));
      vec3 ink = vec3(0.17,0.19,0.22);
      color = mix(color, color*0.35+ink*0.25, hatch*hatchStrength*nearDetail*subject);
      // Static small variation in weight, with no animated UV wobble.
      float weight = 0.90+0.08*sin(paper.y*0.13+sin(paper.x*0.07));
      float edge = max(smoothstep(0.19,0.42,normalEdge), smoothstep(0.012,0.04,depthEdge));
      float bright = 1.0-smoothstep(0.88,1.0,luma);
      color = mix(color, ink, edge*weight*nearDetail*bright*subject);
      outputColor = vec4(pow(clamp(color,0.0,1.0), vec3(2.2)), inputColor.a);
    }
  `, {
    blendFunction: BlendFunction.NORMAL,
    attributes: EffectAttribute.DEPTH | EffectAttribute.CONVOLUTION,
    uniforms: new Map<string, Uniform>([
      ["normalTexture", new Uniform(normalTexture)],
      ["subjectDepth", new Uniform(subjectDepth)],
      ["pixelRatio", new Uniform(pixelRatio)],
      ["lineWidth", new Uniform(0.85)],
      ["colorLevels", new Uniform(8)],
      ["hatchStrength", new Uniform(0.5)],
    ]),
  });
}
