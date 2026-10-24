/**
 * Drawing the obstacles (SPEC 7).
 *
 * One instanced mesh per obstacle type, plus one outline mesh each, so every
 * obstacle in view costs eight draw calls in total however many there are
 * (docs/ART-AND-SHOP.md §1). Nothing is created or destroyed while the game
 * runs: a type that has nothing on the track simply draws none of its
 * instances (CLAUDE.md rule 7).
 *
 * The shapes and the positions are exactly as they were with the placeholder
 * meshes — only the look changed — because both come from OBSTACLES.size,
 * which is also where the hitboxes in src/game/ come from.
 */

import { Matrix4, Quaternion, Vector3, type InstancedMesh, type Scene } from 'three';
import { LANES, TRACK } from '../config';
import type { ObstacleType } from '../game/obstacles';
import { OBSTACLE_TYPES } from '../game/obstacles';
import {
  createObstacleGeometry,
  createOutlinedInstances,
  obstacleMeshHeight,
  obstacleSize,
} from './factories';
import { curveX, curveY } from './curve';

/** What the renderer needs to know about one obstacle on the track. */
export interface ObstacleView {
  active: boolean;
  type: ObstacleType;
  lane: number;
  s: number;
}

export interface ObstacleLayer {
  /** Places every active obstacle for the player's current position. */
  update(obstacles: readonly ObstacleView[], playerS: number): void;
  dispose(): void;
}

/** Scratch objects, reused for every obstacle on every frame (rule 7). */
const matrix = new Matrix4();
const position = new Vector3();
const rotation = new Quaternion();
const scale = new Vector3(1, 1, 1);

interface Pool {
  mesh: InstancedMesh;
  outline: InstancedMesh;
  used: number;
}

export function createObstacleLayer(scene: Scene): ObstacleLayer {
  const pools = new Map<ObstacleType, Pool>();

  for (const type of OBSTACLE_TYPES) {
    const geometry = createObstacleGeometry(type);
    const { mesh, outline } = createOutlinedInstances(
      geometry,
      TRACK.obstaclePoolSize,
      obstacleSize(type),
    );
    scene.add(mesh, outline);
    pools.set(type, { mesh, outline, used: 0 });
  }

  return {
    update(obstacles, playerS) {
      for (const pool of pools.values()) pool.used = 0;

      for (const obstacle of obstacles) {
        if (!obstacle.active) continue;
        // Skip anything the fog hides anyway.
        const ahead = obstacle.s - playerS;
        if (ahead > TRACK.buildAhead || ahead < -TRACK.despawnBehind) continue;

        const pool = pools.get(obstacle.type);
        if (pool === undefined || pool.used >= TRACK.obstaclePoolSize) continue;

        // The same visual bend as the track, so obstacles sit on the slide.
        position.set(
          curveX(obstacle.s) + obstacle.lane * LANES.width,
          curveY(obstacle.s) + obstacleMeshHeight(obstacle.type),
          playerS - obstacle.s,
        );
        matrix.compose(position, rotation, scale);
        pool.mesh.setMatrixAt(pool.used, matrix);
        pool.outline.setMatrixAt(pool.used, matrix);
        pool.used += 1;
      }

      for (const pool of pools.values()) {
        pool.mesh.count = pool.used;
        pool.outline.count = pool.used;
        pool.mesh.instanceMatrix.needsUpdate = true;
        pool.outline.instanceMatrix.needsUpdate = true;
      }
    },

    dispose() {
      for (const pool of pools.values()) {
        scene.remove(pool.mesh, pool.outline);
        pool.mesh.geometry.dispose();
        pool.outline.geometry.dispose();
        (pool.mesh.material as { dispose(): void }).dispose();
        (pool.outline.material as { dispose(): void }).dispose();
        pool.mesh.dispose();
        pool.outline.dispose();
      }
      pools.clear();
    },
  };
}
