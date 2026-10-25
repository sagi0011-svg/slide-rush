/**
 * The scenery down both sides of the slide (docs/ART-AND-SHOP.md §1).
 *
 * Slide towers, round trees, palms and huts, pooled and recycled with the
 * player exactly like the track segments (CLAUDE.md rule 7). Which prop stands
 * where comes from scenery-layout.ts, worked out from the slot's own number,
 * so a stretch of slide looks the same every time it comes round and nothing
 * has to be remembered between frames.
 *
 * Each kind of prop is one instanced mesh plus one outline mesh, so all the
 * scenery on screen — twenty-odd props — costs ten draw calls in total,
 * however many are in view.
 */

import { Matrix4, Quaternion, Vector3, type InstancedMesh, type Scene } from 'three';
import { RETRO } from '../config';
import { createOutlinedInstances, createSceneryGeometry } from './factories';
import { curveX, curveY } from './curve';
import {
  SCENERY_KINDS,
  sceneryAt,
  sceneryWindowSlots,
  sceneryWindowStart,
  type SceneryKind,
} from './scenery-layout';

export interface Scenery {
  /** Places every prop for the player's current position. */
  update(playerS: number): void;
  dispose(): void;
}

/** Scratch objects, reused for every prop on every frame (rule 7). */
const matrix = new Matrix4();
const position = new Vector3();
const rotation = new Quaternion();
const spinAxis = new Vector3(0, 1, 0);
const scale = new Vector3(1, 1, 1);

interface Pool {
  mesh: InstancedMesh;
  outline: InstancedMesh;
  /** How many of this kind have been placed so far this frame. */
  used: number;
}

export function createScenery(scene: Scene): Scenery {
  const slots = sceneryWindowSlots();
  // Worst case every slot on both sides holds the same kind of prop.
  const capacity = slots * 2;

  const pools = new Map<SceneryKind, Pool>();
  for (const kind of SCENERY_KINDS) {
    const geometry = createSceneryGeometry(kind);
    const { mesh, outline } = createOutlinedInstances(geometry, capacity);
    scene.add(mesh, outline);
    pools.set(kind, { mesh, outline, used: 0 });
  }

  return {
    update(playerS) {
      for (const pool of pools.values()) pool.used = 0;

      const firstSlot = sceneryWindowStart(playerS);
      for (let i = 0; i < slots; i += 1) {
        const slot = firstSlot + i;
        const s = slot * RETRO.scenery.spacing;
        const ahead = s - playerS;
        if (ahead > RETRO.scenery.buildAhead || ahead < -RETRO.scenery.recycleBehind) continue;

        for (const side of [-1, 1]) {
          const prop = sceneryAt(slot, side);
          if (prop.kind === null) continue;
          const pool = pools.get(prop.kind);
          if (pool === undefined || pool.used >= capacity) continue;

          // The same visual bend as the track, so the scenery follows the
          // slide round its curves instead of drifting away from it.
          position.set(
            curveX(s) + side * prop.offset,
            curveY(s),
            // The player sits at z = 0 and the world slides past them.
            playerS - s,
          );
          rotation.setFromAxisAngle(spinAxis, prop.spin);
          scale.setScalar(prop.scale);
          matrix.compose(position, rotation, scale);

          pool.mesh.setMatrixAt(pool.used, matrix);
          pool.outline.setMatrixAt(pool.used, matrix);
          pool.used += 1;
        }
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
