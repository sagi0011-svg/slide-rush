/**
 * The chase camera (SPEC 2).
 *
 * Sits behind and above the player, follows lane changes with damping, dips on
 * a slide, rises on a jump, and gets a small field-of-view kick on the visual
 * drop sections. It reads the player's pose; it never changes it.
 */

import type { PerspectiveCamera } from 'three';
import { CAMERA, LANES, PLAYER } from '../config';
import { curveDownhill, curveX, curveY } from './curve';

export interface ChaseCamera {
  /**
   * @param playerS how far the player has travelled, in units
   * @param laneOffset where the player is across the slide, in lane units
   * @param height how high the player is above the slide, in units
   * @param sliding whether the player is in the low slide pose
   * @param frameSeconds real time since the last frame, for the damping
   */
  update(
    playerS: number,
    laneOffset: number,
    height: number,
    sliding: boolean,
    frameSeconds: number,
  ): void;
}

/**
 * Frame-rate independent damping: the same ease at 30 fps and at 120 fps.
 * `rate` is roughly how many times per second the gap is closed.
 */
function damp(current: number, target: number, rate: number, frameSeconds: number): number {
  const t = 1 - Math.exp(-rate * Math.min(frameSeconds, 0.1));
  return current + (target - current) * t;
}

export function createChaseCamera(camera: PerspectiveCamera): ChaseCamera {
  // Damped values, kept across frames so the camera never snaps.
  let followX = 0;
  let followY = 0;
  let fov: number = CAMERA.fov;

  return {
    update(playerS, laneOffset, height, sliding, frameSeconds) {
      // Where the camera is along the slide: a fixed distance behind the player.
      const cameraS = playerS - CAMERA.offset.z;

      // Sideways: ease toward the player's lane rather than locking to it.
      const targetX = laneOffset * LANES.width;
      followX = damp(followX, targetX, CAMERA.laneDamping, frameSeconds);

      // Up and down: rise with a jump, dip on a slide (SPEC 2).
      const rise = (height / PLAYER.jumpHeight) * CAMERA.jumpRise;
      const targetY = CAMERA.offset.y + rise + (sliding ? -CAMERA.slideDip : 0);
      followY = damp(followY, targetY, CAMERA.heightDamping, frameSeconds);

      camera.position.set(
        curveX(cameraS) + followX * CAMERA.lateralFollow,
        curveY(cameraS) + followY,
        CAMERA.offset.z,
      );

      // Look at a point down the slide, which is what makes the bend read.
      const lookS = playerS + CAMERA.lookAhead;
      camera.lookAt(
        curveX(lookS) + targetX * CAMERA.lookLateralFollow,
        curveY(lookS) + CAMERA.lookHeight,
        playerS - lookS, // i.e. -CAMERA.lookAhead, in the same frame as the track
      );

      // A small kick on the drop sections: speed-feel only, no gameplay effect.
      const targetFov = CAMERA.fov + CAMERA.fovKickPerSlope * curveDownhill(playerS);
      fov = damp(fov, targetFov, CAMERA.fovDamping, frameSeconds);
      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
    },
  };
}
