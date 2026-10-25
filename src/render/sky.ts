/**
 * The sunset backdrop: dithered sky, pixel sun and two layers of hills
 * (docs/ART-AND-SHOP.md §1).
 *
 * It is a flat 2D picture, drawn into the game picture before the 3D scene and
 * laid out in game pixels: one unit of it is exactly one pixel of the game
 * picture. That is what keeps the hills still. As surfaces in the 3D world they
 * were stretched by an uneven amount and resampled every time the camera
 * turned, so their outline crawled; here one hill pixel is one game pixel and
 * they only ever move by whole pixels (src/render/hill-layout.ts).
 *
 * They still behave like distant hills. Each frame, the point in the world
 * where a layer's middle used to hang is projected through the real camera,
 * so the hills follow the horizon as the slide tips and the view turns. And
 * each layer's ridge slides by a share of the camera's sideways move — more for
 * the near layer than the far one — which is the parallax. However far the
 * player travels, they never come closer.
 */

import {
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  Vector3,
  type CanvasTexture,
  type PerspectiveCamera,
} from 'three';
import { CAMERA, RETRO } from '../config';
import { hillSize, placeHills, type HillSize } from './hill-layout';
import type { TargetSize } from './retro';
import { createHillTexture, createSkyTexture } from './textures';

/** A 2D picture drawn into the game picture before the 3D scene. */
export interface Backdrop {
  scene: Scene;
  camera: OrthographicCamera;
}

export interface Sky {
  /** The sky and hills, for the pixel pass to draw first (pixel-pass.ts). */
  readonly backdrop: Backdrop;
  /** Fits the backdrop to a game picture of this size. Call on every resize. */
  resize(size: TargetSize): void;
  /** Places the hills for this frame. Call after the camera has moved. */
  update(camera: PerspectiveCamera): void;
  dispose(): void;
}

interface Layer {
  index: number;
  mesh: Mesh<PlaneGeometry, MeshBasicMaterial>;
  /** Painted for the current picture size; null until the first resize. */
  texture: CanvasTexture | null;
  size: HillSize;
}

/** Scratch, reused every frame (CLAUDE.md rule 7). */
const anchor = new Vector3();

export function createSky(): Sky {
  const scene = new Scene();
  // Game-pixel units, with pixel (0, 0) at the bottom left. The right and top
  // edges are set on resize, to the picture's width and height.
  const camera = new OrthographicCamera(0, 1, 1, 0, -1, 1);

  // A unit square with its corner on the origin, so each mesh is placed by its
  // bottom-left corner and sized by its scale: both whole numbers of pixels.
  const unit = new PlaneGeometry(1, 1).translate(0.5, 0.5, 0);

  // The sky stands still on screen, so stretching its small painting to fill
  // the picture is harmless: a picture that does not move cannot crawl.
  const skyTexture = createSkyTexture();
  const sky = new Mesh(
    unit,
    new MeshBasicMaterial({ map: skyTexture, depthTest: false, depthWrite: false }),
  );
  sky.renderOrder = 0;
  scene.add(sky);

  const layers: Layer[] = [];
  for (let index = 0; index < RETRO.hills.distance.length; index += 1) {
    const mesh = new Mesh(
      unit,
      new MeshBasicMaterial({
        // A pixel silhouette has no soft edge to keep, so the clear pixels
        // are cut away rather than blended.
        alphaTest: 0.5,
        transparent: false,
        depthTest: false,
        depthWrite: false,
      }),
    );
    // Far layer, then near layer, over the sky.
    mesh.renderOrder = 1 + index;
    scene.add(mesh);
    layers.push({ index, mesh, texture: null, size: hillSize(index, 1, 1) });
  }

  let cols = 0;
  let rows = 0;

  return {
    backdrop: { scene, camera },

    resize(size) {
      if (size.width === cols && size.height === rows) return;
      cols = size.width;
      rows = size.height;
      camera.right = cols;
      camera.top = rows;
      camera.updateProjectionMatrix();
      sky.scale.set(cols, rows, 1);

      // Repainted at the new size, so one texel stays one game pixel. A resize
      // is rare — turning the phone, say — and each layer is a few hundred
      // pixels to paint.
      for (const layer of layers) {
        layer.size = hillSize(layer.index, cols, rows);
        layer.texture?.dispose();
        const texture = createHillTexture(layer.index, layer.size.tileWidth, layer.size.height);
        // As many repeats as the strip is wide, so one texel covers one pixel.
        texture.repeat.set(layer.size.stripWidth / layer.size.tileWidth, 1);
        layer.texture = texture;
        layer.mesh.material.map = texture;
        layer.mesh.material.needsUpdate = true;
        layer.mesh.scale.set(layer.size.stripWidth, layer.size.height, 1);
      }
    },

    update(view) {
      view.updateMatrixWorld();
      // Game pixels per world unit at a distance of one unit, at the camera's
      // resting field of view: the parallax keeps a steady rate while the view
      // widens on a drop.
      const pxPerUnit = rows / (2 * Math.tan((CAMERA.fov * Math.PI) / 360));

      for (const layer of layers) {
        if (layer.texture === null) continue;
        const distance = RETRO.hills.distance[layer.index] as number;
        const lift = RETRO.hills.lift[layer.index] as number;
        const parallaxShare = RETRO.hills.parallax[layer.index] as number;

        // Where this layer's middle hangs in the world, straight ahead of the
        // camera and never any closer...
        anchor.set(view.position.x, view.position.y + lift, view.position.z - distance);
        // ...and where that lands in the game picture this frame.
        anchor.project(view);
        const centreX = ((anchor.x + 1) / 2) * cols;
        const centreY = ((anchor.y + 1) / 2) * rows;
        const parallax = (view.position.x * parallaxShare * pxPerUnit) / distance;

        const place = placeHills(layer.size, centreX, centreY, parallax);
        layer.mesh.position.set(place.left, place.bottom, 0);
        layer.texture.offset.x = place.offset / layer.size.tileWidth;
      }
    },

    dispose() {
      for (const layer of layers) {
        scene.remove(layer.mesh);
        layer.mesh.material.dispose();
        layer.texture?.dispose();
      }
      layers.length = 0;
      scene.remove(sky);
      sky.material.dispose();
      skyTexture.dispose();
      unit.dispose();
    },
  };
}
