/**
 * The shop's rules (docs/ART-AND-SHOP.md section 3).
 *
 * The catalog of everything for sale, what the player owns, and the three
 * things they can do about it: look at the price, buy, and put it on. Pure
 * logic with no Three.js and no DOM, so every rule below is unit-tested.
 *
 * Three things must be impossible, whatever the screen above does:
 *  - buying the same item twice,
 *  - spending coins you do not have (the balance can never go below zero),
 *  - wearing something you do not own.
 *
 * Nothing here touches the run. What is bought is only ever a picture
 * (CLAUDE.md rule 13), so this module knows nothing about lanes, speed or
 * hitboxes — and the ids are plain strings, so it needs nothing from the
 * render layer either. That they match the sprites the game can actually draw
 * is checked by a test rather than by an import.
 */

import { SAVE, SHOP } from '../config';

/** The two things a rider is made of, and so the shop's two tabs. */
export const ITEM_KINDS = ['animal', 'ring'] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

/** One line of the catalog. */
export interface ShopItem {
  /** The id the sprites and the save use, e.g. `bear` or `toilet`. */
  readonly id: string;
  readonly kind: ItemKind;
  /** What it costs in coins. Zero for a starter, which is never for sale. */
  readonly price: number;
  /** True for the free item of its kind, which is owned from the first run. */
  readonly starter: boolean;
}

/** The free starter of each kind (section 2): always owned, never for sale. */
export const STARTERS: Readonly<Record<ItemKind, string>> = {
  animal: SAVE.starterAnimal,
  ring: SAVE.starterRing,
};

const PRICES: Readonly<Record<ItemKind, Readonly<Record<string, number>>>> = {
  animal: SHOP.animalPrices,
  ring: SHOP.ringPrices,
};

function buildCatalog(kind: ItemKind): readonly ShopItem[] {
  // Object.entries keeps the order the prices are written in in src/config.ts,
  // which is the order the shop shows them in: cheapest first.
  return Object.entries(PRICES[kind]).map(([id, price]) => ({
    id,
    kind,
    price,
    starter: id === STARTERS[kind],
  }));
}

const BY_KIND: Readonly<Record<ItemKind, readonly ShopItem[]>> = {
  animal: buildCatalog('animal'),
  ring: buildCatalog('ring'),
};

/** Everything in the shop, animals then rings, each cheapest first. */
export const CATALOG: readonly ShopItem[] = [...BY_KIND.animal, ...BY_KIND.ring];

/** One tab's worth of the catalog, in the order it is shown. */
export function itemsOfKind(kind: ItemKind): readonly ShopItem[] {
  return BY_KIND[kind];
}

/** The catalog line for an id, or null for an id the shop does not sell. */
export function findItem(kind: ItemKind, id: string): ShopItem | null {
  return BY_KIND[kind].find((item) => item.id === id) ?? null;
}

/** True if this is an id of this kind that this build knows. */
export function isKnownItem(kind: ItemKind, id: unknown): id is string {
  return typeof id === 'string' && findItem(kind, id) !== null;
}

/** What one item costs, or null if the shop does not sell it. */
export function priceOf(kind: ItemKind, id: string): number | null {
  return findItem(kind, id)?.price ?? null;
}

/**
 * What the shop needs to know about the player: the coins they have, what
 * they own, and what they are wearing. Held as plain data and never changed
 * in place — `buy` and `equip` hand back a new one — so a refused purchase
 * cannot leave half a change behind.
 */
export interface ShopState {
  readonly coins: number;
  readonly owned: Readonly<Record<ItemKind, readonly string[]>>;
  readonly equipped: Readonly<Record<ItemKind, string>>;
}

/**
 * Tidies a list of owned ids: ids this build does not sell are dropped (a
 * broken save, or one written by hand), each id appears once, the free
 * starter is always there, and the order is the catalog's.
 */
export function ownedList(kind: ItemKind, ids: unknown): string[] {
  const wanted = new Set<string>([STARTERS[kind]]);
  if (Array.isArray(ids)) {
    for (const id of ids as unknown[]) {
      if (isKnownItem(kind, id)) wanted.add(id);
    }
  }
  return BY_KIND[kind].filter((item) => wanted.has(item.id)).map((item) => item.id);
}

/** A whole number of coins, never negative: anything else is nonsense. */
function coinsOf(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}

/**
 * Builds a state, tidying everything on the way in: the owned lists as above,
 * and an equipped id that must be one of them — if what was worn is missing,
 * the free starter goes on instead, so the player is never left wearing
 * something they do not own.
 */
export function createShopState(input: {
  coins?: unknown;
  owned?: Partial<Record<ItemKind, unknown>>;
  equipped?: Partial<Record<ItemKind, unknown>>;
}): ShopState {
  const owned = {
    animal: ownedList('animal', input.owned?.animal),
    ring: ownedList('ring', input.owned?.ring),
  };
  const wearing = (kind: ItemKind): string => {
    const id = input.equipped?.[kind];
    return typeof id === 'string' && owned[kind].includes(id) ? id : STARTERS[kind];
  };
  return {
    coins: coinsOf(input.coins),
    owned,
    equipped: { animal: wearing('animal'), ring: wearing('ring') },
  };
}

export function isOwned(state: ShopState, kind: ItemKind, id: string): boolean {
  return state.owned[kind].includes(id);
}

export function isEquipped(state: ShopState, kind: ItemKind, id: string): boolean {
  return state.equipped[kind] === id;
}

/** Why a purchase cannot happen. */
export type BuyRefusal =
  /** Not something this shop sells. */
  | 'unknown'
  /** Already bought; nothing is ever bought twice. */
  | 'owned'
  /** The price is more than the coins in hand. */
  | 'notEnoughCoins';

/** Why buying this item now is refused, or null if it can be bought. */
export function buyRefusal(state: ShopState, kind: ItemKind, id: string): BuyRefusal | null {
  const item = findItem(kind, id);
  if (item === null) return 'unknown';
  if (isOwned(state, kind, id)) return 'owned';
  if (item.price > state.coins) return 'notEnoughCoins';
  return null;
}

export function canBuy(state: ShopState, kind: ItemKind, id: string): boolean {
  return buyRefusal(state, kind, id) === null;
}

/** How many more coins are needed, or 0 if there is nothing to wait for. */
export function coinsMissing(state: ShopState, kind: ItemKind, id: string): number {
  if (buyRefusal(state, kind, id) !== 'notEnoughCoins') return 0;
  return (findItem(kind, id)?.price ?? 0) - state.coins;
}

/**
 * Buys one item: the price comes off the coins and the id goes into the owned
 * list. A purchase that is not allowed changes nothing at all and hands back
 * the very state it was given, so the caller can simply compare the two.
 */
export function buy(state: ShopState, kind: ItemKind, id: string): ShopState {
  if (!canBuy(state, kind, id)) return state;
  const price = findItem(kind, id)?.price ?? 0;
  return {
    coins: state.coins - price,
    owned: { ...state.owned, [kind]: ownedList(kind, [...state.owned[kind], id]) },
    equipped: state.equipped,
  };
}

/** Only something owned can go on. */
export function canEquip(state: ShopState, kind: ItemKind, id: string): boolean {
  return findItem(kind, id) !== null && isOwned(state, kind, id);
}

/** Puts an owned item on. Anything else leaves the state alone. */
export function equip(state: ShopState, kind: ItemKind, id: string): ShopState {
  if (!canEquip(state, kind, id)) return state;
  return { ...state, equipped: { ...state.equipped, [kind]: id } };
}

/** Everything a shop card has to say about an item. */
export type ItemStatus =
  /** On the rider right now. */
  | 'equipped'
  /** Bought, but not on. */
  | 'owned'
  /** For sale, and affordable. */
  | 'affordable'
  /** For sale, but not yet. */
  | 'tooDear'
  /** Not something this shop sells. */
  | 'unknown';

export function itemStatus(state: ShopState, kind: ItemKind, id: string): ItemStatus {
  const item = findItem(kind, id);
  if (item === null) return 'unknown';
  if (isEquipped(state, kind, id)) return 'equipped';
  if (isOwned(state, kind, id)) return 'owned';
  return state.coins >= item.price ? 'affordable' : 'tooDear';
}

/** The other half of the rider, for a preview: a ring for an animal, and back. */
export function otherKind(kind: ItemKind): ItemKind {
  return kind === 'animal' ? 'ring' : 'animal';
}

/** The next thing worth playing for, as the game over screen tells it. */
export interface NextGoal {
  item: ShopItem;
  /** Coins still to collect for it; 0 when it can be bought right now. */
  missing: number;
}

/**
 * The cheapest item the player does not own yet, and how far off it is.
 *
 * This is what keeps a player in the loop of "one more run": the end of every
 * run says how close the next thing is, while the Shop button sits right
 * underneath. The cheapest unowned item is always the nearest goal — and when
 * it is already affordable, so is something, which is worth saying too.
 *
 * Two items at the same price: the one the shop lists first (animals before
 * rings), so the answer never flickers between them from run to run.
 *
 * @returns null once everything has been bought
 */
export function nextGoal(state: ShopState): NextGoal | null {
  let goal: ShopItem | null = null;
  for (const item of CATALOG) {
    if (isOwned(state, item.kind, item.id)) continue;
    if (goal === null || item.price < goal.price) goal = item;
  }
  if (goal === null) return null;
  return { item: goal, missing: Math.max(0, goal.price - state.coins) };
}
