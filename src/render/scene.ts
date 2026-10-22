/**
 * Three.js setup: renderer, scene, camera, resizing.
 *
 * Reads game state and draws it; it never contains game rules (CLAUDE.md rule 4).
 */

import {
  Color,
  Fog,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  type BoxGeometry,
  type Mesh,
  type MeshStandardMaterial,
} from 'three';
import { CAMERA, PALETTE } from '../config';
import { createLights, createPlaceholderCube } from './factories';

export interface Renderer {
  /** Draws the current state. `spin` is already interpolated by the caller. */
  draw(spin: number): void;
  /** Matches the drawing buffer to the canvas' CSS size. Call on resize. */
  resize(): void;
  /** Frees GPU resources. */
  dispose(): void;
}

export function createRenderer(canvas: HTMLCanvasElement): Renderer {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(new Color(PALETTE.sky), 1);

  const scene = new Scene();
  scene.background = new Color(PALETTE.sky);
  // Fog hides track segments as they spawn in the distance (SPEC 2).
  scene.fog = new Fog(PALETTE.fog, CAMERA.far * 0.35, CAMERA.far);

  const camera = new PerspectiveCamera(CAMERA.fov, CAMERA.aspect, CAMERA.near, CAMERA.far);
  camera.position.set(CAMERA.offset.x, CAMERA.offset.y, CAMERA.offset.z);
  camera.lookAt(0, 0.6, -CAMERA.lookAhead);

  for (const light of createLights()) scene.add(light);

  const cube: Mesh<BoxGeometry, MeshStandardMaterial> = createPlaceholderCube();
  cube.position.set(0, 0.9, 0);
  scene.add(cube);

  const resize = (): void => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;
    // Cap the pixel ratio: a 3x retina phone does not need 3x the pixels (SPEC 13).
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  resize();

  return {
    draw(spin: number) {
      cube.rotation.set(spin * 0.6, spin, spin * 0.25);
      renderer.render(scene, camera);
    },
    resize,
    dispose() {
      cube.geometry.dispose();
      cube.material.dispose();
      renderer.dispose();
    },
  };
}
