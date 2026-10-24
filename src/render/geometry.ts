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
 * A copy of a geometry with every vertex pushed out along its normal, for the
 * outline hull.
 *
 * @param amount how far to push, in units
 */
export function fattenGeometry(geometry: BufferGeometry, amount: number): BufferGeometry {
  const source = geometry.index === null ? geometry : geometry.toNonIndexed();
  const fattened = source.clone();
  const position = fattened.getAttribute('position') as BufferAttribute;
  let normal = fattened.getAttribute('normal') as BufferAttribute | undefined;
  if (normal === undefined) {
    fattened.computeVertexNormals();
    normal = fattened.getAttribute('normal') as BufferAttribute;
  }

  for (let i = 0; i < position.count; i += 1) {
    position.setXYZ(
      i,
      position.getX(i) + normal.getX(i) * amount,
      position.getY(i) + normal.getY(i) * amount,
      position.getZ(i) + normal.getZ(i) * amount,
    );
  }
  position.needsUpdate = true;
  // The hull is drawn unlit, so it needs no normals of its own; the ones it
  // inherited are harmless and cost nothing to keep.
  if (source !== geometry) source.dispose();
  return fattened;
}
