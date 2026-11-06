import { BlendFunction, Effect } from 'postprocessing';
import { Uniform, Vector4 } from 'three';
import curves from './komorebi/color-curves.json';

/** Source exposure, display conversion and curves. Komorebi daylight has no ACES pass. */
export function createKomorebiGrade(night = false) {
  return new Effect('KomorebiGrade', /* glsl */ `
    uniform vec4 kmPositive;
    uniform vec4 kmNeutral;
    uniform vec4 kmNegative;
    uniform float kmStrength;
    void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
      vec3 exposed = clamp(pow(max(inputColor.rgb*.97, vec3(0.0)), vec3(1.0 / 2.2)),0.0,1.0);
      vec3 rgb;
      rgb = mix(exposed, exposed * exposed * (3.0 - 2.0 * exposed), .17);
      float luma = dot(rgb, vec3(.2126, .7152, .0722));
      vec2 weights = clamp(vec2(luma * 3.0 - 1.5, 1.5 - luma * 3.0), 0.0, 1.0);
      vec4 curve = kmNeutral + weights.x * kmPositive - weights.y * kmNegative;
      rgb = mix(vec3(luma), rgb * curve.rgb, curve.a);
      // The source writes display RGB; the host composer subsequently encodes
      // linear sRGB. Use its exact inverse, rather than a second gamma approximation.
      vec3 hostLinear=sRGBToLinear(vec4(max(rgb,vec3(0.0)),1.0)).rgb;
      outputColor = vec4(mix(inputColor.rgb, hostLinear, kmStrength), inputColor.a);
    }
  `, {
    blendFunction: BlendFunction.NORMAL,
    uniforms: new Map<string, Uniform>([
      ['kmPositive', new Uniform(new Vector4(...curves.vCameraColorCurvePositive as [number,number,number,number]))],
      ['kmNeutral', new Uniform(new Vector4(...curves.vCameraColorCurveNeutral as [number,number,number,number]))],
      ['kmNegative', new Uniform(new Vector4(...curves.vCameraColorCurveNegative as [number,number,number,number]))],
      ['kmStrength', new Uniform(night ? .45 : 1)],
    ]),
  });
}
