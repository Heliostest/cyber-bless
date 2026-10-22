import { OutlineEffect } from "postprocessing";
import { Uniform } from "three";

/** Keep pmndrs visibility/selection, with a variable mask-sampling radius.
 * At 1× the original edge texture is used, preserving the existing preset.
 */
export class AdjustableOutlineEffect extends OutlineEffect {
  constructor(...args: ConstructorParameters<typeof OutlineEffect>) {
    super(...args);
    this.uniforms.set("lineWidth", new Uniform(1));
    const fragment = this.getFragmentShader();
    const edgeSample = "vec2 edge=texture2D(edgeTexture,uv).rg;";
    if (!fragment.includes(edgeSample)) throw Error("Unsupported outline shader version");
    this.setFragmentShader(`uniform float lineWidth;\n` + fragment.replace(edgeSample, /* glsl */ `
      vec2 edge = texture2D(edgeTexture,uv).rg;
      if (abs(lineWidth-1.0) > 0.001) {
        vec2 px = texelSize*lineWidth;
        vec2 c0 = texture2D(maskTexture,clamp(uv+vec2(px.x,0.0),vec2(0.0),vec2(1.0))).rg;
        vec2 c1 = texture2D(maskTexture,clamp(uv-vec2(px.x,0.0),vec2(0.0),vec2(1.0))).rg;
        vec2 c2 = texture2D(maskTexture,clamp(uv+vec2(0.0,px.y),vec2(0.0),vec2(1.0))).rg;
        vec2 c3 = texture2D(maskTexture,clamp(uv-vec2(0.0,px.y),vec2(0.0),vec2(1.0))).rg;
        float d = length(vec2(c0.x-c1.x,c2.x-c3.x))*0.5;
        float visibility = min(min(c0.y,c1.y),min(c2.y,c3.y));
        edge = (1.0-visibility > 0.001) ? vec2(d,0.0) : vec2(0.0,d);
      }
    `));
  }
}
