/**
 * Drawing the obstacles (SPEC 7).
 *
 * One pooled mesh per obstacle type, matched to the game's own obstacle pool.
 * Meshes are hidden rather than created and destroyed, so the hot loop makes
 * no garbage (CLAUDE.md rule 7).
 */

import type { Mesh, Scene } from 'three';
import { LANES, TRACK } from '../config';
import type { ObstacleType } from '../game/obstacles';
import { OBSTACLE_TYPES } from '../game/obstacles';
import { createObstacleMesh, obstacleMeshHeight } from './factories';
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

export function createObstacleLayer(scene: Scene): ObstacleLayer {
  // A pool per type, so a mesh is never rebuilt when an obstacle changes type.
  const pools = new Map<ObstacleType, Mesh[]>();
  const used = new Map<ObstacleType, number>();

  for (const type of OBSTACLE_TYPES) {
    pools.set(type, []);
    used.set(type, 0);
  }

  const grow = (type: ObstacleType): Mesh => {
    const mesh = createObstacleMesh(type);
    mesh.visible = false;
    scene.add(mesh);
    (pools.get(type) as Mesh[]).push(mesh);
    return mesh;
  };

  return {
    update(obstacles, playerS) {
      for (const type of OBSTACLE_TYPES) used.set(type, 0);

      for (const obstacle of obstacles) {
        if (!obstacle.active) continue;
        // Skip anything the fog hides anyway.
        const ahead = obstacle.s - playerS;
        if (ahead > TRACK.buildAhead || ahead < -TRACK.despawnBehind) continue;

        const pool = pools.get(obstacle.type) as Mesh[];
        const index = used.get(obstacle.type) as number;
        const mesh = pool[index] ?? grow(obstacle.type);
        used.set(obstacle.type, index + 1);

        // The same visual bend as the track, so obstacles sit on the slide.
        mesh.position.set(
          curveX(obstacle.s) + obstacle.lane * LANES.width,
          curveY(obstacle.s) + obstacleMeshHeight(obstacle.type),
          playerS - obstacle.s,
        );
        mesh.visible = true;
      }

      // Hide whatever was not needed this frame.
      for (const type of OBSTACLE_TYPES) {
        const pool = pools.get(type) as Mesh[];
        for (let i = used.get(type) as number; i < pool.length; i += 1) {
          (pool[i] as Mesh).visible = false;
        }
      }
    },

    dispose() {
      for (const pool of pools.values()) {
        for (const mesh of pool) {
          scene.remove(mesh);
          mesh.geometry.dispose();
          const material = mesh.material;
          if (Array.isArray(material)) {
            for (const entry of material) entry.dispose();
          } else {
            material.dispose();
          }
        }
        pool.length = 0;
      }
    },
  };
}
