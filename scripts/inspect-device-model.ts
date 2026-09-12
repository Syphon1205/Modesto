/**
 * inspect-device-model - read a handset GLB and print the contract entry it needs.
 *
 * `DEVICE_MODELS` in the web app maps each chassis kind to a model plus the node
 * names that matter: which mesh is the display, which are the buttons. Those
 * names are whatever the model's author typed, so they cannot be guessed from
 * the outside — this reads them out and prints an entry to paste.
 *
 * Parses the GLB container directly rather than through a glTF library: the
 * JSON chunk carries every node name, mesh name, and accessor min/max this
 * needs, so the buffers never have to be decoded and the scripts package does
 * not have to depend on a renderer.
 *
 * Usage: bun run scripts/inspect-device-model.ts <file.glb>
 *
 * @module inspect-device-model
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

const GLB_MAGIC = 0x46546c67; // "glTF"
const GLB_JSON_CHUNK = 0x4e4f534a; // "JSON"

interface GltfAccessor {
  readonly min?: readonly number[];
  readonly max?: readonly number[];
  readonly count?: number;
}

interface GltfPrimitive {
  readonly attributes?: Readonly<Record<string, number>>;
  readonly indices?: number;
  readonly material?: number;
}

interface GltfMesh {
  readonly name?: string;
  readonly primitives?: readonly GltfPrimitive[];
}

interface GltfNode {
  readonly name?: string;
  readonly mesh?: number;
  readonly children?: readonly number[];
}

interface GltfDocument {
  readonly nodes?: readonly GltfNode[];
  readonly meshes?: readonly GltfMesh[];
  readonly materials?: readonly { readonly name?: string }[];
  readonly accessors?: readonly GltfAccessor[];
  readonly images?: readonly { readonly mimeType?: string; readonly name?: string }[];
}

/** Pulls the JSON chunk out of a GLB, or parses a .gltf as-is. */
function readGltfJson(bytes: Buffer, file: string): GltfDocument {
  if (path.extname(file).toLowerCase() === ".gltf") {
    return JSON.parse(bytes.toString("utf8")) as GltfDocument;
  }
  if (bytes.byteLength < 20 || bytes.readUInt32LE(0) !== GLB_MAGIC) {
    throw new Error(`${file} is not a GLB (bad magic). Expected a .glb or .gltf file.`);
  }
  let offset = 12;
  while (offset + 8 <= bytes.byteLength) {
    const length = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (type === GLB_JSON_CHUNK) {
      return JSON.parse(bytes.subarray(start, start + length).toString("utf8")) as GltfDocument;
    }
    // Chunks are 4-byte aligned; a length that is not already a multiple is padded.
    offset = start + length + ((4 - (length % 4)) % 4);
  }
  throw new Error(`${file} has no JSON chunk.`);
}

type MeshSummary = {
  readonly node: string;
  readonly triangles: number;
  readonly size: readonly [number, number, number];
  readonly materials: readonly string[];
};

function summarizeMeshes(doc: GltfDocument): MeshSummary[] {
  const summaries: MeshSummary[] = [];
  for (const node of doc.nodes ?? []) {
    if (node.mesh === undefined) continue;
    const mesh = doc.meshes?.[node.mesh];
    if (!mesh) continue;

    let triangles = 0;
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    const materials: string[] = [];

    for (const primitive of mesh.primitives ?? []) {
      const position = primitive.attributes?.POSITION;
      const positionAccessor = position === undefined ? undefined : doc.accessors?.[position];
      const indexAccessor =
        primitive.indices === undefined ? undefined : doc.accessors?.[primitive.indices];
      triangles += Math.floor((indexAccessor?.count ?? positionAccessor?.count ?? 0) / 3);
      if (positionAccessor?.min && positionAccessor.max) {
        for (let axis = 0; axis < 3; axis += 1) {
          min[axis] = Math.min(min[axis] ?? Infinity, positionAccessor.min[axis] ?? Infinity);
          max[axis] = Math.max(max[axis] ?? -Infinity, positionAccessor.max[axis] ?? -Infinity);
        }
      }
      const material =
        primitive.material === undefined ? undefined : doc.materials?.[primitive.material];
      if (material?.name) materials.push(material.name);
    }

    const size: [number, number, number] = [0, 1, 2].map((axis) => {
      const low = min[axis] ?? 0;
      const high = max[axis] ?? 0;
      return Number.isFinite(low) && Number.isFinite(high) ? high - low : 0;
    }) as [number, number, number];

    summaries.push({
      node: node.name ?? `<unnamed node ${doc.nodes?.indexOf(node)}>`,
      triangles,
      size,
      materials: [...new Set(materials)],
    });
  }
  return summaries;
}

/**
 * The display is the flattest large mesh: a phone screen is wide, tall, and
 * essentially zero-depth, which no other part of a handset is. A name or
 * material hit outranks the shape heuristic when one exists.
 */
function guessScreenNode(meshes: readonly MeshSummary[]): string | null {
  const named = meshes.find(
    (mesh) =>
      /screen|display|lcd|oled|glass/iu.test(mesh.node) ||
      mesh.materials.some((material) => /screen|display|lcd|oled/iu.test(material)),
  );
  if (named) return named.node;

  let best: { node: string; score: number } | null = null;
  for (const mesh of meshes) {
    const [x, y, z] = mesh.size;
    const face = x * y;
    const depth = Math.max(z, 1e-6);
    if (face <= 0) continue;
    // Face area over depth: rewards big and flat, punishes anything with body.
    const score = face / depth;
    if (!best || score > best.score) best = { node: mesh.node, score };
  }
  return best?.node ?? null;
}

function guessButtonNodes(meshes: readonly MeshSummary[]): Record<string, string> {
  const patterns: readonly (readonly [string, RegExp])[] = [
    ["power", /power|lock|sleep|side.?button/iu],
    ["volumeUp", /vol(ume)?.?up/iu],
    ["volumeDown", /vol(ume)?.?down/iu],
    ["volumeRocker", /rocker|volume$/iu],
    ["action", /action|mute|ring.?switch/iu],
  ];
  const found: Record<string, string> = {};
  for (const [action, pattern] of patterns) {
    const match = meshes.find((mesh) => pattern.test(mesh.node));
    if (match) found[action] = match.node;
  }
  return found;
}

async function main(): Promise<void> {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: bun run scripts/inspect-device-model.ts <file.glb>");
    process.exitCode = 1;
    return;
  }

  const bytes = await readFile(file);
  const doc = readGltfJson(bytes, file);
  const meshes = summarizeMeshes(doc);
  const triangles = meshes.reduce((total, mesh) => total + mesh.triangles, 0);

  console.log(`\n${path.basename(file)} — ${(bytes.byteLength / 1_048_576).toFixed(2)} MB`);
  console.log(`${meshes.length} mesh nodes, ${triangles.toLocaleString()} triangles`);
  const images = doc.images ?? [];
  if (images.length > 0) console.log(`${images.length} embedded textures`);

  console.log("\nMesh nodes (name — triangles — size x/y/z — materials):");
  for (const mesh of meshes.toSorted((a, b) => b.triangles - a.triangles)) {
    const size = mesh.size.map((value) => value.toFixed(3)).join(" x ");
    const materials = mesh.materials.length > 0 ? ` — ${mesh.materials.join(", ")}` : "";
    console.log(`  ${mesh.node} — ${mesh.triangles.toLocaleString()} — ${size}${materials}`);
  }

  const screenNode = guessScreenNode(meshes);
  const buttonNodes = guessButtonNodes(meshes);

  console.log("\nSuggested entry for DEVICE_MODELS in deviceModelRegistry.ts:");
  console.log("(verify screenNode against the list above — the guess is shape-based)\n");
  console.log(`  iPhone: {
    file: ${JSON.stringify(path.basename(file))},
    credit: {
      title: "TODO",
      author: "TODO",
      license: "TODO — e.g. CC-BY-4.0",
      sourceUrl: "TODO",
    },
    screenNode: ${JSON.stringify(screenNode ?? "TODO")},${
      Object.keys(buttonNodes).length > 0
        ? `\n    buttonNodes: ${JSON.stringify(buttonNodes, null, 6).replace(/\n/gu, "\n    ")},`
        : ""
    }
  },`);

  if (triangles > 200_000) {
    console.log(
      `\nWarning: ${triangles.toLocaleString()} triangles is heavy for a panel that also decodes video. Consider decimating.`,
    );
  }
  if (bytes.byteLength > 12 * 1_048_576) {
    console.log("\nWarning: over 12 MB. Consider Draco compression and KTX2 textures.");
  }
}

await main();
