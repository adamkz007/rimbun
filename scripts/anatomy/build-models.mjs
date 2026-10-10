// Builds the /diagnose anatomy models from the Open Anatomy Project atlases.
//
//   node scripts/anatomy/build-models.mjs           # build GLBs + index
//   node scripts/anatomy/build-models.mjs --report  # print raw atlas bounds (mm, RAS)
//
// For every atlas in manifest.json this downloads atlasStructure.json and the
// per-structure VTK meshes, merges the curated structures into named nodes,
// simplifies them with meshoptimizer, places each atlas into a shared standing
// body frame (metres, +Y up, +Z anterior, +X = patient's left) and writes one
// meshopt-compressed GLB per atlas to public/anatomy/.

import fs from "node:fs/promises";
import path from "node:path";
import { Document, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { meshopt } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import { parseVtk } from "./vtk.mjs";

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const CACHE_DIR = path.join(SCRIPT_DIR, ".cache");
const OUTPUT_DIR = path.join(REPO_ROOT, "public/anatomy");
const INDEX_PATH = path.join(REPO_ROOT, "src/lib/diagnose/anatomy-index.ts");

const manifest = JSON.parse(await fs.readFile(path.join(SCRIPT_DIR, "manifest.json"), "utf8"));
const reportOnly = process.argv.includes("--report");

async function fetchCached(url) {
  const cachePath = path.join(CACHE_DIR, url.replace(/^https?:\/\//, "").replace(/[^a-zA-Z0-9._-]/g, "_"));
  try {
    return await fs.readFile(cachePath);
  } catch {
    // not cached yet
  }
  let lastError;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      await fs.mkdir(CACHE_DIR, { recursive: true });
      await fs.writeFile(cachePath, buffer);
      return buffer;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 2000 * 2 ** attempt));
    }
  }
  throw new Error(`Failed to download ${url}: ${lastError?.message}`);
}

function parseRgb(value) {
  const match = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(value ?? "");
  return match ? match.slice(1, 4).map((n) => Number(n) / 255) : [0.8, 0.75, 0.7];
}

function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function resolveLeaves(byId, ids, exclude) {
  const leaves = [];
  const visit = (id) => {
    if (exclude.has(id)) return;
    const node = byId.get(id);
    if (!node) throw new Error(`Unknown atlas id ${id}`);
    if (node["@type"] === "Group") node.member.forEach(visit);
    else if (node["@type"] === "Structure") leaves.push(node);
  };
  ids.forEach(visit);
  return [...new Set(leaves)];
}

function geometrySource(byId, structure) {
  const selector = structure.sourceSelector?.find((s) => [].concat(s["@type"]).includes("GeometrySelector"));
  const dataSource = selector && byId.get(selector.dataSource);
  return dataSource?.source ?? null;
}

function mergeMeshes(meshes) {
  const vertexCount = meshes.reduce((sum, m) => sum + m.positions.length / 3, 0);
  const indexCount = meshes.reduce((sum, m) => sum + m.indices.length, 0);
  const positions = new Float32Array(vertexCount * 3);
  const indices = new Uint32Array(indexCount);
  let vOffset = 0;
  let iOffset = 0;
  for (const mesh of meshes) {
    positions.set(mesh.positions, vOffset * 3);
    for (let i = 0; i < mesh.indices.length; i++) indices[iOffset + i] = mesh.indices[i] + vOffset;
    vOffset += mesh.positions.length / 3;
    iOffset += mesh.indices.length;
  }
  return { positions, indices };
}

function simplifyMesh({ positions, indices }, maxTriangles) {
  const remap = MeshoptSimplifier.generatePositionRemap(positions, 3);
  let welded = indices.map((i) => remap[i]);
  const triangles = welded.length / 3;
  if (triangles > maxTriangles) {
    [welded] = MeshoptSimplifier.simplify(welded, positions, 3, maxTriangles * 3, 0.2, ["Prune"]);
    // Meshes made of many small disconnected parts stall the topology-preserving
    // simplifier; fall back to sloppy (vertex clustering) simplification.
    if (welded.length / 3 > maxTriangles * 1.5) {
      [welded] = MeshoptSimplifier.simplifySloppy(welded, positions, 3, null, maxTriangles * 3, 0.05);
    }
  }
  // Compact to the vertices still referenced.
  const map = new Map();
  const outPositions = [];
  const outIndices = new Uint32Array(welded.length);
  for (let i = 0; i < welded.length; i++) {
    const src = welded[i];
    let dst = map.get(src);
    if (dst === undefined) {
      dst = map.size;
      map.set(src, dst);
      outPositions.push(positions[src * 3], positions[src * 3 + 1], positions[src * 3 + 2]);
    }
    outIndices[i] = dst;
  }
  return { positions: Float32Array.from(outPositions), indices: outIndices };
}

function bounds(positions) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], positions[i + k]);
      max[k] = Math.max(max[k], positions[i + k]);
    }
  }
  return { min, max };
}

// RAS millimetres -> body frame metres (+X patient-left, +Y superior, +Z anterior).
// The axis swap mirrors handedness, so triangle winding is flipped too.
function toBodyFrame({ positions, indices }, placement) {
  const out = new Float32Array(positions.length);
  const scale = placement.scale ?? 1;
  for (let i = 0; i < positions.length; i += 3) {
    out[i] = (-positions[i] / 1000) * scale + placement.offset[0];
    out[i + 1] = (positions[i + 2] / 1000) * scale + placement.offset[1];
    out[i + 2] = (positions[i + 1] / 1000) * scale + placement.offset[2];
  }
  const flipped = new Uint32Array(indices.length);
  for (let i = 0; i < indices.length; i += 3) {
    flipped[i] = indices[i];
    flipped[i + 1] = indices[i + 2];
    flipped[i + 2] = indices[i + 1];
  }
  return { positions: out, indices: flipped };
}

function vertexNormals({ positions, indices }) {
  const normals = new Float32Array(positions.length);
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = [indices[i] * 3, indices[i + 1] * 3, indices[i + 2] * 3];
    const ab = [positions[b] - positions[a], positions[b + 1] - positions[a + 1], positions[b + 2] - positions[a + 2]];
    const ac = [positions[c] - positions[a], positions[c + 1] - positions[a + 1], positions[c + 2] - positions[a + 2]];
    const n = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    for (const v of [a, b, c]) {
      normals[v] += n[0];
      normals[v + 1] += n[1];
      normals[v + 2] += n[2];
    }
  }
  for (let i = 0; i < normals.length; i += 3) {
    const len = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
    normals[i] /= len;
    normals[i + 1] /= len;
    normals[i + 2] /= len;
  }
  return normals;
}

function anchorPoint(box, align) {
  return [0, 1, 2].map((k) => {
    const mode = align[k];
    if (mode === "min") return box.min[k];
    if (mode === "max") return box.max[k];
    return (box.min[k] + box.max[k]) / 2;
  });
}

// Resolve the placement so the anchor structure's aligned point lands on target.
function resolvePlacement(atlas, rasMeshes) {
  const { anchor, align = ["center", "center", "center"], target, scale = 1 } = atlas.placement;
  const anchorMesh = rasMeshes.get(anchor);
  if (!anchorMesh) throw new Error(`Placement anchor ${anchor} missing in ${atlas.id}`);
  const body = toBodyFrame(anchorMesh, { offset: [0, 0, 0], scale });
  const point = anchorPoint(bounds(body.positions), align);
  return { scale, offset: target.map((t, k) => t - point[k]) };
}

async function loadAtlas(atlas) {
  const base = `${manifest.source}/${atlas.path}`;
  const structureJson = JSON.parse((await fetchCached(`${base}/atlasStructure.json`)).toString("utf8"));
  const byId = new Map(structureJson.map((node) => [node["@id"], node]));
  const meshes = new Map();

  for (const entry of atlas.structures) {
    const leaves = resolveLeaves(byId, entry.from, new Set(entry.exclude ?? []));
    const parts = [];
    for (const leaf of leaves) {
      const source = geometrySource(byId, leaf);
      if (!source) continue;
      const buffer = await fetchCached(`${base}/${encodeURI(source)}`);
      parts.push(parseVtk(buffer));
    }
    if (!parts.length) throw new Error(`No geometry for ${atlas.id}.${entry.key}`);
    const firstGroup = byId.get(entry.from[0]);
    const color = parseRgb(entry.color ?? leaves[0]?.renderOption?.color ?? firstGroup?.renderOption?.color);
    meshes.set(entry.key, { ...mergeMeshes(parts), color, leaves: leaves.length });
    process.stdout.write(`  ${atlas.id}.${entry.key}: ${leaves.length} structures\n`);
  }
  return meshes;
}

async function writeAtlas(atlas, rasMeshes) {
  const placement = resolvePlacement(atlas, rasMeshes);
  const document = new Document();
  const buffer = document.createBuffer();
  const scene = document.createScene(atlas.id);
  const index = {};
  const maxDefault = manifest.defaultMaxTriangles;

  for (const entry of atlas.structures) {
    const ras = rasMeshes.get(entry.key);
    const simplified = simplifyMesh(ras, entry.maxTriangles ?? maxDefault);
    const mesh = toBodyFrame(simplified, placement);
    const normals = vertexNormals(mesh);
    const box = bounds(mesh.positions);

    const position = document.createAccessor().setType("VEC3").setArray(mesh.positions).setBuffer(buffer);
    const normal = document.createAccessor().setType("VEC3").setArray(normals).setBuffer(buffer);
    const indices = document.createAccessor().setType("SCALAR").setArray(mesh.indices).setBuffer(buffer);
    const material = document
      .createMaterial(entry.key)
      .setBaseColorFactor([...ras.color.map(srgbToLinear), 1])
      .setRoughnessFactor(0.55)
      .setMetallicFactor(0);
    const primitive = document
      .createPrimitive()
      .setAttribute("POSITION", position)
      .setAttribute("NORMAL", normal)
      .setIndices(indices)
      .setMaterial(material);
    const gltfMesh = document.createMesh(entry.key).addPrimitive(primitive);
    scene.addChild(document.createNode(entry.key).setMesh(gltfMesh));

    index[entry.key] = {
      atlas: atlas.id,
      triangles: mesh.indices.length / 3,
      center: box.min.map((v, k) => Number(((v + box.max[k]) / 2).toFixed(4))),
      size: box.min.map((v, k) => Number((box.max[k] - v).toFixed(4))),
    };
  }

  await MeshoptEncoder.ready;
  await document.transform(meshopt({ encoder: MeshoptEncoder, level: "medium" }));
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    "meshopt.encoder": MeshoptEncoder,
  });
  const glb = await io.writeBinary(document);
  await fs.writeFile(path.join(OUTPUT_DIR, `${atlas.id}.glb`), glb);
  console.log(`Wrote public/anatomy/${atlas.id}.glb (${(glb.byteLength / 1024).toFixed(0)} KB)`);
  return index;
}

await MeshoptSimplifier.ready;
await fs.mkdir(OUTPUT_DIR, { recursive: true });

const structures = {};
const atlases = [];
for (const atlas of manifest.atlases) {
  console.log(`Atlas ${atlas.id} (${atlas.path})`);
  const rasMeshes = await loadAtlas(atlas);

  if (reportOnly) {
    for (const [key, mesh] of rasMeshes) {
      const box = bounds(mesh.positions);
      console.log(`    ${key.padEnd(22)} min ${box.min.map(Math.round)} max ${box.max.map(Math.round)}`);
    }
    continue;
  }

  Object.assign(structures, await writeAtlas(atlas, rasMeshes));
  atlases.push({
    id: atlas.id,
    title: atlas.title,
    url: `/anatomy/${atlas.id}.glb`,
    citation: atlas.citation,
    mirror: atlas.mirror ?? null,
  });
}

if (!reportOnly) {
  const output = {
    generatedBy: "scripts/anatomy/build-models.mjs",
    source: "The Open Anatomy Project (https://www.openanatomy.org)",
    license: manifest.license,
    atlases,
    structures,
  };
  const source = [
    "// Generated by scripts/anatomy/build-models.mjs. Do not edit by hand.",
    `export const ANATOMY_INDEX = ${JSON.stringify(output, null, 2)} as const;`,
    "",
  ].join("\n");
  await fs.writeFile(INDEX_PATH, source);
  console.log(`Wrote ${path.relative(REPO_ROOT, INDEX_PATH)}`);
}
