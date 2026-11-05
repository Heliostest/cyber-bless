import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync, inflateRawSync } from "node:zlib";
import sharp from "sharp";

// Offline, source-derived repack. No procedural replacement or geometry simplification.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const directory = path.join(root, "assets/environments/trees/quaternius");
const source = path.join(directory, "source");
const args = process.argv.slice(2);
const check = args.includes("--check");
const manifest = JSON.parse(await readFile(path.join(directory, "source-manifest.json"), "utf8"));
const hash = value => createHash("sha256").update(value).digest("hex");
const archiveDirectory = await readFile(path.join(directory, manifest.archive.centralDirectory.path));
assert.equal(hash(archiveDirectory), manifest.archive.centralDirectory.sha256, "Archive directory hash mismatch");
const archiveNames = [];
for (let offset = 0; offset < archiveDirectory.length;) {
  assert.equal(archiveDirectory.readUInt32LE(offset), 0x02014b50, "Expected ZIP directory record");
  const nameBytes = archiveDirectory.readUInt16LE(offset + 28);
  const extraBytes = archiveDirectory.readUInt16LE(offset + 30);
  const commentBytes = archiveDirectory.readUInt16LE(offset + 32);
  archiveNames.push(archiveDirectory.subarray(offset + 46, offset + 46 + nameBytes).toString("utf8"));
  offset += 46 + nameBytes + extraBytes + commentBytes;
}
assert.equal(archiveNames.length, manifest.archive.centralDirectory.records);
const treeModels = archiveNames.filter(name => /^glTF\/.*(?:tree|pine).*\.gltf$/i.test(name));
assert.deepEqual(treeModels, manifest.treeAvailability.treeModels, "Standard tree inventory differs");
for (const [species, terms] of Object.entries(manifest.treeAvailability.unavailableSpecies)) {
  assert(!archiveNames.some(name => terms.some(term => name.toLowerCase().includes(term))),
    `${species} availability changed; review authentic source before exporting`);
}
for (const model of manifest.models) assert(treeModels.includes(`glTF/${model.source}.gltf`));

if (args.includes("--download")) {
  // Re-fetch only selected ZIP records. The pinned central-directory CRC and SHA-256
  // prevent a changed upstream archive being silently accepted as the same source.
  for (const record of manifest.files) {
    const response = await fetch(manifest.archive.url, {
      headers: { Range: `bytes=${record.offset}-${record.offset + record.recordBytes - 1}` },
      signal: AbortSignal.timeout(600000),
    });
    assert.equal(response.status, 206, `Server must honor Range for ${record.path}`);
    assert.equal(response.headers.get("content-range"),
      `bytes ${record.offset}-${record.offset + record.recordBytes - 1}/${manifest.archive.bytes}`);
    const compressed = Buffer.from(await response.arrayBuffer());
    assert.equal(compressed.length, record.recordBytes);
    assert.equal(compressed.readUInt32LE(0), 0x04034b50);
    const nameLength = compressed.readUInt16LE(26), extraLength = compressed.readUInt16LE(28);
    assert.equal(compressed.subarray(30, 30 + nameLength).toString("utf8"), record.archivePath);
    const payload = compressed.subarray(30 + nameLength + extraLength);
    const bytes = record.method === 8 ? inflateRawSync(payload) : payload;
    assert.equal(bytes.length, record.bytes);
    assert.equal(hash(bytes), record.sha256, `Changed source: ${record.path}`);
    const destination = path.join(source, record.path);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, bytes);
  }
}

for (const file of manifest.files) {
  assert.equal(hash(await readFile(path.join(source, file.path))), file.sha256, `Source hash mismatch: ${file.path}`);
}
const license = await readFile(path.join(source, "License_Standard.txt"));
assert.match(license.toString("utf8"), /CC0 1\.0 Universal/);
assert.match(license.toString("utf8"), /standard FREE version/);

const textureInfo = [];
const textures = await Promise.all([
  { file: "Bark_NormalTree_Normal.png", normal: true },
  { file: "Bark_NormalTree.png", normal: false },
  { file: "Leaves_NormalTree_C.png", leaves: true },
].map(async definition => {
  const filename = path.join(source, "glTF", definition.file);
  const original = await sharp(filename).metadata();
  // 512px is sufficient at the meadow camera distance. PNG keeps alpha and normal
  // channels lossless after resizing. Only opaque bark color uses JPEG.
  let pipeline = sharp(filename).resize(512, 512, { fit: "inside", kernel: "lanczos3" });
  if (!definition.leaves) pipeline = pipeline.removeAlpha();
  const bytes = definition.file === "Bark_NormalTree.png"
    ? await pipeline.jpeg({ quality: 85, chromaSubsampling: "4:4:4" }).toBuffer()
    : await pipeline.png({ compressionLevel: 9, adaptiveFiltering: false }).toBuffer();
  const metadata = await sharp(bytes).metadata();
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minAlpha = 255, maxAlpha = 0, transparentPixels = 0, opaquePixels = 0;
  for (let i = 3; i < data.length; i += info.channels) {
    minAlpha = Math.min(minAlpha, data[i]); maxAlpha = Math.max(maxAlpha, data[i]);
    transparentPixels += data[i] === 0; opaquePixels += data[i] === 255;
  }
  if (definition.leaves) assert(minAlpha === 0 && maxAlpha === 255, "Leaf alpha was lost");
  textureInfo.push({ source: definition.file, sourceSize: [original.width, original.height],
    size: [metadata.width, metadata.height], bytes: bytes.length, sha256: hash(bytes),
    alpha: { min: minAlpha, max: maxAlpha, transparentPixels, opaquePixels } });
  return { ...definition, bytes, mimeType: metadata.format === "jpeg" ? "image/jpeg" : "image/png" };
}));

function packGLB(json, binary) {
  let jsonBytes = Buffer.from(JSON.stringify(json));
  jsonBytes = Buffer.concat([jsonBytes, Buffer.alloc((4 - jsonBytes.length % 4) % 4, 0x20)]);
  const bin = Buffer.concat([binary, Buffer.alloc((4 - binary.length % 4) % 4)]);
  const header = Buffer.alloc(20), chunk = Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + jsonBytes.length + bin.length, 8);
  header.writeUInt32LE(jsonBytes.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  chunk.writeUInt32LE(bin.length, 0); chunk.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonBytes, chunk, bin]);
}

const reports = [];
for (const model of manifest.models) {
  const gltf = JSON.parse(await readFile(path.join(source, "glTF", `${model.source}.gltf`), "utf8"));
  assert.equal(gltf.buffers.length, 1);
  const originalBuffer = await readFile(path.join(source, "glTF", gltf.buffers[0].uri));
  const originalViews = structuredClone(gltf.bufferViews);
  const chunks = [];
  let offset = 0;
  const append = (bytes, target) => {
    const padding = (4 - offset % 4) % 4;
    if (padding) { chunks.push(Buffer.alloc(padding)); offset += padding; }
    const index = gltf.bufferViews.length;
    gltf.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, ...(target ? { target } : {}) });
    chunks.push(bytes); offset += bytes.length;
    return index;
  };
  gltf.bufferViews = [];
  for (const accessor of gltf.accessors) {
    assert(!accessor.sparse && !accessor.byteOffset, "Unexpected source accessor layout");
    const view = originalViews[accessor.bufferView];
    const original = originalBuffer.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
    // Quantize the authored scalar AO colors only (error <= 0.5/255). Position,
    // normals, UVs and indices remain byte-identical to the original source.
    const color = gltf.meshes.some(mesh => mesh.primitives.some(p => p.attributes.COLOR_0 === gltf.accessors.indexOf(accessor)));
    if (color) {
      assert.equal(accessor.componentType, 5126); assert.equal(accessor.type, "VEC4");
      const bytes = Buffer.alloc(accessor.count * 4);
      for (let i = 0; i < bytes.length; i++) bytes[i] = Math.round(Math.max(0, Math.min(1, original.readFloatLE(i * 4))) * 255);
      accessor.bufferView = append(bytes, view.target);
      accessor.componentType = 5121; accessor.normalized = true;
    } else accessor.bufferView = append(original, view.target);
  }
  for (const image of gltf.images) {
    const prepared = textures.find(texture => texture.file === image.uri);
    assert(prepared, `Unexpected texture ${image.uri}`);
    image.bufferView = append(prepared.bytes);
    image.mimeType = prepared.mimeType;
    delete image.uri;
  }
  // The creator's bark alpha channel is uniformly 255. Correcting its export
  // flag avoids treating bark as foliage and needs no visual approximation.
  for (const material of gltf.materials) {
    if (material.name.startsWith("Bark_")) {
      delete material.alphaCutoff; material.alphaMode = "OPAQUE";
    } else {
      assert.equal(material.alphaMode, "MASK");
      assert.equal(material.doubleSided, true);
    }
  }
  gltf.nodes[0].name = `Quaternius_${model.source}`;
  gltf.meshes[0].name = model.source;
  gltf.asset.generator = "cyber-bless prepare-quaternius-trees.mjs (source-derived repack)";
  gltf.asset.copyright = "Quaternius — CC0 1.0 Universal";
  gltf.asset.extras = { source: manifest.creatorUrl, sourceModel: model.source, edition: "Standard FREE" };
  gltf.buffers = [{ byteLength: offset }];
  const binary = Buffer.concat(chunks);
  assert.equal(binary.length, offset);
  const output = packGLB(gltf, binary);
  assert(output.length < 1024 * 1024, `${model.key} exceeds 1 MiB`);
  const outputPath = path.join(directory, `${model.key}.glb`);
  if (check) assert.equal(hash(await readFile(outputPath)), hash(output), `Rebuild differs: ${model.key}`);
  else await writeFile(outputPath, output);

  const parts = gltf.meshes.flatMap(mesh => mesh.primitives.map(primitive => {
    const position = gltf.accessors[primitive.attributes.POSITION];
    const normals = gltf.accessors[primitive.attributes.NORMAL];
    assert.equal(normals.count, position.count);
    assert.equal(normals.componentType, 5126);
    return { material: gltf.materials[primitive.material].name, vertices: position.count,
      triangles: gltf.accessors[primitive.indices].count / 3, bounds: { min: position.min, max: position.max },
      normals: "original FLOAT32", uv: "original FLOAT32", colors: "original AO quantized UNORM8" };
  }));
  const bounds = { min: [0, 1, 2].map(i => Math.min(...parts.map(part => part.bounds.min[i]))),
    max: [0, 1, 2].map(i => Math.max(...parts.map(part => part.bounds.max[i]))) };
  reports.push({ key: model.key, source: `${model.source}.gltf`, file: `${model.key}.glb`,
    bytes: output.length, gzipBytes: gzipSync(output).length, sha256: hash(output), bounds,
    vertices: parts.reduce((sum, part) => sum + part.vertices, 0),
    triangles: parts.reduce((sum, part) => sum + part.triangles, 0), parts,
    materials: gltf.materials.map(material => ({ name: material.name,
      alphaMode: material.alphaMode, alphaCutoff: material.alphaCutoff, doubleSided: material.doubleSided })),
    selfContained: gltf.images.every(image => image.bufferView !== undefined && !image.uri) && !gltf.buffers[0].uri,
  });
}
if (check) assert.equal(hash(await readFile(path.join(directory, "LICENSE.txt"))), hash(license), "License copy differs");
else await writeFile(path.join(directory, "LICENSE.txt"), license);
const report = { source: "Quaternius Stylized Nature MegaKit Standard", sourceIntegrity: "SHA-256 verified",
  treeAvailability: manifest.treeAvailability,
  geometry: "Original positions/normals/UVs/indices, no simplification", textures: textureInfo.sort((a, b) => a.source.localeCompare(b.source)),
  models: reports };
const reportFlag = args.indexOf("--report");
if (!check || reportFlag >= 0) {
  const reportPath = reportFlag >= 0 ? path.resolve(args[reportFlag + 1]) : path.join(directory, "validation.json");
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify({ checked: check, availableSourceTrees: treeModels.length,
  unavailableSpecies: Object.keys(manifest.treeAvailability.unavailableSpecies),
  models: reports.map(({ key, bytes, triangles, vertices, sha256 }) => ({ key, bytes, triangles, vertices, sha256 })) }, null, 2));
