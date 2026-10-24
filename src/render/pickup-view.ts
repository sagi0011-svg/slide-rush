/**
 * Drawing the floating power-up pickup (SPEC 9).
 *
 * Only one is ever on the track, so this keeps one prop per type and shows
 * whichever is needed — no prop is ever built or thrown away mid-run (rule 7).
 *
 * Each prop is a ring with the power-up's pixel icon in the middle
 * (docs/ART-AND-SHOP.md §1). The ring turns; the icon does not, so it stays
 * readable all the way in.
 */

import type { Scene } from 'three';
import { LANES, POWERUPS } from '../config';
import { POWERUP_TYPES, type PowerUpType } from '../game/powerups';
import { createPickupMesh, type PickupProp } from './factories';
import { disposeMesh } from './materials';
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
  const props = new Map<PowerUpType, PickupProp>();
  for (const type of POWERUP_TYPES) {
    const prop = createPickupMesh(type);
    prop.group.visible = false;
    scene.add(prop.group);
    props.set(type, prop);
  }

  return {
    update(pickup, playerS, elapsed) {
      for (const [type, prop] of props) {
        const showing = pickup.active && pickup.type === type;
        prop.group.visible = showing;
        if (!showing) continue;

        // Bob gently, so it reads as something to pick up.
        const bob = Math.sin(elapsed * 2.2) * 0.18;
        prop.group.position.set(
          curveX(pickup.s) + pickup.lane * LANES.width,
          curveY(pickup.s) + pickup.y + bob,
          playerS - pickup.s,
        );
        // The ring turns about the axis pointing at the player, like a wheel
        // seen face on; the icon inside it stays put.
        prop.ring.rotation.z = elapsed * POWERUPS.pickupSpinRate * Math.PI * 2;
      }
    },

    dispose() {
      for (const prop of props.values()) {
        scene.remove(prop.group);
        disposeMesh(prop.group);
      }
      props.clear();
    },
  };
}
