/**
 * Square pixel splashes (docs/ART-AND-SHOP.md §1).
 *
 * When the player comes down from a jump, a handful of square pixels in the
 * three water colours fly up and fall back. One instanced quad draws the lot,
 * and the pool never grows: the arrays are all allocated up front and a new
 * burst reuses the particles that have died (CLAUDE.md rule 7).
 *
 * Purely decorative — it reads nothing from the game but the landing itself,
 * and changes nothing.
 */

import { Color, Matrix4, Quaternion, Vector3, type InstancedMesh, type Scene } from 'three';
import { PALETTE, RETRO } from '../config';
import { createSplashInstances } from './factories';

export interface Splash {
  /**
   * Throws a burst of pixels up from a point on the slide.
   *
   * @param x across the slide, in units
   * @param y height above the slide, in units
   * @param z along the slide in the moving frame, in units
   */
  burst(x: number, y: number, z: number): void;
  /**
   * Moves every live particle on.
   *
   * @param frameSeconds real seconds since the last frame
   * @param travelled how far the player moved this frame, in units, so the
   *   particles fall behind with the rest of the world instead of hanging
   *   next to the player
   */
  update(frameSeconds: number, travelled: number): void;
  dispose(): void;
}

/** The three colours a splash pixel can be, from the water palette. */
const COLORS = [PALETTE.waterLight, PALETTE.water, PALETTE.waterDeep] as const;

const matrix = new Matrix4();
const position = new Vector3();
const rotation = new Quaternion();
const scale = new Vector3(1, 1, 1);

/**
 * A tiny number generator of its own, so the splash never reaches into the
 * gameplay stream in src/game/rng.ts (CLAUDE.md rule 6).
 */
function createNoise(): () => number {
  let state = 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 100000) / 100000;
  };
}

export function createSplash(scene: Scene): Splash {
  const capacity = RETRO.splash.poolSize;
  const mesh: InstancedMesh = createSplashInstances(capacity);
  scene.add(mesh);

  // One slot per particle, all allocated now and never again.
  const px = new Float32Array(capacity);
  const py = new Float32Array(capacity);
  const pz = new Float32Array(capacity);
  const vx = new Float32Array(capacity);
  const vy = new Float32Array(capacity);
  const vz = new Float32Array(capacity);
  const life = new Float32Array(capacity);
  const noise = createNoise();
  const colour = new Color();

  // Every slot's colour is set once; a particle keeps whichever it was given.
  for (let i = 0; i < capacity; i += 1) {
    colour.set(COLORS[i % COLORS.length] as number);
    mesh.setColorAt(i, colour);
  }
  if (mesh.instanceColor !== null) mesh.instanceColor.needsUpdate = true;

  /** The next slot to reuse: oldest first, by simply going round. */
  let next = 0;

  return {
    burst(x, y, z) {
      const { perLanding, life: span, speedMin, speedMax } = RETRO.splash;
      for (let i = 0; i < perLanding; i += 1) {
        const slot = next;
        next = (next + 1) % capacity;

        const angle = noise() * Math.PI * 2;
        const speed = speedMin + noise() * (speedMax - speedMin);
        px[slot] = x;
        py[slot] = y;
        pz[slot] = z;
        vx[slot] = Math.cos(angle) * speed * 0.45;
        // Mostly upward: it is water being kicked up, not thrown out.
        vy[slot] = speed;
        vz[slot] = Math.sin(angle) * speed * 0.45;
        life[slot] = span;
      }
    },

    update(frameSeconds, travelled) {
      // Every slot is written every frame, dead ones at zero size. Packing the
      // live ones down to the front instead would be a little cheaper, but a
      // slot's colour was set once and belongs to that slot — moving the
      // matrices would hand each particle somebody else's colour.
      for (let i = 0; i < capacity; i += 1) {
        const remaining = (life[i] as number) - frameSeconds;
        life[i] = remaining > 0 ? remaining : 0;

        if (remaining <= 0) {
          // Dead, or long dead: parked at no size, costing nothing to draw.
          scale.setScalar(0);
          matrix.compose(position.set(0, 0, 0), rotation, scale);
          mesh.setMatrixAt(i, matrix);
          continue;
        }

        const speedY = (vy[i] as number) - RETRO.splash.gravity * frameSeconds;
        const x = (px[i] as number) + (vx[i] as number) * frameSeconds;
        const y = (py[i] as number) + speedY * frameSeconds;
        // The world slides past the player, and so does a splash left behind.
        const z = (pz[i] as number) + (vz[i] as number) * frameSeconds + travelled;
        vy[i] = speedY;
        px[i] = x;
        py[i] = y;
        pz[i] = z;

        position.set(x, y, z);
        // Shrinking as it dies, which reads better than fading on a pixel.
        scale.setScalar(Math.max(0.2, remaining / RETRO.splash.life));
        matrix.compose(position, rotation, scale);
        mesh.setMatrixAt(i, matrix);
      }

      mesh.count = capacity;
      mesh.instanceMatrix.needsUpdate = true;
    },

    dispose() {
      scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as { dispose(): void }).dispose();
      mesh.dispose();
    },
  };
}
