/**
 * Three.js setup: renderer, scene, camera, the slide and the player mesh.
 *
 * This layer reads game state and draws it; it never contains game rules
 * (CLAUDE.md rule 4). Everything it needs arrives already interpolated.
 *
 * Since M9 the scene is drawn into a small target and blown back up, which is
 * what gives the game its retro pixel look and, because there are far fewer
 * pixels to fill, also makes it cheaper (see pixel-pass.ts).
 */

import { Color, Fog, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { CAMERA, LANES, PALETTE, PLAYER } from '../config';
import { createQualityGovernor } from './quality';
import { createBlobShadow, createLights } from './factories';
import { createSlideTexture } from './textures';
import { createTrack, type Track } from './track';
import { createObstacleLayer, type ObstacleLayer, type ObstacleView } from './obstacle-view';
import { createCoinLayer, type CoinLayer, type CoinView } from './coin-view';
import { createPickupLayer, type PickupLayer, type PickupView } from './pickup-view';
import { createRider, type Rider, type RiderView } from './rider';
import type { RiderPair } from './sprites';
import { createChaseCamera, type ChaseCamera } from './camera';
import { createHitboxLayer, type HitboxLayer } from './hitbox-view';
import { createPixelPass, type PixelPass } from './pixel-pass';
import { createSky, type Sky } from './sky';
import { createScenery, type Scenery } from './scenery';
import { createGround, type Ground } from './ground';
import { createSplash, type Splash } from './splash';
import { pixelCount } from './retro';
import type { HitboxList } from '../game/hitboxes';
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
  /** True while a magnet is running, which draws its waves round the rider. */
  magnetised: boolean;
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
  /** The hitboxes to outline in debug mode, or null for none (SPEC 13). */
  hitboxes: HitboxList | null;
}

export interface Renderer {
  draw(frame: Frame): void;
  /** Matches the drawing buffer to the canvas' CSS size. Call on resize. */
  resize(): void;
  /**
   * Counts a frame of play towards the frame-rate watch, which lowers the
   * resolution on a phone that cannot keep up (SPEC 13).
   */
  measure(frameSeconds: number): void;
  /** The resolution multiplier in use, for the debug overlay. */
  readonly pixelRatio: number;
  /** What the last frame cost the GPU, for the debug overlay (SPEC 13). */
  readonly drawCalls: number;
  readonly triangles: number;
  /** How many pixels the scene was actually drawn at, for the debug overlay. */
  readonly gamePixels: number;
  /** How many screen pixels wide one game pixel is (docs/ART-AND-SHOP.md §1). */
  readonly pixelScale: number;
  /** The animal and ring being drawn, and what pose they are in (§2). */
  readonly rider: Rider;
  dispose(): void;
}

/**
 * @param canvas where to draw
 * @param riderPair which animal in which ring to draw as the player (§2)
 */
export function createRenderer(canvas: HTMLCanvasElement, riderPair: RiderPair): Renderer {
  const renderer = new WebGLRenderer({
    canvas,
    // Off on purpose: the picture is deliberately made of hard pixel edges,
    // and smoothing them is both the wrong look and wasted work (§1).
    antialias: false,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(new Color(PALETTE.sky), 1);

  const scene = new Scene();
  // Fog hides track segments as they are recycled into view (SPEC 2). It
  // matches the bottom of the sky, so the slide fades into the sunset.
  scene.fog = new Fog(PALETTE.fog, CAMERA.fogNear, CAMERA.fogFar);

  const camera = new PerspectiveCamera(CAMERA.fov, CAMERA.aspect, CAMERA.near, CAMERA.far);
  const chase: ChaseCamera = createChaseCamera(camera);

  for (const light of createLights()) scene.add(light);

  // The sky sets scene.background itself, and adds the two layers of hills.
  const sky: Sky = createSky(scene);

  const texture = createSlideTexture();
  const track: Track = createTrack(scene, texture);
  const ground: Ground = createGround(scene);
  const scenery: Scenery = createScenery(scene);
  const obstacleLayer: ObstacleLayer = createObstacleLayer(scene);
  const coinLayer: CoinLayer = createCoinLayer(scene);
  const pickupLayer: PickupLayer = createPickupLayer(scene);
  const splash: Splash = createSplash(scene);

  // The animal in its ring, with the power-up effects drawn round it (§2).
  const rider: Rider = createRider(scene, riderPair);
  // Filled in every frame rather than rebuilt (rule 7).
  const riderView: RiderView = {
    x: 0,
    groundY: 0,
    height: 0,
    laneOffset: 0,
    sliding: false,
    dead: false,
    bump: 0,
    shielded: false,
    magnetised: false,
    boosting: false,
    frameSeconds: 0,
  };

  const shadow = createBlobShadow();
  scene.add(shadow);

  const quality = createQualityGovernor(window.devicePixelRatio);
  const pixelPass: PixelPass = createPixelPass(renderer);

  const resize = (): void => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;
    // Capped, and lowered further on a phone that cannot keep up (SPEC 13).
    renderer.setPixelRatio(quality.pixelRatio);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    // The low-res target follows the drawing buffer, not the CSS size, so one
    // game pixel is the same number of real screen pixels on every device.
    pixelPass.resize(width * quality.pixelRatio, height * quality.pixelRatio);
  };

  resize();

  // Built the first time debug mode asks for it, and never otherwise.
  let hitboxLayer: HitboxLayer | null = null;

  // Camera shake, kept across frames (SPEC 7).
  let shake = 0;
  let lastShakeTrigger = 0;
  // For the splash: how high the player was last frame, and how far along.
  let lastHeight = 0;
  let lastDistance = 0;

  return {
    draw(frame: Frame) {
      track.update(frame.distance);
      ground.update(frame.distance);
      scenery.update(frame.distance);
      obstacleLayer.update(frame.obstacles, frame.distance);
      coinLayer.update(frame.coins, frame.distance, frame.elapsed);
      pickupLayer.update(frame.pickup, frame.distance, frame.elapsed);
      if (frame.hitboxes !== null) hitboxLayer ??= createHitboxLayer(scene);
      hitboxLayer?.update(frame.hitboxes, frame.distance);

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

      // The rider: posed by what the player is doing, never the other way
      // round (CLAUDE.md rule 13). It has no squash and no tilt — pixel art
      // only moves by whole pixels — so the slide pose and the lean are
      // frames of their own.
      riderView.x = baseX + bumpOffset * Math.sign(across === 0 ? 1 : across);
      riderView.groundY = groundY;
      riderView.height = frame.height;
      riderView.laneOffset = frame.laneOffset;
      riderView.sliding = frame.sliding;
      riderView.dead = frame.dead;
      riderView.bump = frame.bump;
      riderView.shielded = frame.shielded;
      riderView.magnetised = frame.magnetised;
      riderView.boosting = frame.boosting;
      riderView.frameSeconds = frame.frameSeconds;
      rider.update(riderView);

      // Coming down from a jump throws up a splash of square pixels (§1).
      // Purely decorative: it watches the height it was given and nothing else.
      if (lastHeight > 0.05 && frame.height <= 0.05 && !frame.dead) {
        splash.burst(baseX, groundY + 0.1, 0);
      }
      lastHeight = frame.height;
      // A restart drops the distance back to zero; that is not travel.
      const travelled = Math.max(0, frame.distance - lastDistance);
      lastDistance = frame.distance;
      splash.update(frame.frameSeconds, travelled);

      // The blob shadow stays on the slide and shrinks as the player rises.
      const lift = Math.min(frame.height / PLAYER.jumpHeight, 1);
      shadow.position.set(baseX, groundY + 0.02, 0);
      shadow.scale.setScalar(1 - lift * 0.45);
      shadow.material.opacity = 0.3 * (1 - lift * 0.6);

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

      // The rider turns square to the camera, so it too goes after it.
      rider.faceCamera(camera);

      // The hills ride with the camera, so they must be moved after it.
      sky.update(camera);

      // Into the small target, then blown up onto the canvas (§1).
      pixelPass.render(scene, camera);
    },
    resize,
    measure(frameSeconds) {
      if (quality.sample(frameSeconds)) resize();
    },
    get pixelRatio() {
      return quality.pixelRatio;
    },
    get drawCalls() {
      // The scene's own calls, plus the one quad that blows it up to the
      // canvas. Three's counters only remember the last render (pixel-pass.ts).
      return pixelPass.sceneDrawCalls + 1;
    },
    get triangles() {
      return pixelPass.sceneTriangles + 2;
    },
    get gamePixels() {
      return pixelCount(pixelPass.size);
    },
    get pixelScale() {
      return pixelPass.pixelScale;
    },
    rider,
    dispose() {
      track.dispose();
      ground.dispose();
      scenery.dispose();
      obstacleLayer.dispose();
      coinLayer.dispose();
      pickupLayer.dispose();
      splash.dispose();
      sky.dispose();
      hitboxLayer?.dispose();
      pixelPass.dispose();
      rider.dispose();
      scene.remove(shadow);
      shadow.geometry.dispose();
      shadow.material.dispose();
      texture.dispose();
      renderer.dispose();
    },
  };
}
