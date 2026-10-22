import { BlendFunction, Effect, EffectAttribute } from "postprocessing";
import { Uniform } from "three";

/** Original CMYK dot-screen interpretation of Maxime Heckel's Shades of Halftone.
 * Applied to tone-mapped linear RGB; leaves the canvas coverage unchanged.
 */
export function createHalftoneEffect(pixelRatio: number) {
  return new Effect("HalftonePrint", /* glsl */ `
    uniform float pixelRatio;
    uniform float pitch;
    uniform float strength;

    vec4 inkAmounts(vec3 linearColor) {
      vec3 rgb = pow(clamp(linearColor,0.0,1.0),vec3(1.0/2.2));
      float black = min(1.0-rgb.r,min(1.0-rgb.g,1.0-rgb.b))*0.8;
      vec3 cmy = clamp((1.0-rgb-black)/max(1.0-black,0.001),0.0,1.0);
      return vec4(cmy,black);
    }

    float screenDot(vec2 paper, float angle, vec4 channel, vec3 fallback) {
      float c = cos(angle), s = sin(angle);
      mat2 rotate = mat2(c,s,-s,c);
      vec2 grid = rotate*paper/pitch;
      vec2 center = (floor(grid)+0.5)*pitch;
      vec2 source = mat2(c,-s,s,c)*center*pixelRatio/resolution;
      vec4 sampleColor = texture2D(inputBuffer,clamp(source,vec2(0.0),vec2(1.0)));
      vec3 color = sampleColor.a > 0.01 ? sampleColor.rgb : fallback;
      float amount = dot(inkAmounts(color),channel);
      float radius = sqrt(amount)*0.70;
      float distance = length(fract(grid)-0.5);
      float aa = max(fwidth(distance),0.025);
      return (1.0-smoothstep(radius-aa,radius+aa,distance))*smoothstep(0.0,0.015,amount);
    }

    void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
      if (inputColor.a < 0.001) { outputColor = inputColor; return; }
      vec2 paper = uv*resolution/pixelRatio;
      float cyan = screenDot(paper,0.261799,vec4(1.0,0.0,0.0,0.0),inputColor.rgb);
      float magenta = screenDot(paper,1.308997,vec4(0.0,1.0,0.0,0.0),inputColor.rgb);
      float yellow = screenDot(paper,0.0,vec4(0.0,0.0,1.0,0.0),inputColor.rgb);
      float black = screenDot(paper,0.785398,vec4(0.0,0.0,0.0,1.0),inputColor.rgb);
      vec3 printColor = vec3(0.99,0.975,0.94);
      printColor *= vec3(1.0-cyan*0.92,1.0,1.0);
      printColor *= vec3(1.0,1.0-magenta*0.92,1.0);
      printColor *= vec3(1.0,1.0,1.0-yellow*0.92);
      printColor *= 1.0-black*0.90;
      vec3 sourceColor = pow(clamp(inputColor.rgb,0.0,1.0),vec3(1.0/2.2));
      vec3 color = mix(sourceColor,printColor,strength);
      outputColor = vec4(pow(clamp(color,0.0,1.0),vec3(2.2)),inputColor.a);
    }
  `, {
    blendFunction: BlendFunction.NORMAL,
    attributes: EffectAttribute.CONVOLUTION,
    uniforms: new Map([
      ["pixelRatio", new Uniform(pixelRatio)],
      ["pitch", new Uniform(4.0)],
      ["strength", new Uniform(0.58)],
    ]),
  });
}
