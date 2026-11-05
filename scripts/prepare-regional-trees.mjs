import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import sharp from "sharp";
import * as THREE from "three";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const folder = path.join(root, "assets/environments/trees/regional");
const source = path.join(folder, "source");
const manifest = JSON.parse(await readFile(path.join(folder, "source-manifest.json"), "utf8"));
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const check = process.argv.includes("--check");
if (process.argv.includes("--download")) {
  for (const file of manifest.files) {
    const response = await fetch(file.url, { signal: AbortSignal.timeout(180000) });
    assert(response.ok, `Source fetch failed: ${file.path}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(hash(bytes), file.sha256, `Changed source: ${file.path}`);
    const destination = path.join(source, file.path);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, bytes);
  }
}
for (const file of [...manifest.files, ...manifest.evidence]) {
  assert.equal(hash(await readFile(path.join(source, file.path))), file.sha256, `Source hash mismatch: ${file.path}`);
}
const gltf = JSON.parse(await readFile(path.join(source, "jogoss/scene.gltf"), "utf8"));
assert.equal(gltf.asset.extras.author, `${manifest.creator} (${manifest.creatorUrl})`);
assert.equal(gltf.asset.extras.source, manifest.originalUrl);
assert.match(gltf.asset.extras.license, /CC-BY-4\.0/);
const creatorMetadata = JSON.parse(await readFile(path.join(source, "jogoss-model-metadata.json"), "utf8"));
assert.equal(creatorMetadata.name, manifest.title);
assert.equal(creatorMetadata.user.displayName, manifest.creator);
assert.equal(creatorMetadata.license.url.replace("http:", "https:"), manifest.licenseUrl);
assert.equal(creatorMetadata.isDownloadable, true);

// Keep the entire source geometry binary unchanged, including authored normals,
// four original UV sets and all indices. Append resized textures after it.
assert.equal(gltf.buffers.length, 1);
const originalBuffer = await readFile(path.join(source, "jogoss", gltf.buffers[0].uri));
let offset = originalBuffer.length;
const chunks = [originalBuffer], images = [];
for (const image of gltf.images) {
  const filename = path.join(source, "jogoss", image.uri);
  const original = await sharp(filename).metadata();
  const flowers = image.uri.includes("Sakura_Mat");
  let pipeline = sharp(filename).resize(512, 512, { fit: "inside", kernel: "lanczos3" });
  const bytes = flowers
    ? await pipeline.png({ compressionLevel: 9, adaptiveFiltering: false }).toBuffer()
    : await pipeline.removeAlpha().jpeg({ quality: 85, chromaSubsampling: "4:4:4" }).toBuffer();
  const metadata = await sharp(bytes).metadata();
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minAlpha = 255, maxAlpha = 0, transparentPixels = 0, opaquePixels = 0;
  for (let i = 3; i < data.length; i += info.channels) {
    minAlpha = Math.min(minAlpha, data[i]); maxAlpha = Math.max(maxAlpha, data[i]);
    transparentPixels += data[i] === 0; opaquePixels += data[i] === 255;
  }
  if (flowers) assert(minAlpha === 0 && maxAlpha === 255 && transparentPixels > 0, "Blossom alpha lost");
  images.push({ source: image.uri, sourceSize: [original.width, original.height],
    size: [metadata.width, metadata.height], bytes: bytes.length, sha256: hash(bytes),
    alpha: { min: minAlpha, max: maxAlpha, transparentPixels, opaquePixels } });
  const padding = (4 - offset % 4) % 4;
  if (padding) { chunks.push(Buffer.alloc(padding)); offset += padding; }
  image.bufferView = gltf.bufferViews.length;
  gltf.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length });
  image.mimeType = flowers ? "image/png" : "image/jpeg";
  delete image.uri;
  chunks.push(bytes); offset += bytes.length;
}
const flowerMaterial = gltf.materials.find(material => material.name === "Sakura_Mat");
assert.equal(flowerMaterial.alphaMode, "BLEND");
// Alpha cards need deterministic depth and shadows in instanced phone rendering.
// This is an explicit host adaptation from the original BLEND material.
flowerMaterial.alphaMode = "MASK";
flowerMaterial.alphaCutoff = 0.3;
gltf.asset.copyright = "Jogoss — CC BY 4.0; resized/repacked for cyber-bless debug preview";
gltf.buffers = [{ byteLength: offset }];
const binary = Buffer.concat(chunks);
assert(binary.subarray(0, originalBuffer.length).equals(originalBuffer), "Source geometry changed");
let json = Buffer.from(JSON.stringify(gltf));
json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 0x20)]);
const bin = Buffer.concat([binary, Buffer.alloc((4 - binary.length % 4) % 4)]);
const header = Buffer.alloc(20), chunk = Buffer.alloc(8);
header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
header.writeUInt32LE(28 + json.length + bin.length, 8);
header.writeUInt32LE(json.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
chunk.writeUInt32LE(bin.length, 0); chunk.writeUInt32LE(0x004e4942, 4);
const output = Buffer.concat([header, json, chunk, bin]);
assert(output.length < 1024 * 1024, "Cherry GLB exceeds 1 MiB");
const originalNotice = await readFile(path.join(source, "jogoss/license.txt"), "utf8");
const license = `${originalNotice.trim()}\n\nAdaptation and retrieval:\nTextures resized with Lanczos3: blossom 1024x1024 to 512x512 PNG; bark 1024x2048 to 256x512 JPEG quality 85 (4:4:4). Blossom alpha BLEND changed to double-sided MASK with cutoff 0.3 for depth, instancing and shadows. Original meshes, normals, UVs, indices and node transforms retained. Repacked as self-contained cherry.glb. No claim of botanical cultivar accuracy.\n\nSource retrieved 2026-11-05 from public mirror ${manifest.mirror.repository}, commit ${manifest.mirror.commit}, path ${manifest.mirror.path}. Original attribution and CC-BY-4.0 were cross-checked against the creator's public Sketchfab API metadata. See source-manifest.json for exact original source filenames and hashes.\n`;
const modelBounds = new THREE.Box3(), parts = [];
function visit(index, parent) {
  const node = gltf.nodes[index];
  const local = node.matrix ? new THREE.Matrix4().fromArray(node.matrix) : new THREE.Matrix4().compose(
    new THREE.Vector3().fromArray(node.translation || [0, 0, 0]),
    new THREE.Quaternion().fromArray(node.rotation || [0, 0, 0, 1]),
    new THREE.Vector3().fromArray(node.scale || [1, 1, 1]));
  const matrix = parent.clone().multiply(local);
  if (node.mesh !== undefined) for (const primitive of gltf.meshes[node.mesh].primitives) {
    const position = gltf.accessors[primitive.attributes.POSITION];
    assert.equal(gltf.accessors[primitive.attributes.NORMAL].count, position.count);
    const box = new THREE.Box3(new THREE.Vector3().fromArray(position.min), new THREE.Vector3().fromArray(position.max)).applyMatrix4(matrix);
    modelBounds.union(box);
    parts.push({ name: node.name, material: gltf.materials[primitive.material].name,
      vertices: position.count, triangles: gltf.accessors[primitive.indices].count / 3 });
  }
  node.children?.forEach(child => visit(child, matrix));
}
gltf.scenes[gltf.scene || 0].nodes.forEach(index => visit(index, new THREE.Matrix4()));
const triangles = parts.reduce((count, part) => count + part.triangles, 0);
assert.equal(triangles, creatorMetadata.faceCount, "Triangle count differs from creator metadata");
const report = { title: manifest.title, creator: manifest.creator, license: manifest.license,
  file: manifest.output, bytes: output.length, gzipBytes: gzipSync(output).length, sha256: hash(output),
  triangles, vertices: parts.reduce((count, part) => count + part.vertices, 0), parts, images,
  geometry: "Complete original binary unchanged; normals, UVs, positions and indices retained",
  bounds: { min: modelBounds.min.toArray(), max: modelBounds.max.toArray() },
  materials: gltf.materials.map(material => ({ name: material.name, alphaMode: material.alphaMode || "OPAQUE",
    alphaCutoff: material.alphaCutoff, doubleSided: material.doubleSided })),
  selfContained: gltf.images.every(image => image.bufferView !== undefined && !image.uri) && !gltf.buffers[0].uri };
if (check) {
  assert.equal(hash(await readFile(path.join(folder, manifest.output))), hash(output), "Cherry rebuild differs");
  assert.equal(await readFile(path.join(folder, "LICENSE.txt"), "utf8"), license, "Attribution notice differs");
} else {
  await writeFile(path.join(folder, manifest.output), output);
  await writeFile(path.join(folder, "LICENSE.txt"), license);
  await writeFile(path.join(folder, "validation.json"), `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify({ checked: check, ...report }, null, 2));
