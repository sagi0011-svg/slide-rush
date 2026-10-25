/**
 * The low-resolution pixel render (docs/ART-AND-SHOP.md §1).
 *
 * The whole 3D scene is drawn into a small off-screen target — at the default
 * pixel scale of 4, one sixteenth of the pixels the screen has — and that
 * target is then stretched over the canvas with nearest-neighbour filtering.
 * Nothing is blurred on the way up, so each pixel the game drew lands as a
 * crisp 4x4 block.
 *
 * This is why the retro pass is *faster* than the old smooth render rather
 * than slower: the expensive part of drawing this scene is filling pixels, and
 * there are now far fewer of them to fill. The HUD and the screens are
 * ordinary HTML on top, so the text stays sharp.
 */

import {
  Color,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  WebGLRenderTarget,
  type Camera,
  type WebGLRenderer,
} from 'three';
import type { PixelGrid, TargetSize } from './retro';
import type { Backdrop } from './sky';

export interface PixelPass {
  /**
   * Draws the scene into the small target, then blows it up onto the canvas.
   *
   * @param backdrop a flat 2D picture drawn into the target first, behind the
   *   scene (the sky and hills, sky.ts); null for none
   */
  render(scene: Scene, camera: Camera, backdrop: Backdrop | null): void;
  /**
   * Takes on a new layout: the target's size and where it lands on the
   * canvas (see `pixelGrid` in retro.ts).
   */
  resize(grid: PixelGrid): void;
  /** The size of the low-resolution target, in game pixels. */
  readonly size: TargetSize;
  /** How many screen pixels wide one game pixel currently is. */
  readonly pixelScale: number;
  /**
   * What drawing the scene cost, counted before the upscale.
   *
   * Three.js resets its own counters at the start of every `render`, so by the
   * time a frame is over they describe the last thing drawn — which here is
   * the single quad of the upscale. Reading them in between is the only way
   * the debug overlay gets the number it is actually asking for.
   */
  readonly sceneDrawCalls: number;
  readonly sceneTriangles: number;
  dispose(): void;
}

/**
 * @param renderer the renderer, set to a pixel ratio of 1: the grid works in
 *   real device pixels, and a ratio would multiply the viewport by it again
 * @param borderColor the colour of the few pixels round the edge that the
 *   picture does not cover; the frame colour, so they read as its edge
 */
export function createPixelPass(renderer: WebGLRenderer, borderColor: number): PixelPass {
  const target = new WebGLRenderTarget(1, 1, {
    // Nearest both ways: the whole look depends on nothing being smoothed.
    magFilter: NearestFilter,
    minFilter: NearestFilter,
    generateMipmaps: false,
    // The scene needs a depth buffer of its own to sort itself out in.
    depthBuffer: true,
    stencilBuffer: false,
  });

  // A flat quad filling the screen, showing the target. An orthographic camera
  // two units across means the quad's own coordinates are the screen's.
  const screenScene = new Scene();
  const screenCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new Mesh(
    new PlaneGeometry(2, 2),
    // Basic and unlit: this is a copy, not a thing in the world. No colour
    // space is set on the target's texture, so the renderer applies its output
    // transform exactly once, here, on the way to the canvas.
    new MeshBasicMaterial({ map: target.texture }),
  );
  quad.frustumCulled = false;
  screenScene.add(quad);

  let size: TargetSize = { width: 1, height: 1 };
  let pixelScale = 1;
  let viewport = { x: 0, y: 0, width: 1, height: 1 };
  const border = new Color(borderColor);
  // The scene's own clear colour, put back after the border is painted.
  // Scratch, so nothing is allocated per frame (CLAUDE.md rule 7).
  const sceneClear = new Color();
  let sceneDrawCalls = 0;
  let sceneTriangles = 0;

  return {
    render(scene, camera, backdrop) {
      renderer.setRenderTarget(target);
      renderer.clear();
      sceneDrawCalls = 0;
      sceneTriangles = 0;
      if (backdrop !== null) {
        renderer.render(backdrop.scene, backdrop.camera);
        sceneDrawCalls += renderer.info.render.calls;
        sceneTriangles += renderer.info.render.triangles;
        // The scene goes on top of the backdrop, so only depth is cleared
        // between them: clearing colour would wipe the sky and hills.
        renderer.clearDepth();
      }
      const autoClear = renderer.autoClear;
      renderer.autoClear = false;
      renderer.render(scene, camera);
      renderer.autoClear = autoClear;
      // Read before the upscale resets them; see sceneDrawCalls above.
      sceneDrawCalls += renderer.info.render.calls;
      sceneTriangles += renderer.info.render.triangles;
      renderer.setRenderTarget(null);

      // Paint the whole canvas in the frame colour, then lay the picture on
      // it at exactly target x scale pixels. A clear is not limited by the
      // viewport, which is what makes the border come out right.
      renderer.getClearColor(sceneClear);
      const sceneAlpha = renderer.getClearAlpha();
      renderer.setClearColor(border, 1);
      renderer.clear();
      renderer.setClearColor(sceneClear, sceneAlpha);
      renderer.setViewport(viewport.x, viewport.y, viewport.width, viewport.height);
      renderer.render(screenScene, screenCamera);
    },

    resize(grid) {
      pixelScale = grid.scale;
      size = grid.target;
      viewport = grid.viewport;
      target.setSize(size.width, size.height);
    },

    get size() {
      return size;
    },

    get pixelScale() {
      return pixelScale;
    },

    get sceneDrawCalls() {
      return sceneDrawCalls;
    },

    get sceneTriangles() {
      return sceneTriangles;
    },

    dispose() {
      target.dispose();
      quad.geometry.dispose();
      quad.material.dispose();
      screenScene.remove(quad);
    },
  };
}
