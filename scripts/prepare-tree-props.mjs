import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import sharp from "sharp";
import * as THREE from "three";

// Offline conversion only. The original CC0 glTF, buffers, atlas and license stay intact.
const source = path.resolve("assets/environments/trees/source");
const manifest = JSON.parse(await readFile("assets/environments/trees/source-manifest.json", "utf8"));
for (const [file, expected] of Object.entries(manifest.hashes)) {
  const actual = createHash("sha256").update(await readFile(path.join(source, file))).digest("hex");
  if (actual !== expected) throw Error(`Tree source hash mismatch: ${file}`);
}
const { data: pixels, info } = await sharp(path.join(source, "forest_texture.png")).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const round = n => Math.round(n * 100000) / 100000;
const sample = (u, v) => {
  const x = Math.min(info.width - 1, Math.max(0, u * info.width - .5));
  const y = Math.min(info.height - 1, Math.max(0, v * info.height - .5));
  const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(x0 + 1, info.width - 1), y1 = Math.min(y0 + 1, info.height - 1);
  return [0, 1, 2].map(c => {
    const a = pixels[(y0 * info.width + x0) * 3 + c] * (1 - (x - x0)) + pixels[(y0 * info.width + x1) * 3 + c] * (x - x0);
    const b = pixels[(y1 * info.width + x0) * 3 + c] * (1 - (x - x0)) + pixels[(y1 * info.width + x1) * 3 + c] * (x - x0);
    return (a * (1 - (y - y0)) + b * (y - y0)) / 255;
  });
};
const output = {}, models = {};
for (const { key, file } of manifest.models) {
  const gltf = JSON.parse(await readFile(path.join(source, file), "utf8"));
  const buffers = await Promise.all(gltf.buffers.map(b => readFile(path.join(source, b.uri))));
  const accessor = index => {
    const a = gltf.accessors[index], view = gltf.bufferViews[a.bufferView];
    const count = { VEC2: 2, VEC3: 3, SCALAR: 1 }[a.type];
    const bytes = a.componentType === 5126 ? 4 : a.componentType === 5123 ? 2 : 0;
    if (!count || !bytes || a.sparse) throw Error(`Unsupported accessor: ${file}`);
    const binary = buffers[view.buffer], offset = (view.byteOffset || 0) + (a.byteOffset || 0);
    return Array.from({ length: a.count * count }, (_, i) => binary[bytes === 4 ? "readFloatLE" : "readUInt16LE"](offset + Math.floor(i / count) * (view.byteStride || bytes * count) + i % count * bytes));
  };
  const raw = [];
  function visit(index, parent) {
    const node = gltf.nodes[index];
    const local = node.matrix ? new THREE.Matrix4().fromArray(node.matrix) : new THREE.Matrix4().compose(
      new THREE.Vector3().fromArray(node.translation || [0, 0, 0]), new THREE.Quaternion().fromArray(node.rotation || [0, 0, 0, 1]), new THREE.Vector3().fromArray(node.scale || [1, 1, 1]));
    const matrix = parent.clone().multiply(local), normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
    if (node.mesh !== undefined) for (const primitive of gltf.meshes[node.mesh].primitives) {
      if (primitive.mode !== undefined && primitive.mode !== 4) throw Error(`Expected triangles: ${file}`);
      const positions = accessor(primitive.attributes.POSITION), normals = accessor(primitive.attributes.NORMAL), uv = accessor(primitive.attributes.TEXCOORD_0);
      for (let i = 0; i < positions.length; i += 3) {
        new THREE.Vector3().fromArray(positions, i).applyMatrix4(matrix).toArray(positions, i);
        new THREE.Vector3().fromArray(normals, i).applyMatrix3(normalMatrix).normalize().toArray(normals, i);
      }
      raw.push({ positions, normals, uv, indices: accessor(primitive.indices) });
    }
    node.children?.forEach(child => visit(child, matrix));
  }
  gltf.scenes[gltf.scene || 0].nodes.forEach(index => visit(index, new THREE.Matrix4()));
  const ys = raw.flatMap(part => part.positions.filter((_, i) => i % 3 === 1));
  const minY = Math.min(...ys), height = Math.max(...ys) - minY;
  if (height <= 0) throw Error(`Empty tree: ${file}`);
  const parts = [];
  for (const part of raw) {
    const vertexColors = Array.from({ length: part.positions.length / 3 }, (_, i) => sample(part.uv[i * 2], part.uv[i * 2 + 1]));
    const green = vertexColors.map(c => c[1] > c[0] * 1.12 && c[1] > c[2] * 1.1);
    for (const role of ["wood", "leaves"]) {
      const positions = [], normals = [], colors = [], indices = [], remap = new Map();
      for (let i = 0; i < part.indices.length; i += 3) {
        const triangle = part.indices.slice(i, i + 3);
        const leaves = triangle.filter(index => green[index]).length >= 2;
        if (leaves !== (role === "leaves")) continue;
        for (const old of triangle) {
          if (!remap.has(old)) {
            remap.set(old, positions.length / 3);
            positions.push(round(part.positions[old * 3] / height), round((part.positions[old * 3 + 1] - minY) / height), round(part.positions[old * 3 + 2] / height));
            normals.push(...part.normals.slice(old * 3, old * 3 + 3).map(round));
            // Preserve the source gradient while bringing both materials into the sunny meadow palette.
            const c = new THREE.Color().setRGB(...vertexColors[old], THREE.SRGBColorSpace);
            c.lerp(new THREE.Color(role === "leaves" ? 0x91b65d : 0xb68b60), role === "leaves" ? .36 : .30);
            colors.push(round(c.r), round(c.g), round(c.b));
          }
          indices.push(remap.get(old));
        }
      }
      if (indices.length) parts.push({ role, positions, normals, colors, indices });
    }
  }
  if (parts.length !== 2) throw Error(`Expected a trunk and canopy in ${file}`);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  let triangles = 0, vertices = 0;
  for (const part of parts) {
    const count = part.positions.length / 3;
    if (part.normals.length !== part.positions.length || part.colors.length !== part.positions.length || part.indices.length % 3 || ![...part.positions, ...part.normals, ...part.colors].every(Number.isFinite) || !part.indices.every(i => Number.isInteger(i) && i >= 0 && i < count)) throw Error(`Invalid geometry: ${file}`);
    for (let i = 0; i < part.positions.length; i++) { min[i % 3] = Math.min(min[i % 3], part.positions[i]); max[i % 3] = Math.max(max[i % 3], part.positions[i]); }
    for (let i = 0; i < part.normals.length; i += 3) if (Math.abs(Math.hypot(...part.normals.slice(i, i + 3)) - 1) > .00003) throw Error(`Non-unit normal: ${file}`);
    vertices += count; triangles += part.indices.length / 3;
  }
  output[key] = { parts };
  models[key] = { file, sourceHeight: height, vertices, triangles, bounds: { min, max }, dimensions: max.map((v, i) => round(v - min[i])) };
}
const text = JSON.stringify(output) + "\n";
const report = { source: manifest.creatorUrl, mirror: manifest.mirror, license: manifest.license, models, bytes: Buffer.byteLength(text), gzipBytes: gzipSync(text, { level: 9 }).length, validation: { sourceHashes: true, finiteAttributes: true, validIndices: true, unitNormals: true, heightOneGrounded: true } };
if (report.bytes > 200000 || report.gzipBytes > 45000) throw Error("Tree geometry budget exceeded");
await writeFile("packages/scene-runtime/src/stylized-trees.data.json", text);
const at = process.argv.indexOf("--report");
if (at !== -1) { const target = process.argv[at + 1]; if (!target) throw Error("Expected report path"); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, JSON.stringify(report, null, 2) + "\n"); }
console.log(`Prepared ${Object.keys(output).length} KayKit trees: ${report.bytes} bytes (${report.gzipBytes} gzip). Source hashes and geometry validation passed.`);
