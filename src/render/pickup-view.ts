/**
 * Drawing the floating power-up pickup (SPEC 9).
 *
 * Only one is ever on the track, so this keeps one mesh per type and shows
 * whichever is needed — no mesh is ever built or thrown away mid-run (rule 7).
 */

import type { Mesh, Scene } from 'three';
import { LANES, POWERUPS } from '../config';
import { POWERUP_TYPES, type PowerUpType } from '../game/powerups';
import { createPickupMesh } from './factories';
import { curveX, curveY } from './curve';

export interface PickupView {
  active: boolean;
  type: PowerUpType;
  lane: number;
  s: number;
  y: number;
}

export interface PickupLayer {
  update(pickup: PickupView, playerS: number, elapsed: number): void;
  dispose(): void;
}

export function createPickupLayer(scene: Scene): PickupLayer {
  const meshes = new Map<PowerUpType, Mesh>();
  for (const type of POWERUP_TYPES) {
    const mesh = createPickupMesh(type);
    mesh.visible = false;
    scene.add(mesh);
    meshes.set(type, mesh);
  }

  return {
    update(pickup, playerS, elapsed) {
      for (const [type, mesh] of meshes) {
        const showing = pickup.active && pickup.type === type;
        mesh.visible = showing;
        if (!showing) continue;

        // Bob gently and turn, so it reads as something to pick up.
        const bob = Math.sin(elapsed * 2.2) * 0.18;
        mesh.position.set(
          curveX(pickup.s) + pickup.lane * LANES.width,
          curveY(pickup.s) + pickup.y + bob,
          playerS - pickup.s,
        );
        mesh.rotation.y = elapsed * POWERUPS.pickupSpinRate * Math.PI * 2;
        mesh.rotation.x = elapsed * POWERUPS.pickupSpinRate * Math.PI;
      }
    },

    dispose() {
      for (const mesh of meshes.values()) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        const material = mesh.material;
        if (Array.isArray(material)) {
          for (const entry of material) entry.dispose();
        } else {
          material.dispose();
        }
      }
      meshes.clear();
    },
  };
}
