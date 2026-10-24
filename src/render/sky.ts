/**
 * The sunset backdrop: dithered sky, pixel sun and two layers of hills
 * (docs/ART-AND-SHOP.md §1).
 *
 * The sky itself is one painted texture used as the scene's background, so it
 * costs a single full-screen draw of a 64x112 image.
 *
 * The hills are two quads that ride with the camera, which is what the spec
 * means by "never move closer": however far the player travels, the hills keep
 * exactly the same distance, like a painted backdrop on a stage. What does
 * change is how far each layer's painting is slid sideways — a share of the
 * camera's own sideways move, more for the near layer than the far one — and
 * that difference is the parallax.
 */

import {
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  type PerspectiveCamera,
  type Scene,
  type Texture,
} from 'three';
import { PALETTE, RETRO } from '../config';
import { createHillTexture, createSkyTexture } from './textures';

export interface Sky {
  /**
   * Puts the hills back in front of the camera and slides their paintings for
   * the parallax.
   */
  update(camera: PerspectiveCamera): void;
  dispose(): void;
}

interface Layer {
  mesh: Mesh<PlaneGeometry, MeshBasicMaterial>;
  texture: Texture;
  /** Share of the camera's sideways move this layer copies. */
  parallax: number;
  /** How far in front of the camera it hangs, in units. */
  distance: number;
  /** How far above the camera it is centred, in units. */
  lift: number;
  /** How many units of world one repeat of the painting covers. */
  span: number;
}

export function createSky(scene: Scene): Sky {
  const background = createSkyTexture();
  scene.background = background;

  const layers: Layer[] = [];
  for (let i = 0; i < RETRO.hills.distance.length; i += 1) {
    const texture = createHillTexture(i);
    const width = RETRO.hills.width[i] as number;
    const height = RETRO.hills.height[i] as number;
    const mesh = new Mesh(
      new PlaneGeometry(width, height),
      new MeshBasicMaterial({
        map: texture,
        // A pixel silhouette has no soft edge to keep, so the clear pixels are
        // cut away rather than blended — no sorting, no haloes.
        alphaTest: 0.5,
        transparent: false,
        depthWrite: false,
        // A backdrop is not in the weather: fogging it would grey it out to
        // nothing, because it sits far beyond where the fog closes in.
        fog: false,
      }),
    );
    // Behind everything in the world, in front of the sky.
    mesh.renderOrder = -1;
    scene.add(mesh);

    layers.push({
      mesh,
      texture,
      parallax: RETRO.hills.parallax[i] as number,
      distance: RETRO.hills.distance[i] as number,
      lift: RETRO.hills.lift[i] as number,
      span: width / (texture.repeat.x || 1),
    });
  }

  return {
    update(camera) {
      for (const layer of layers) {
        // Straight in front of the camera, never turned: a backdrop.
        layer.mesh.position.set(
          camera.position.x,
          camera.position.y + layer.lift,
          camera.position.z - layer.distance,
        );
        // The near layer slides further than the far one, which is the whole
        // trick: that difference is what the eye reads as depth.
        layer.texture.offset.x = (camera.position.x * layer.parallax) / layer.span;
      }
    },

    dispose() {
      for (const layer of layers) {
        scene.remove(layer.mesh);
        layer.mesh.geometry.dispose();
        layer.mesh.material.dispose();
        layer.texture.dispose();
      }
      layers.length = 0;
      scene.background = null;
      background.dispose();
    },
  };
}

/** The clear colour behind everything, for the renderer's own setup. */
export const SKY_CLEAR_COLOR = PALETTE.sky;
