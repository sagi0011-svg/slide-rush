/**
 * The riders' sprites (docs/ART-AND-SHOP.md §2): six animals, eleven rings,
 * three effects, all pixel maps in code, plus the atlas they are packed into.
 *
 * Which animal and ring to draw arrives from outside, as plain ids from the
 * save; nothing here reads the save itself, so the shop (M11) can hand in any
 * pair it likes — a preview of an item not yet bought, say.
 */

import { ANIMAL_IDS, STARTER_ANIMAL, type AnimalId } from './animals';
import { RING_IDS, STARTER_RING, type RingId } from './rings';

export * from './animals';
export * from './rings';
export * from './effects';
export * from './atlas';
export * from './legend';

/** One rider: an animal in a ring. */
export interface RiderPair {
  animal: AnimalId;
  ring: RingId;
}

function isAnimalId(id: unknown): id is AnimalId {
  return typeof id === 'string' && (ANIMAL_IDS as readonly string[]).includes(id);
}

function isRingId(id: unknown): id is RingId {
  return typeof id === 'string' && (RING_IDS as readonly string[]).includes(id);
}

/**
 * The pair to draw for whatever ids a save holds. An id this build does not
 * know — a broken save, or one from a newer version — falls back to the free
 * starter rather than leaving the player invisible.
 */
export function resolveRider(animal: unknown, ring: unknown): RiderPair {
  return {
    animal: isAnimalId(animal) ? animal : STARTER_ANIMAL,
    ring: isRingId(ring) ? ring : STARTER_RING,
  };
}
