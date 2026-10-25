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
  Vector2,
  type BufferGeometry,
  type Texture,
} from 'three';
import { PALETTE, RETRO } from '../config';
import { smoothNormals } from './geometry';

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

/**
 * Shared by every outline material, so one resize reaches them all: how many
 * game pixels wide the rim is, and how many game pixels the picture has.
 */
const outlineUniforms = {
  uOutlinePixels: { value: RETRO.outlinePixels },
  uResolution: { value: new Vector2(1, 1) },
};

/** Tells the outlines how big the game picture is. Call on every resize. */
export function setOutlineResolution(width: number, height: number): void {
  outlineUniforms.uResolution.value.set(width, height);
}

/**
 * The shader lines that push the hull out by a fixed number of *game pixels*
 * on screen, instead of a fixed distance in the world.
 *
 * A rim measured in the world gets thinner with distance; once it is thinner
 * than one game pixel it is drawn on some frames and not on others, and the
 * outline flickers. Measured on screen, it is the same width at every
 * distance, so there is nothing to flicker.
 */
const OUTLINE_PUSH = `#include <project_vertex>
{
  vec3 outlineNormal = normal;
  #ifdef USE_INSTANCING
    outlineNormal = mat3( instanceMatrix ) * outlineNormal;
  #endif
  vec3 viewNormal = normalize( mat3( modelViewMatrix ) * outlineNormal );
  vec2 clipNormal = ( projectionMatrix * vec4( viewNormal, 0.0 ) ).xy;
  float clipLength = length( clipNormal );
  if ( clipLength > 1e-6 ) {
    gl_Position.xy += ( clipNormal / clipLength ) * ( 2.0 * uOutlinePixels / uResolution ) * gl_Position.w;
  }
}`;

/**
 * The material the outline hulls are drawn with: flat, unlit, outline colour,
 * and a rim exactly `RETRO.outlinePixels` game pixels wide at any distance.
 */
export function outlineMaterial(): MeshBasicMaterial {
  const material = new MeshBasicMaterial({ color: PALETTE.outline, side: BackSide });
  material.onBeforeCompile = (shader) => {
    shader.uniforms['uOutlinePixels'] = outlineUniforms.uOutlinePixels;
    shader.uniforms['uResolution'] = outlineUniforms.uResolution;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform float uOutlinePixels;\nuniform vec2 uResolution;',
      )
      .replace('#include <project_vertex>', OUTLINE_PUSH);
  };
  // Every outline compiles to the same program; this lets Three share it.
  material.customProgramCacheKey = () => 'pixel-outline';
  return material;
}

/**
 * The shape an outline hull is drawn from: the mesh's own shape with its
 * normals smoothed, so pushing it out along them keeps it closed at every
 * corner instead of splitting into separate faces with gaps between them.
 */
export function outlineGeometry(geometry: BufferGeometry): BufferGeometry {
  return smoothNormals(geometry);
}

/**
 * Gives a mesh a dark rim by hanging an inside-out copy of it off the mesh
 * itself, so the rim follows it everywhere without any per-frame work.
 *
 * @param mesh the mesh to outline; the rim becomes its child
 */
export function addOutline(mesh: Mesh): Mesh {
  const outline = new Mesh(outlineGeometry(mesh.geometry), outlineMaterial());
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
