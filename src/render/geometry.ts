/**
 * Two geometry tricks the retro look needs (docs/ART-AND-SHOP.md §1).
 *
 * - **Merging.** A scenery prop is several shapes — a trunk and a crown, a
 *   tower and its slide — but drawing it as several meshes would cost several
 *   draw calls, times every prop beside the track. Merging each prop into one
 *   geometry, with its part colours baked into the vertices, means a whole
 *   kind of prop can be drawn by a single instanced mesh (CLAUDE.md rule 7).
 * - **Fattening.** Pushing every vertex out along its own normal gives the
 *   slightly larger copy that the outline hull in materials.ts is drawn from.
 *   Scaling the mesh instead would make the rim uneven on anything that is
 *   not a ball.
 *
 * Both run once, at startup, never in the hot loop.
 */

import { BufferAttribute, BufferGeometry, Color, type Matrix4 } from 'three';

/** One part of a prop: a shape, where it sits, and what colour it is. */
export interface GeometryPart {
  geometry: BufferGeometry;
  /** Where the part sits within the prop. */
  matrix?: Matrix4;
  /** The part's colour, baked into its vertices. */
  color: number;
}

/**
 * Merges parts into one geometry whose vertices carry their own colours.
 *
 * The result is un-indexed — every triangle gets its own three vertices —
 * which is what flat shading and hard-edged colour changes want anyway, and
 * it keeps the merge to a straight copy of arrays.
 *
 * The parts' own geometries are disposed: they only existed to be merged.
 */
export function mergeColoredParts(parts: readonly GeometryPart[]): BufferGeometry {
  let vertexCount = 0;
  const prepared: { position: BufferAttribute; normal: BufferAttribute; color: Color }[] = [];

  for (const part of parts) {
    const geometry = part.geometry.index === null ? part.geometry : part.geometry.toNonIndexed();
    if (part.matrix !== undefined) geometry.applyMatrix4(part.matrix);
    if (geometry.getAttribute('normal') === undefined) geometry.computeVertexNormals();

    const position = geometry.getAttribute('position') as BufferAttribute;
    const normal = geometry.getAttribute('normal') as BufferAttribute;
    prepared.push({ position, normal, color: new Color(part.color) });
    vertexCount += position.count;
    if (geometry !== part.geometry) part.geometry.dispose();
  }

  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);

  let at = 0;
  for (const part of prepared) {
    for (let i = 0; i < part.position.count; i += 1) {
      positions[at * 3] = part.position.getX(i);
      positions[at * 3 + 1] = part.position.getY(i);
      positions[at * 3 + 2] = part.position.getZ(i);
      normals[at * 3] = part.normal.getX(i);
      normals[at * 3 + 1] = part.normal.getY(i);
      normals[at * 3 + 2] = part.normal.getZ(i);
      colors[at * 3] = part.color.r;
      colors[at * 3 + 1] = part.color.g;
      colors[at * 3 + 2] = part.color.b;
      at += 1;
    }
  }

  const merged = new BufferGeometry();
  merged.setAttribute('position', new BufferAttribute(positions, 3));
  merged.setAttribute('normal', new BufferAttribute(normals, 3));
  merged.setAttribute('color', new BufferAttribute(colors, 3));
  return merged;
}

/**
 * A copy of a geometry whose normals are averaged across every vertex that
 * shares a position, for the outline hull.
 *
 * The merged props are flat-shaded, so each face carries its own normal and
 * the corners of a box have three different normals at the same point. Push
 * those out and the faces drift apart, leaving gaps in the rim at every edge.
 * Averaged, every copy of a corner moves the same way and the hull stays
 * closed. Runs once per shape, at startup.
 */
export function smoothNormals(geometry: BufferGeometry): BufferGeometry {
  const smooth = geometry.index === null ? geometry.clone() : geometry.toNonIndexed();
  if (smooth.getAttribute('normal') === undefined) smooth.computeVertexNormals();
  const position = smooth.getAttribute('position') as BufferAttribute;
  const normal = smooth.getAttribute('normal') as BufferAttribute;

  // Positions are matched to a thousandth of a unit: the same corner, built
  // by two faces, can differ in the last bits of a float.
  const key = (i: number): string =>
    `${Math.round(position.getX(i) * 1000)},${Math.round(position.getY(i) * 1000)},${Math.round(position.getZ(i) * 1000)}`;

  const sums = new Map<string, [number, number, number]>();
  for (let i = 0; i < position.count; i += 1) {
    const k = key(i);
    const sum = sums.get(k) ?? [0, 0, 0];
    sum[0] += normal.getX(i);
    sum[1] += normal.getY(i);
    sum[2] += normal.getZ(i);
    sums.set(k, sum);
  }

  for (let i = 0; i < position.count; i += 1) {
    const [x, y, z] = sums.get(key(i)) as [number, number, number];
    const length = Math.hypot(x, y, z);
    if (length > 1e-9) normal.setXYZ(i, x / length, y / length, z / length);
  }
  normal.needsUpdate = true;
  return smooth;
}
