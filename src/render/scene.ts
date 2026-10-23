/**
 * Three.js setup: renderer, scene, camera, the slide and the player mesh.
 *
 * This layer reads game state and draws it; it never contains game rules
 * (CLAUDE.md rule 4). Everything it needs arrives already interpolated.
 */

import { Color, Fog, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { CAMERA, LANES, PALETTE, PLAYER } from '../config';
import { createBlobShadow, createLights, createPlayerMesh, createSlideTexture } from './factories';
import { createTrack, type Track } from './track';
import { createObstacleLayer, type ObstacleLayer, type ObstacleView } from './obstacle-view';
import { createCoinLayer, type CoinLayer, type CoinView } from './coin-view';
import { createPickupLayer, type PickupLayer, type PickupView } from './pickup-view';
import { createShieldBubble } from './factories';
import { createChaseCamera, type ChaseCamera } from './camera';
import { curveX, curveY } from './curve';

/** Everything the renderer needs to draw one frame, already interpolated. */
export interface Frame {
  /** How far the player has travelled, in units. */
  distance: number;
  /** Where the player is across the slide, in lane units (-1..1). */
  laneOffset: number;
  /** How high the player is above the slide, in units. */
  height: number;
  /** True while the player is in the low slide pose. */
  sliding: boolean;
  /** Edge-bump feedback, 1 just after a refused lane change, fading to 0. */
  bump: number;
  /** The obstacles on the track. */
  obstacles: readonly ObstacleView[];
  /** The coins on the track. */
  coins: readonly CoinView[];
  /** The one power-up pickup, if there is one on the track (SPEC 9). */
  pickup: PickupView;
  /** True while a shield is up, which draws the bubble (SPEC 9). */
  shielded: boolean;
  /** True while a boost is running, which widens the view (SPEC 2). */
  boosting: boolean;
  /** Run time, in seconds, which is what the coins spin to. */
  elapsed: number;
  /** Counts up on every stumble; a change sets the camera shaking. */
  shakeTrigger: number;
  /** False when the player has turned shake and flash off: no shaking at all. */
  shakeEnabled: boolean;
  /** True once the run has ended, for the death beat. */
  dead: boolean;
  /** Real seconds since the last frame, for camera damping. */
  frameSeconds: number;
}

export interface Renderer {
  draw(frame: Frame): void;
  /** Matches the drawing buffer to the canvas' CSS size. Call on resize. */
  resize(): void;
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
  // Fog hides track segments as they are recycled into view (SPEC 2).
  scene.fog = new Fog(PALETTE.fog, CAMERA.fogNear, CAMERA.fogFar);

  const camera = new PerspectiveCamera(CAMERA.fov, CAMERA.aspect, CAMERA.near, CAMERA.far);
  const chase: ChaseCamera = createChaseCamera(camera);

  for (const light of createLights()) scene.add(light);

  const texture = createSlideTexture();
  const track: Track = createTrack(scene, texture);
  const obstacleLayer: ObstacleLayer = createObstacleLayer(scene);
  const coinLayer: CoinLayer = createCoinLayer(scene);
  const pickupLayer: PickupLayer = createPickupLayer(scene);

  const shieldBubble = createShieldBubble();
  scene.add(shieldBubble);

  const player = createPlayerMesh();
  scene.add(player);

  const shadow = createBlobShadow();
  scene.add(shadow);

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

  // Camera shake, kept across frames (SPEC 7).
  let shake = 0;
  let lastShakeTrigger = 0;

  return {
    draw(frame: Frame) {
      track.update(frame.distance);
      obstacleLayer.update(frame.obstacles, frame.distance);
      coinLayer.update(frame.coins, frame.distance, frame.elapsed);
      pickupLayer.update(frame.pickup, frame.distance, frame.elapsed);

      // A stumble shakes the camera for a moment (SPEC 7). The counter only
      // ever climbs during a run, so a drop means a new run started — which
      // must not set the camera shaking.
      if (frame.shakeTrigger > lastShakeTrigger && frame.shakeEnabled) {
        shake = CAMERA.shakeTime;
      }
      lastShakeTrigger = frame.shakeTrigger;
      // Turned off mid-shake: it stops there and then.
      if (!frame.shakeEnabled) shake = 0;
      if (shake > 0) shake = Math.max(0, shake - frame.frameSeconds);

      // A refused lane change nudges the player against the wall and back.
      const bumpOffset = frame.bump * Math.sin(frame.bump * Math.PI) * 0.25;
      const across = frame.laneOffset * LANES.width;
      const baseX = curveX(frame.distance) + across;
      const groundY = curveY(frame.distance);

      // Squash the capsule into the low slide pose (SPEC 3).
      const squash = frame.sliding ? PLAYER.slideHeight / PLAYER.standHeight : 1;
      player.scale.set(1, squash, 1);
      player.position.set(
        baseX + bumpOffset * Math.sign(across === 0 ? 1 : across),
        groundY + frame.height + (PLAYER.standHeight / 2) * squash,
        0,
      );
      player.rotation.z = -frame.bump * 0.25 * Math.sign(across === 0 ? 1 : across);

      // The blob shadow stays on the slide and shrinks as the player rises.
      const lift = Math.min(frame.height / PLAYER.jumpHeight, 1);
      shadow.position.set(baseX, groundY + 0.02, 0);
      shadow.scale.setScalar(1 - lift * 0.45);
      shadow.material.opacity = 0.25 * (1 - lift * 0.6);

      // The shield bubble rides with the player.
      shieldBubble.visible = frame.shielded;
      if (frame.shielded) {
        shieldBubble.position.set(baseX, groundY + frame.height + PLAYER.standHeight / 2, 0);
      }

      chase.update(
        frame.distance,
        frame.laneOffset,
        frame.height,
        frame.sliding,
        frame.boosting,
        frame.frameSeconds,
      );

      if (shake > 0) {
        // A quick decaying wobble, not a drift: it always returns to centre.
        const strength = (shake / CAMERA.shakeTime) * CAMERA.shakeAmount;
        const t = shake * 90;
        camera.position.x += Math.sin(t) * strength;
        camera.position.y += Math.cos(t * 1.7) * strength * 0.6;
      }

      renderer.render(scene, camera);
    },
    resize,
    dispose() {
      track.dispose();
      obstacleLayer.dispose();
      coinLayer.dispose();
      pickupLayer.dispose();
      scene.remove(shieldBubble);
      shieldBubble.geometry.dispose();
      shieldBubble.material.dispose();
      scene.remove(player, shadow);
      player.geometry.dispose();
      player.material.dispose();
      shadow.geometry.dispose();
      shadow.material.dispose();
      texture.dispose();
      renderer.dispose();
    },
  };
}
