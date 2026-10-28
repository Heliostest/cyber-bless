// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { captureSceneImage, captureSceneFrame, registerSceneCapture } from "./scene-capture";

afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });

describe("scene image capture ownership", () => {
  it("captures only the renderer inside the requested scene, with synchronous render before encode", () => {
    const root = document.createElement("section"), other = document.createElement("section");
    const canvas = document.createElement("canvas"), otherCanvas = document.createElement("canvas");
    root.append(canvas); other.append(otherCanvas); document.body.append(root, other);
    const scene = new THREE.Scene(), order: string[] = [];
    vi.spyOn(canvas, "toDataURL").mockImplementation(type => { order.push(`encode:${type}`); return "data:image/png;base64,c2NlbmU="; });
    const release = registerSceneCapture(canvas, () => captureSceneFrame(canvas, scene, () => order.push("render")));
    const releaseOther = registerSceneCapture(otherCanvas, () => "data:image/png;base64,b3RoZXI=");
    expect(captureSceneImage(root)).toBe("data:image/png;base64,c2NlbmU=");
    expect(order).toEqual(["render", "encode:image/png"]);
    expect(captureSceneImage(other)).toBe("data:image/png;base64,b3RoZXI=");
    release(); releaseOther();
    expect(captureSceneImage(root)).toBeUndefined();
  });

  it("never encodes a zero-size, unavailable or failed renderer, and old disposal cannot remove its replacement", () => {
    const root = document.createElement("section"), canvas = document.createElement("canvas");
    root.append(canvas);
    expect(captureSceneImage(root)).toBeUndefined();
    const oldRelease = registerSceneCapture(canvas, () => undefined);
    expect(captureSceneImage(root)).toBeUndefined();
    const release = registerSceneCapture(canvas, () => "data:image/png;base64,c2NlbmU=");
    oldRelease();
    expect(captureSceneImage(canvas)).toBe("data:image/png;base64,c2NlbmU=");
    canvas.width = 0;
    expect(captureSceneImage(root)).toBeUndefined();
    canvas.width = 10; release();
    const releaseFailed = registerSceneCapture(canvas, () => { throw Error("GPU lost"); });
    expect(captureSceneImage(root)).toBeUndefined();
    releaseFailed();
  });

  it.each(["data:,", "data:image/webp;base64,bm90LXBuZw==", "data:image/png;base64,"])("rejects incomplete or non-PNG captures: %s", encoded => {
    const canvas = document.createElement("canvas");
    const release = registerSceneCapture(canvas, () => encoded);
    expect(captureSceneImage(canvas)).toBeUndefined();
    release();
  });
});

describe("private text in a rendered scene", () => {
  it("removes private meshes only from the exported frame and immediately restores the visible scene", () => {
    const canvas = document.createElement("canvas"), scene = new THREE.Scene();
    const privateText = new THREE.Mesh(), hiddenText = new THREE.Mesh(), artifact = new THREE.Mesh();
    privateText.userData.privateShare = true; hiddenText.userData.privateShare = true; hiddenText.visible = false;
    scene.add(privateText, hiddenText, artifact);
    const frames: boolean[][] = [];
    vi.spyOn(canvas, "toDataURL").mockImplementation(() => privateText.visible ? "data:image/png;base64,cHJpdmF0ZQ==" : "data:image/png;base64,cHVibGlj");
    const image = captureSceneFrame(canvas, scene, () => frames.push([privateText.visible, hiddenText.visible, artifact.visible]));
    expect(image).toBe("data:image/png;base64,cHVibGlj");
    expect(frames).toEqual([[false, false, true], [true, false, true]]);
    expect(privateText.visible).toBe(true); expect(hiddenText.visible).toBe(false);
  });

  it.each(["render", "encode"])("restores private mesh visibility even if %s fails", failure => {
    const canvas = document.createElement("canvas"), scene = new THREE.Scene(), text = new THREE.Mesh();
    text.userData.privateShare = true; scene.add(text);
    const frames: boolean[] = [];
    vi.spyOn(canvas, "toDataURL").mockImplementation(() => { throw Error("tainted"); });
    expect(captureSceneFrame(canvas, scene, () => {
      frames.push(text.visible);
      if (failure === "render" && !text.visible) throw Error("GPU lost");
    })).toBeUndefined();
    expect(text.visible).toBe(true);
    expect(frames).toEqual([false, true]);
  });
});
