/**
 * Drawing the coins (SPEC 8).
 *
 * Every coin on the track is drawn by one instanced mesh, so a long trail
 * costs a single draw call (SPEC 13). The matrices are written into
 * pre-allocated scratch objects, so no garbage is made per frame (rule 7).
 */

import { Matrix4, Quaternion, Vector3, type InstancedMesh, type Scene, type Texture } from 'three';
import { COINS, LANES, RETRO } from '../config';
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
const scale = new Vector3(1, 1, 1);

export function createCoinLayer(scene: Scene, capacity: number = COINS.poolSize): CoinLayer {
  const { mesh, texture }: { mesh: InstancedMesh; texture: Texture } =
    createCoinInstances(capacity);
  scene.add(mesh);

  return {
    update(coins, playerS, elapsed) {
      // The coin is a flat billboard now, spun by stepping through the frames
      // of its pixel strip rather than by turning the mesh (§1). Every coin
      // shows the same frame — they always did spin in step — so one offset
      // animates the whole trail.
      const frame = Math.floor(elapsed * RETRO.coin.frameRate) % RETRO.coin.frames;
      texture.offset.x = frame / RETRO.coin.frames;

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
      texture.dispose();
      mesh.dispose();
    },
  };
}
