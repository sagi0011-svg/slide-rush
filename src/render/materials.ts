/**
 * Flat toon shading and the dark outlines (docs/ART-AND-SHOP.md §1).
 *
 * Two rules give the whole game its look:
 *
 * - **Three brightness steps, never a gradient.** A toon material lights a
 *   surface by looking its brightness up in a tiny ramp texture, so a curved
 *   shape comes out as a few flat bands of colour instead of a smooth blend.
 * - **A dark rim around every solid.** The same shape is drawn a second time,
 *   inside out and slightly larger, in the outline colour: its back faces show
 *   only where they stick out past the front ones, which is exactly a rim.
 *   This is cheaper on a phone than a full-screen edge pass, because it needs
 *   no second render target and no reading back of depth or normals.
 */

import {
  BackSide,
  DataTexture,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  NearestFilter,
  type Object3D,
  RedFormat,
  type BufferGeometry,
  type Texture,
} from 'three';
import { PALETTE, RETRO } from '../config';
import { fattenGeometry } from './geometry';

/**
 * The brightness ramp, built once and shared by every toon material: three
 * steps from shadow to lit, read with nearest filtering so the steps stay
 * hard edges.
 */
let gradient: DataTexture | null = null;

export function toonGradient(): DataTexture {
  if (gradient !== null) return gradient;
  const steps = RETRO.toonSteps;
  const data = new Uint8Array(steps);
  for (let i = 0; i < steps; i += 1) {
    // Spread the steps over the top two thirds of the range: a pure black
    // shadow step would swallow the palette colour it is shading.
    data[i] = Math.round(255 * (0.42 + (0.58 * i) / (steps - 1)));
  }
  const texture = new DataTexture(data, steps, 1, RedFormat);
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  gradient = texture;
  return texture;
}

/** A flat-shaded toon material in a palette colour, optionally textured. */
export function toonMaterial(options: {
  color?: number;
  map?: Texture;
  vertexColors?: boolean;
}): MeshToonMaterial {
  return new MeshToonMaterial({
    color: options.color ?? 0xffffff,
    map: options.map ?? null,
    gradientMap: toonGradient(),
    vertexColors: options.vertexColors ?? false,
  });
}

/** The material the outline hulls are drawn with: flat, unlit, outline colour. */
export function outlineMaterial(): MeshBasicMaterial {
  return new MeshBasicMaterial({ color: PALETTE.outline, side: BackSide });
}

/**
 * How thick an outline should be for a shape of roughly this size, in units.
 * Tied to the shape's size so a tree and a coin do not get the same heavy rim.
 */
export function outlineThickness(size: number): number {
  return size * RETRO.outlineGrow;
}

/**
 * Gives a mesh a dark rim by hanging an inside-out copy of it off the mesh
 * itself, so the rim follows it everywhere without any per-frame work.
 *
 * The copy is a *fattened* geometry rather than a scaled-up mesh: scaling a
 * tall thin shape pushes its ends much further out than its sides, which
 * leaves the rim thick in one direction and thin in the other.
 *
 * @param mesh the mesh to outline; the rim becomes its child
 * @param size roughly how big the mesh is, in units, for the rim's thickness
 */
export function addOutline(mesh: Mesh, size: number): Mesh {
  const geometry: BufferGeometry = fattenGeometry(mesh.geometry, outlineThickness(size));
  const outline = new Mesh(geometry, outlineMaterial());
  outline.name = 'outline';
  mesh.add(outline);
  return outline;
}

/**
 * Frees a mesh, its materials, any texture of its own and any outline hung off
 * it.
 *
 * Only textures belonging to this mesh are freed — the ones built per mesh,
 * like a pickup's icon. Shared textures, such as the slide surface, are freed
 * by whoever built them.
 */
export function disposeMesh(object: Object3D): void {
  for (const child of object.children) disposeMesh(child);

  // Described here rather than taken from Three's own Mesh type, whose
  // geometry and material are generic and come out as `any` — which would
  // quietly turn off type checking for the rest of this function.
  interface Freeable {
    dispose(): void;
  }
  interface MaybeMesh {
    geometry?: Freeable;
    material?: MeshMaterial | MeshMaterial[];
  }
  type MeshMaterial = Freeable & { map?: Texture | null };

  const mesh = object as Object3D & MaybeMesh;
  mesh.geometry?.dispose();
  if (mesh.material === undefined) return;

  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const material of materials) {
    material.map?.dispose();
    material.dispose();
  }
}
