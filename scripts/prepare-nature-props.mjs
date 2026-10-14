import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

const source = path.resolve("assets/environments/source/kenney");
const manifest = JSON.parse(await readFile(path.join(source, "source-manifest.json"), "utf8"));
const result = {};
const models = {};
const round = value => Math.round(value * 100000) / 100000;
const sizes = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const types = { 5120: [1, "readInt8"], 5121: [1, "readUInt8"], 5122: [2, "readInt16LE"],
  5123: [2, "readUInt16LE"], 5125: [4, "readUInt32LE"], 5126: [4, "readFloatLE"] };
for (const { key: name, file, sha256, normals } of manifest.models) {
  const bytes = await readFile(path.join(source, file));
  const actualHash = createHash("sha256").update(bytes).digest("hex");
  if (actualHash !== sha256) throw Error(`Source hash mismatch: ${file}`);
  if (bytes.toString("ascii", 0, 4) !== "glTF" || bytes.readUInt32LE(4) !== 2
    || bytes.readUInt32LE(8) !== bytes.length) throw Error(`Invalid GLB: ${file}`);
  const jsonLength = bytes.readUInt32LE(12);
  if (bytes.readUInt32LE(16) !== 0x4e4f534a || bytes.readUInt32LE(24 + jsonLength) !== 0x004e4942)
    throw Error(`Expected GLB JSON and binary chunks: ${file}`);
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  const binary = bytes.subarray(28 + jsonLength);
  const accessor = index => {
    const value = gltf.accessors[index], view = gltf.bufferViews[value.bufferView];
    if (value.sparse || !types[value.componentType] || !sizes[value.type])
      throw Error(`Unsupported accessor in ${file}`);
    const [componentBytes, method] = types[value.componentType];
    const components = sizes[value.type];
    const stride = view.byteStride || componentBytes * components;
    const start = (view.byteOffset || 0) + (value.byteOffset || 0);
    return Array.from({ length: value.count * components }, (_, i) =>
      binary[method](start + Math.floor(i / components) * stride + i % components * componentBytes));
  };
  const parts = [];
  const visit = (index, parent) => {
    const node = gltf.nodes[index];
    const local = node.matrix ? new THREE.Matrix4().fromArray(node.matrix) : new THREE.Matrix4().compose(
      new THREE.Vector3().fromArray(node.translation || [0, 0, 0]),
      new THREE.Quaternion().fromArray(node.rotation || [0, 0, 0, 1]),
      new THREE.Vector3().fromArray(node.scale || [1, 1, 1]));
    const matrix = parent.clone().multiply(local);
    if (node.mesh !== undefined) for (const primitive of gltf.meshes[node.mesh].primitives) {
      if (primitive.mode !== undefined && primitive.mode !== 4) throw Error(`Non-triangle primitive: ${file}`);
      const original = new THREE.BufferGeometry();
      original.setAttribute("position", new THREE.Float32BufferAttribute(accessor(primitive.attributes.POSITION), 3));
      if (normals === "source" && primitive.attributes.NORMAL !== undefined)
        original.setAttribute("normal", new THREE.Float32BufferAttribute(accessor(primitive.attributes.NORMAL), 3));
      if (primitive.indices !== undefined) original.setIndex(accessor(primitive.indices));
      original.applyMatrix4(matrix);
      // Retain the original five props' smooth lighting. New props keep source-normal
      // discontinuities, so welding does not soften stone edges or branching trunks.
      const geometry = mergeVertices(original, 0.00001);
      if (!geometry.attributes.normal || normals === "smooth") geometry.computeVertexNormals();
      parts.push({
        positions: Array.from(geometry.attributes.position.array, round),
        normals: Array.from(geometry.attributes.normal.array, round),
        indices: Array.from(geometry.index.array),
        color: (gltf.materials[primitive.material]?.pbrMetallicRoughness?.baseColorFactor || [1, 1, 1, 1]).slice(0, 3),
      });
      original.dispose(); geometry.dispose();
    }
    node.children?.forEach(child => visit(child, matrix));
  };
  gltf.scenes[gltf.scene || 0].nodes.forEach(index => visit(index, new THREE.Matrix4()));
  const minY = Math.min(...parts.flatMap(part => part.positions.filter((_, i) => i % 3 === 1)));
  for (const part of parts) part.positions = part.positions.map((value, i) => i % 3 === 1 ? round(value - minY) : value);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  let vertices = 0, triangles = 0, maxNormalLengthError = 0;
  if (!parts.length) throw Error(`Empty model: ${file}`);
  for (const part of parts) {
    if (!part.positions.length || part.positions.length % 3 || part.normals.length !== part.positions.length
      || part.indices.length % 3 || ![...part.positions, ...part.normals, ...part.color].every(Number.isFinite))
      throw Error(`Invalid attribute data: ${file}`);
    const count = part.positions.length / 3;
    if (!part.indices.every(index => Number.isInteger(index) && index >= 0 && index < count))
      throw Error(`Invalid triangle index: ${file}`);
    for (let i = 0; i < part.positions.length; i++) {
      min[i % 3] = Math.min(min[i % 3], part.positions[i]);
      max[i % 3] = Math.max(max[i % 3], part.positions[i]);
    }
    for (let i = 0; i < part.normals.length; i += 3) {
      const error = Math.abs(1 - Math.hypot(...part.normals.slice(i, i + 3)));
      maxNormalLengthError = Math.max(maxNormalLengthError, error);
      if (error > 0.00003) throw Error(`Non-unit normal: ${file} vertex ${i / 3}`);
    }
    vertices += count;
    triangles += part.indices.length / 3;
  }
  result[name] = { parts };
  models[name] = { file, sourceBytes: bytes.length, sha256, normals, parts: parts.length, vertices, triangles,
    bounds: { min, max }, dimensions: max.map((value, i) => round(value - min[i])), maxNormalLengthError };
}
const output = JSON.stringify(result) + "\n";
const report = { source: manifest.source, license: manifest.license, modelCount: Object.keys(result).length,
  bytes: Buffer.byteLength(output), gzipBytes: gzipSync(output, { level: 9 }).length,
  triangles: Object.values(models).reduce((sum, model) => sum + model.triangles, 0),
  validation: { finiteAttributes: true, validIndices: true, unitNormals: true }, models };
if (report.bytes > 400000 || report.gzipBytes > 100000) throw Error("Nature prop size budget exceeded");
await writeFile("packages/scene-runtime/src/nature-kit.data.json", output);
const reportFlag = process.argv.indexOf("--report");
if (reportFlag !== -1) {
  const reportPath = process.argv[reportFlag + 1];
  if (!reportPath) throw Error("Expected a path after --report");
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
}
console.log(`Prepared ${report.modelCount} Kenney props; ${report.bytes} bytes (${report.gzipBytes} gzip), ${report.triangles} triangles. Geometry validation passed.`);
