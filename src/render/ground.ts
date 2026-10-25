/**
 * The grass the slide and the scenery stand on (docs/ART-AND-SHOP.md §1).
 *
 * One strip, one draw call. It moves with the player and is reshaped every
 * frame to follow the slide's bends from curve.ts, a little below the slide
 * floor so it never shows through. That is a few dozen vertices rewritten in
 * place, with nothing allocated (CLAUDE.md rule 7). The fog fades its far
 * edge into the bottom of the sky, so it never ends in a hard line.
 */

import type { BufferAttribute, Scene } from 'three';
import { RETRO } from '../config';
import { curveX, curveY } from './curve';
import { createGroundMesh } from './factories';
import { groundPatternBase, groundRowS } from './ground-layout';

export interface Ground {
  /** Lays the grass out round the player's current position. */
  update(playerS: number): void;
  dispose(): void;
}

export function createGround(scene: Scene): Ground {
  const mesh = createGroundMesh();
  // The vertices are rewritten in world terms every frame, so the bounds the
  // mesh was built with mean nothing. It is always in view anyway.
  mesh.frustumCulled = false;
  scene.add(mesh);

  const position = mesh.geometry.getAttribute('position') as BufferAttribute;
  const uv = mesh.geometry.getAttribute('uv') as BufferAttribute;
  const half = RETRO.ground.width / 2;
  const pattern = RETRO.ground.patternLength;

  return {
    update(playerS) {
      const base = groundPatternBase(playerS);
      for (let row = 0; row <= RETRO.ground.rows; row += 1) {
        const s = groundRowS(playerS, row);
        const x = curveX(s);
        const y = curveY(s) - RETRO.ground.drop;
        // The player sits at z = 0 and the world slides past them.
        const z = playerS - s;
        const v = (s - base) / pattern;
        // Two vertices a row, left then right: the order the plane was built in.
        const left = row * 2;
        position.setXYZ(left, x - half, y, z);
        position.setXYZ(left + 1, x + half, y, z);
        uv.setXY(left, (x - half) / pattern, v);
        uv.setXY(left + 1, (x + half) / pattern, v);
      }
      position.needsUpdate = true;
      uv.needsUpdate = true;
    },

    dispose() {
      scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.map?.dispose();
      mesh.material.dispose();
    },
  };
}
