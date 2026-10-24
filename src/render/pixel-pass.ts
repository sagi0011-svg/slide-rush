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
import { choosePixelScale, lowResSize, type TargetSize } from './retro';

export interface PixelPass {
  /** Draws the scene into the small target, then blows it up onto the canvas. */
  render(scene: Scene, camera: Camera): void;
  /** Resizes the target to match a drawing buffer of this size. */
  resize(bufferWidth: number, bufferHeight: number): void;
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

export function createPixelPass(renderer: WebGLRenderer): PixelPass {
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
  let sceneDrawCalls = 0;
  let sceneTriangles = 0;

  return {
    render(scene, camera) {
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(scene, camera);
      // Read before the upscale resets them; see sceneDrawCalls above.
      sceneDrawCalls = renderer.info.render.calls;
      sceneTriangles = renderer.info.render.triangles;
      renderer.setRenderTarget(null);
      renderer.render(screenScene, screenCamera);
    },

    resize(bufferWidth, bufferHeight) {
      pixelScale = choosePixelScale(bufferWidth);
      size = lowResSize(bufferWidth, bufferHeight, pixelScale);
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
