/**
 * Drawing the rider (docs/ART-AND-SHOP.md §2): the animal in its ring, posed
 * and animated to match what the player is doing.
 *
 * Which animal and ring to draw is handed in from outside — the game passes
 * the pair from the save, the shop in M11 will pass whatever it is
 * previewing — and can be swapped at any time without rebuilding anything:
 * every pair is already in the atlas, so a swap is only new UVs.
 *
 * Everything here follows the player and changes nothing about it. The pose
 * comes from the height, the slide and the lane offset the game already
 * produced; the hitbox is the game's own and never sees any of this
 * (CLAUDE.md rule 13).
 */

import type { BufferAttribute, Camera, Mesh, PlaneGeometry, Scene } from 'three';
import { RIDER } from '../config';
import { POWERUP_TYPES, type PowerUpType } from '../game/powerups';
import { createRiderMesh, riderAnimalY, type RiderMesh } from './factories';
import {
  choosePose,
  effectFrame,
  poseLayout,
  ringSpinFrame,
  type PoseInput,
  type RiderPose,
} from './rider-pose';
import { animalCell, ATLAS_SIZE, effectCell, ringCell, type Cell, type RiderPair } from './sprites';

/** What the rider needs from the frame, all of it already interpolated. */
export interface RiderView {
  /** Where the rider stands across the slide and above it, in units. */
  x: number;
  groundY: number;
  height: number;
  /** Where the player is across the slide, in lane units, for the lean. */
  laneOffset: number;
  sliding: boolean;
  dead: boolean;
  /** Edge-bump feedback, 1 just after a refused lane change. */
  bump: number;
  /** Which power-ups are running, for their effects. */
  shielded: boolean;
  magnetised: boolean;
  boosting: boolean;
  /** Real seconds since the last frame. */
  frameSeconds: number;
}

export interface Rider {
  /** Shows a different animal or ring from the next frame on. */
  setPair(pair: RiderPair): void;
  readonly pair: RiderPair;
  /** The pose shown in the last frame, for the debug overlay. */
  readonly pose: RiderPose;
  update(view: RiderView): void;
  /**
   * Turns the rider square to the screen. Call after the camera has moved.
   *
   * The camera is always behind the rider, but on the drops it looks down on
   * it far more steeply than on the flat, and a sprite standing upright would
   * then be seen squashed. A pixel sprite must keep its pixels square, so it
   * copies the camera's turn and is always seen face on.
   */
  faceCamera(camera: Camera): void;
  dispose(): void;
}

/**
 * Points a quad at one cell of the atlas. Called only when the cell changes,
 * never every frame. The canvas is flipped on its way to the GPU, so the top
 * of a cell is the higher V.
 */
function showCell(mesh: Mesh<PlaneGeometry>, cell: Cell, mirror: boolean): void {
  const uv = mesh.geometry.getAttribute('uv') as BufferAttribute;
  // A sliver in from every edge, so nearest sampling can never pick up a
  // pixel of the next cell over.
  const inset = 0.01;
  let left = (cell.x + inset) / ATLAS_SIZE.width;
  let right = (cell.x + cell.width - inset) / ATLAS_SIZE.width;
  const top = 1 - (cell.y + inset) / ATLAS_SIZE.height;
  const bottom = 1 - (cell.y + cell.height - inset) / ATLAS_SIZE.height;
  if (mirror) [left, right] = [right, left];
  // PlaneGeometry's corners: top-left, top-right, bottom-left, bottom-right.
  uv.setXY(0, left, top);
  uv.setXY(1, right, top);
  uv.setXY(2, left, bottom);
  uv.setXY(3, right, bottom);
  uv.needsUpdate = true;
}

export function createRider(scene: Scene, initial: RiderPair): Rider {
  const mesh: RiderMesh = createRiderMesh();
  scene.add(mesh.group);

  let pair: RiderPair = { ...initial };
  let pose: RiderPose = 'idle';
  // The rider's own clock: it keeps bobbing behind the menus, where the run's
  // clock is stopped.
  let clock = 0;
  let lastLaneOffset = 0;
  let wasAirborne = false;
  let sinceLanding = Number.POSITIVE_INFINITY;

  // What each quad shows now, so UVs are only rewritten when it changes.
  let animalKey = '';
  let ringKey = '';
  const effectKeys: Record<PowerUpType, string> = { shield: '', magnet: '', boost: '' };

  // Reused every frame (rule 7).
  const running: Record<PowerUpType, boolean> = { shield: false, magnet: false, boost: false };
  const poseInput: PoseInput = {
    height: 0,
    sliding: false,
    dead: false,
    laneSpeed: 0,
    sinceLanding,
  };

  return {
    setPair(next) {
      pair = { ...next };
      // Forces new UVs on the next frame.
      animalKey = '';
      ringKey = '';
    },

    get pair() {
      return pair;
    },

    get pose() {
      return pose;
    },

    update(view) {
      const dt = Math.max(0, view.frameSeconds);
      clock += dt;

      // Coming down onto the water starts the landing squash.
      const airborne = view.height > RIDER.airborneHeight;
      if (wasAirborne && !airborne) sinceLanding = 0;
      else sinceLanding += dt;
      wasAirborne = airborne;

      // How fast the player is crossing the slide. A refused lane change
      // leans the rider into the wall it bumped.
      let laneSpeed = dt > 0 ? (view.laneOffset - lastLaneOffset) / dt : 0;
      lastLaneOffset = view.laneOffset;
      if (view.bump > RIDER.bumpLean) {
        laneSpeed = (view.laneOffset >= 0 ? 1 : -1) * (RIDER.leanThreshold + 1);
      }

      poseInput.height = view.height;
      poseInput.sliding = view.sliding;
      poseInput.dead = view.dead;
      poseInput.laneSpeed = laneSpeed;
      poseInput.sinceLanding = sinceLanding;
      pose = choosePose(poseInput);
      const layout = poseLayout(pose, clock);

      const nextAnimal = `${pair.animal}/${layout.frame}/${layout.mirror ? 1 : 0}`;
      if (nextAnimal !== animalKey) {
        showCell(mesh.animal, animalCell(pair.animal, layout.frame), layout.mirror);
        animalKey = nextAnimal;
      }

      const spin = ringSpinFrame(clock);
      const nextRing = `${pair.ring}/${spin}`;
      if (nextRing !== ringKey) {
        showCell(mesh.ringBack, ringCell(pair.ring, spin, 'back'), false);
        showCell(mesh.ringFront, ringCell(pair.ring, spin, 'front'), false);
        ringKey = nextRing;
      }

      const loop = effectFrame(clock);
      running.shield = view.shielded;
      running.magnet = view.magnetised;
      running.boost = view.boosting;
      for (const type of POWERUP_TYPES) {
        const quad = mesh.effects[type];
        quad.visible = running[type];
        if (!running[type]) continue;
        const key = `${loop}`;
        if (key !== effectKeys[type]) {
          showCell(quad, effectCell(type, loop), false);
          effectKeys[type] = key;
        }
      }

      // Whole sprite pixels only, so the layers keep their places on the
      // sprite's grid as they move against each other.
      const unit = 1 / RIDER.pixelsPerUnit;
      mesh.animal.position.y = riderAnimalY(layout.animalDy);
      mesh.body.position.y = -layout.riderDy * unit;
      mesh.group.position.set(view.x, view.groundY + view.height, 0);
    },

    faceCamera(camera) {
      mesh.group.quaternion.copy(camera.quaternion);
    },

    dispose() {
      scene.remove(mesh.group);
      // The material and the atlas are shared by every layer, so they are
      // freed once here rather than by each quad.
      for (const quad of [mesh.ringBack, mesh.animal, mesh.ringFront]) quad.geometry.dispose();
      for (const type of POWERUP_TYPES) mesh.effects[type].geometry.dispose();
      mesh.material.dispose();
      mesh.texture.dispose();
    },
  };
}
