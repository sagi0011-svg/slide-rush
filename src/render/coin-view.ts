/**
 * Drawing the coins (SPEC 8).
 *
 * Every coin on the track is drawn by one instanced mesh, so a long trail
 * costs a single draw call (SPEC 13). The matrices are written into
 * pre-allocated scratch objects, so no garbage is made per frame (rule 7).
 */

import { Matrix4, Quaternion, Vector3, type InstancedMesh, type Scene } from 'three';
import { COINS, LANES } from '../config';
import { createCoinInstances } from './factories';
import { curveX, curveY } from './curve';

/** What the renderer needs to know about one coin. */
export interface CoinView {
  active: boolean;
  lane: number;
  s: number;
  y: number;
}

export interface CoinLayer {
  /**
   * Places and spins every coin still on the track.
   *
   * @param playerS how far the player has travelled, in units
   * @param elapsed run time, in seconds, which is what the spin follows
   */
  update(coins: readonly CoinView[], playerS: number, elapsed: number): void;
  dispose(): void;
}

// Scratch objects, reused for every coin on every frame.
const matrix = new Matrix4();
const position = new Vector3();
const rotation = new Quaternion();
const spinAxis = new Vector3(0, 1, 0);
const scale = new Vector3(1, 1, 1);

export function createCoinLayer(scene: Scene, capacity: number = COINS.poolSize): CoinLayer {
  const mesh: InstancedMesh = createCoinInstances(capacity);
  scene.add(mesh);

  return {
    update(coins, playerS, elapsed) {
      // All coins spin together; one angle does for the whole trail.
      const angle = elapsed * COINS.spinRate * Math.PI * 2;
      rotation.setFromAxisAngle(spinAxis, angle);

      let drawn = 0;
      for (const coin of coins) {
        if (!coin.active) continue;
        if (drawn >= capacity) break;

        // The same visual bend as the track, so coins sit above the slide.
        position.set(
          curveX(coin.s) + coin.lane * LANES.width,
          curveY(coin.s) + coin.y,
          playerS - coin.s,
        );
        matrix.compose(position, rotation, scale);
        mesh.setMatrixAt(drawn, matrix);
        drawn += 1;
      }

      mesh.count = drawn;
      mesh.instanceMatrix.needsUpdate = true;
    },

    dispose() {
      scene.remove(mesh);
      mesh.geometry.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) {
        for (const entry of material) entry.dispose();
      } else {
        material.dispose();
      }
      mesh.dispose();
    },
  };
}
