import { BlendFunction, Effect, EffectAttribute } from "postprocessing";
import { Color, Texture, Uniform } from "three";
import type { RenderStyleParameters } from "./render-style-parameters";

export type GalleryPostStyle = "sketch-contour" | "gallery-outline" | "space-grade" | "depth-rim";
export function isGalleryPostStyle(value: string): value is GalleryPostStyle {
  return value === "sketch-contour" || value === "gallery-outline" || value === "space-grade" || value === "depth-rim";
}

// Independent general-purpose image algorithms. Input is ACES-mapped linear RGB;
// EffectPass performs the single final display conversion. No Gallery GLSL is bundled.
const subjectHelpers = /* glsl */ `
  uniform sampler2D normalTexture;
  uniform sampler2D subjectDepth;
  uniform float pixelRatio;
  uniform float lineWidth;
  uniform float strength;
  uniform vec3 inkColor;

  vec2 bounded(vec2 uv) { return clamp(uv, vec2(0.0), vec2(1.0)); }
  float subjectAt(vec2 uv) {
    vec4 n = texture2D(normalTexture, uv);
    float actual = -getViewZ(readDepth(uv));
    float selected = -getViewZ(texture2D(subjectDepth, uv).r);
    return n.a * float(abs(actual-selected) < max(0.004, actual*0.002));
  }
  // Normals come from eligible opaque subjects only. Scene depth prevents ink
  // from a selected surface showing through an unselected table or wall.
  float edgeAt(vec2 uv, float width) {
    vec4 center = texture2D(normalTexture, uv);
    float distance = -getViewZ(texture2D(subjectDepth, uv).r);
    float boundary = 0.0;
    float crease = 0.0;
    for (int i=0; i<4; i++) {
      vec2 axis = i == 0 ? vec2(1.0,0.0) : i == 1 ? vec2(-1.0,0.0) : i == 2 ? vec2(0.0,1.0) : vec2(0.0,-1.0);
      vec2 p = bounded(uv+axis*texelSize*pixelRatio*width);
      vec4 neighbor = texture2D(normalTexture, p);
      float neighborDistance = -getViewZ(texture2D(subjectDepth, p).r);
      boundary = max(boundary, max(abs(center.a-neighbor.a), smoothstep(0.009,0.035,abs(distance-neighborDistance)/max(distance,0.1))));
      crease = max(crease, smoothstep(0.23,0.55,length(center.rgb-neighbor.rgb))*neighbor.a);
    }
    return max(boundary, crease)*subjectAt(uv);
  }
`;

const sketch = subjectHelpers + /* glsl */ `
  uniform vec3 paperColor;
  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    float subject = subjectAt(uv);
    vec3 normal = normalize(texture2D(normalTexture,uv).rgb*2.0-1.0+vec3(0.00001));
    float shade = max(0.0,dot(normal,normalize(vec3(-0.45,0.65,1.0))));
    vec2 paper = uv*resolution/pixelRatio;
    float tooth = sin(paper.x*1.7+sin(paper.y*0.27))*sin(paper.y*1.3)*0.009;
    vec3 fill = paperColor*(0.64+0.36*shade+tooth);
    fill = mix(fill, inputColor.rgb, 0.18);
    float stroke = edgeAt(uv,lineWidth)*(0.88+0.12*sin(paper.y*0.31+sin(paper.x*0.19)));
    vec3 drawn = mix(fill,inkColor,stroke);
    outputColor = vec4(mix(inputColor.rgb,drawn,subject*strength),inputColor.a);
  }
`;
const outline = subjectHelpers + /* glsl */ `
  uniform float colorLevels;
  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    float subject = subjectAt(uv);
    vec3 display = pow(max(inputColor.rgb,vec3(0.0)),vec3(1.0/2.2));
    float luminance = dot(display,vec3(0.2126,0.7152,0.0722));
    float steps = max(colorLevels-1.0,1.0);
    float band = floor(luminance*steps+0.5)/steps;
    vec3 bandColor = display*mix(1.0,band/max(luminance,0.03),0.55);
    vec3 color = mix(inputColor.rgb,pow(clamp(bandColor,0.0,1.0),vec3(2.2)),subject);
    color = mix(color,inkColor,edgeAt(uv,lineWidth)*0.86);
    outputColor = vec4(color,inputColor.a);
  }
`;
const rim = subjectHelpers + /* glsl */ `
  uniform float direction;
  uniform vec3 rimColor;
  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    float subject = subjectAt(uv);
    float angle = direction*0.01745329252;
    vec2 offset = vec2(cos(angle),sin(angle))*texelSize*pixelRatio*lineWidth;
    vec2 p = bounded(uv+offset);
    vec4 neighbor = texture2D(normalTexture,p);
    float centerDistance = -getViewZ(texture2D(subjectDepth,uv).r);
    float neighborDistance = -getViewZ(texture2D(subjectDepth,p).r);
    float gap = smoothstep(0.006,0.03,(neighborDistance-centerDistance)/max(centerDistance,0.1));
    float light = max(1.0-neighbor.a,gap)*subject;
    vec3 color = mix(inputColor.rgb,inkColor,edgeAt(uv,0.8)*0.42*strength);
    color = mix(color,rimColor+inputColor.rgb*0.2,light*strength*0.72);
    outputColor = vec4(color,inputColor.a);
  }
`;
const grade = /* glsl */ `
  uniform float pixelRatio;
  uniform float glow;
  uniform float vignette;
  uniform float grain;
  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    // Symmetric low-cost diffusion, with no luminance threshold or extra HDR
    // composer. Alpha-weighted taps avoid fringes on transparent host canvases.
    vec3 sum = inputColor.rgb*inputColor.a*4.0;
    float weight = inputColor.a*4.0;
    vec2 stepSize = texelSize*pixelRatio*3.0;
    for (int i=0; i<8; i++) {
      float angle = float(i)*0.78539816339;
      vec2 p = clamp(uv+vec2(cos(angle),sin(angle))*stepSize,vec2(0.0),vec2(1.0));
      vec4 tap = texture2D(inputBuffer,p);
      sum += tap.rgb*tap.a;
      weight += tap.a;
    }
    vec3 blur = sum/max(weight,0.0001);
    vec3 color = mix(inputColor.rgb,blur,glow*0.32);
    color += blur*(vec3(1.0)-clamp(color,0.0,1.0))*glow*0.22;
    vec2 centered = uv*2.0-1.0;
    color *= 1.0-vignette*smoothstep(0.2,1.4,dot(centered,centered));
    // Frozen grain does not flicker, advance preview time or bypass reduced motion.
    vec2 paper = floor(uv*resolution/pixelRatio);
    float noise = fract(sin(dot(paper,vec2(12.9898,78.233)))*43758.5453)-0.5;
    color += noise*grain;
    outputColor = vec4(max(color,vec3(0.0)),inputColor.a);
  }
`;

export function createGalleryEffect(style: GalleryPostStyle, normal: Texture | null, depth: Texture | null, pixelRatio: number) {
  const effect = new Effect({ "sketch-contour": "GallerySketch", "gallery-outline": "GalleryOutline", "space-grade": "GallerySpaceGrade", "depth-rim": "GalleryDepthRim" }[style],
    { "sketch-contour": sketch, "gallery-outline": outline, "space-grade": grade, "depth-rim": rim }[style], {
      blendFunction: BlendFunction.NORMAL,
      attributes: EffectAttribute.CONVOLUTION | (style === "space-grade" ? EffectAttribute.NONE : EffectAttribute.DEPTH),
      uniforms: new Map<string, Uniform>([
        ["normalTexture", new Uniform(normal)], ["subjectDepth", new Uniform(depth)],
        ["pixelRatio", new Uniform(pixelRatio)], ["lineWidth", new Uniform(1)], ["strength", new Uniform(1)],
        ["colorLevels", new Uniform(4)], ["direction", new Uniform(40)],
        ["inkColor", new Uniform(new Color("#303840"))], ["paperColor", new Uniform(new Color("#f4eddb"))],
        ["rimColor", new Uniform(new Color("#ffb4ce"))],
        ["glow", new Uniform(.3)], ["vignette", new Uniform(.18)], ["grain", new Uniform(.02)],
      ]),
    });
  return {
    effect,
    update(parameters: RenderStyleParameters, ratio: number) {
      const set = (name: string, value: number) => { effect.uniforms.get(name)!.value = value; };
      set("pixelRatio",ratio);
      if (style === "sketch-contour") { set("lineWidth",parameters.sketchWidth); set("strength",parameters.sketchStrength); }
      if (style === "gallery-outline") { set("lineWidth",parameters.galleryOutlineWidth); set("colorLevels",parameters.galleryOutlineLevels); }
      if (style === "depth-rim") { set("lineWidth",parameters.rimWidth); set("strength",parameters.rimStrength); set("direction",parameters.rimDirection); }
      if (style === "space-grade") { set("glow",parameters.glowStrength); set("vignette",parameters.vignetteStrength); set("grain",parameters.grainStrength); }
    },
  };
}
