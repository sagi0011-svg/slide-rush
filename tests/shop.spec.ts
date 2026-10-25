import { describe, expect, it } from 'vitest';
import { SAVE, SHOP } from '../src/config';
import {
  buy,
  buyRefusal,
  canBuy,
  canEquip,
  CATALOG,
  coinsMissing,
  createShopState,
  equip,
  findItem,
  isEquipped,
  isKnownItem,
  isOwned,
  itemsOfKind,
  itemStatus,
  ITEM_KINDS,
  otherKind,
  ownedList,
  priceOf,
  STARTERS,
  type ItemKind,
  type ShopState,
} from '../src/game/shop';
import { ANIMAL_IDS, RING_IDS } from '../src/render/sprites';
import { fill, STRINGS } from '../src/ui/strings';

/**
 * The shop (docs/ART-AND-SHOP.md section 3).
 *
 * Three things must be impossible however the screens behave: buying the same
 * thing twice, going below zero coins, and wearing something unbought. Most
 * of what follows is about those three.
 */

/** A player with this many coins, owning only the free starters. */
function freshPlayer(coins: number): ShopState {
  return createShopState({ coins });
}

describe('the catalog', () => {
  it('matches the prices in the spec, in src/config.ts (section 3)', () => {
    expect(SHOP.animalPrices).toEqual({
      frog: 0,
      penguin: 500,
      duck: 800,
      cat: 1200,
      pig: 1800,
      bear: 2500,
    });
    expect(SHOP.ringPrices).toEqual({
      tube: 0,
      hoop: 300,
      donut: 500,
      pineapple: 600,
      watermelon: 800,
      onion: 1000,
      pizza: 1500,
      record: 2000,
      wheel: 2500,
      tractor: 3500,
      toilet: 5000,
    });
  });

  it('sells exactly the animals and rings the game can draw', () => {
    // The guard that stops a typo shipping a card for a rider that does not
    // exist: the ids here and the sprites in src/render/sprites/ are one set.
    expect(
      itemsOfKind('animal')
        .map((item) => item.id)
        .sort(),
    ).toEqual([...ANIMAL_IDS].sort());
    expect(
      itemsOfKind('ring')
        .map((item) => item.id)
        .sort(),
    ).toEqual([...RING_IDS].sort());
    expect(CATALOG).toHaveLength(ANIMAL_IDS.length + RING_IDS.length);
  });

  it('agrees with the save about which pair is free', () => {
    expect(STARTERS.animal).toBe(SAVE.starterAnimal);
    expect(STARTERS.ring).toBe(SAVE.starterRing);
  });

  it('gives exactly one free starter of each kind, and charges for the rest', () => {
    for (const kind of ITEM_KINDS) {
      const starters = itemsOfKind(kind).filter((item) => item.starter);
      expect(
        starters.map((item) => item.id),
        kind,
      ).toEqual([STARTERS[kind]]);
      for (const item of itemsOfKind(kind)) {
        // Free exactly when it is the starter, and a whole number of coins.
        expect(item.price === 0, `${item.id} price/starter`).toBe(item.starter);
        expect(Number.isInteger(item.price), item.id).toBe(true);
        expect(item.kind).toBe(kind);
      }
    }
  });

  it('lays each tab out cheapest first, so the next thing to save for is near', () => {
    for (const kind of ITEM_KINDS) {
      const prices = itemsOfKind(kind).map((item) => item.price);
      expect(prices, kind).toEqual([...prices].sort((a, b) => a - b));
    }
  });

  it('looks an item up by kind and id, and says no to anything else', () => {
    expect(findItem('animal', 'bear')?.price).toBe(2500);
    expect(priceOf('ring', 'toilet')).toBe(5000);
    expect(findItem('animal', 'toilet')).toBeNull();
    expect(findItem('ring', 'bear')).toBeNull();
    expect(priceOf('animal', 'dragon')).toBeNull();
    expect(isKnownItem('ring', 'donut')).toBe(true);
    expect(isKnownItem('ring', 'dragon')).toBe(false);
    expect(isKnownItem('ring', 42)).toBe(false);
  });

  it('knows which half of the rider is the other one', () => {
    expect(otherKind('animal')).toBe('ring');
    expect(otherKind('ring')).toBe('animal');
  });
});

describe('the owned list', () => {
  it('always holds the free starter', () => {
    for (const kind of ITEM_KINDS) {
      expect(ownedList(kind, [])).toEqual([STARTERS[kind]]);
      expect(ownedList(kind, null)).toEqual([STARTERS[kind]]);
      expect(ownedList(kind, 'nonsense')).toEqual([STARTERS[kind]]);
    }
  });

  it('drops ids the shop does not sell', () => {
    expect(ownedList('animal', ['bear', 'dragon', 'toilet'])).toEqual(['frog', 'bear']);
  });

  it('holds each id once, in catalog order', () => {
    expect(ownedList('ring', ['toilet', 'hoop', 'toilet', 'tube'])).toEqual([
      'tube',
      'hoop',
      'toilet',
    ]);
  });
});

describe('a fresh player', () => {
  it('owns the free pair, wears it, and has no coins', () => {
    const state = createShopState({});
    expect(state.coins).toBe(0);
    expect(state.owned).toEqual({ animal: ['frog'], ring: ['tube'] });
    expect(state.equipped).toEqual({ animal: 'frog', ring: 'tube' });
  });

  it('refuses nonsense coins rather than carrying them', () => {
    for (const coins of [-100, Number.NaN, Number.POSITIVE_INFINITY, 'lots', null, undefined]) {
      expect(createShopState({ coins }).coins, String(coins)).toBe(0);
    }
    expect(createShopState({ coins: 10.9 }).coins).toBe(10);
  });

  it('wears the starter rather than something it does not own', () => {
    const state = createShopState({ equipped: { animal: 'bear', ring: 'toilet' } });
    expect(state.equipped).toEqual({ animal: 'frog', ring: 'tube' });
  });

  it('wears what it owns', () => {
    const state = createShopState({
      owned: { animal: ['bear'], ring: ['toilet'] },
      equipped: { animal: 'bear', ring: 'toilet' },
    });
    expect(state.equipped).toEqual({ animal: 'bear', ring: 'toilet' });
  });
});

describe('buying', () => {
  it('takes the price off the coins and adds the item', () => {
    const before = freshPlayer(1000);
    const after = buy(before, 'ring', 'donut');
    expect(after.coins).toBe(500);
    expect(isOwned(after, 'ring', 'donut')).toBe(true);
    // The one it was wearing is still on: buying is not wearing.
    expect(after.equipped.ring).toBe('tube');
    // And the state it was given was not touched.
    expect(before.coins).toBe(1000);
    expect(isOwned(before, 'ring', 'donut')).toBe(false);
  });

  it('allows a purchase that spends the very last coin', () => {
    const after = buy(freshPlayer(300), 'ring', 'hoop');
    expect(after.coins).toBe(0);
    expect(isOwned(after, 'ring', 'hoop')).toBe(true);
  });

  it('refuses a purchase one coin short, and says how many are missing', () => {
    const state = freshPlayer(299);
    expect(canBuy(state, 'ring', 'hoop')).toBe(false);
    expect(buyRefusal(state, 'ring', 'hoop')).toBe('notEnoughCoins');
    expect(coinsMissing(state, 'ring', 'hoop')).toBe(1);
    expect(buy(state, 'ring', 'hoop')).toBe(state);
  });

  it('never lets the coins go below zero, whatever is asked for', () => {
    let state = freshPlayer(5000);
    // Try to buy the lot, over and over, in the most expensive order.
    for (let round = 0; round < 3; round += 1) {
      for (const item of [...CATALOG].reverse()) {
        state = buy(state, item.kind, item.id);
        expect(state.coins, item.id).toBeGreaterThanOrEqual(0);
      }
    }
    // What it owns is worth no more than what it started with.
    const spent = CATALOG.filter((item) => isOwned(state, item.kind, item.id)).reduce(
      (total, item) => total + item.price,
      0,
    );
    expect(spent).toBe(5000 - state.coins);
  });

  it('cannot buy the same thing twice', () => {
    const bought = buy(freshPlayer(2000), 'ring', 'donut');
    expect(buyRefusal(bought, 'ring', 'donut')).toBe('owned');
    expect(coinsMissing(bought, 'ring', 'donut')).toBe(0);
    const again = buy(bought, 'ring', 'donut');
    // Not charged twice, and not listed twice.
    expect(again).toBe(bought);
    expect(again.coins).toBe(1500);
    expect(again.owned.ring.filter((id) => id === 'donut')).toHaveLength(1);
  });

  it('cannot buy a free starter, because it is already owned', () => {
    for (const kind of ITEM_KINDS) {
      const state = freshPlayer(100);
      expect(buyRefusal(state, kind, STARTERS[kind]), kind).toBe('owned');
      expect(buy(state, kind, STARTERS[kind]), kind).toBe(state);
    }
  });

  it('cannot buy something the shop does not sell', () => {
    const state = freshPlayer(9999);
    for (const [kind, id] of [
      ['animal', 'dragon'],
      ['animal', 'toilet'],
      ['ring', 'bear'],
      ['ring', ''],
    ] as Array<[ItemKind, string]>) {
      expect(buyRefusal(state, kind, id), `${kind}/${id}`).toBe('unknown');
      expect(buy(state, kind, id), `${kind}/${id}`).toBe(state);
      expect(coinsMissing(state, kind, id)).toBe(0);
    }
  });

  it('buys the cheapest ring after about three good runs', () => {
    // The spec asks for a first purchase after roughly three normal runs
    // (section 3). A normal run picks up something like 100-150 coins.
    const afterThreeRuns = freshPlayer(3 * 120);
    expect(canBuy(afterThreeRuns, 'ring', 'hoop')).toBe(true);
    expect(canBuy(afterThreeRuns, 'animal', 'penguin')).toBe(false);
  });

  it('keeps the shop honest about everything at once', () => {
    const state = freshPlayer(1000);
    for (const item of CATALOG) {
      const refusal = buyRefusal(state, item.kind, item.id);
      if (item.starter) expect(refusal, item.id).toBe('owned');
      else if (item.price <= 1000) expect(refusal, item.id).toBeNull();
      else expect(refusal, item.id).toBe('notEnoughCoins');
    }
  });
});

describe('equipping', () => {
  it('puts on something owned', () => {
    const bought = buy(freshPlayer(600), 'ring', 'donut');
    const worn = equip(bought, 'ring', 'donut');
    expect(worn.equipped.ring).toBe('donut');
    expect(isEquipped(worn, 'ring', 'donut')).toBe(true);
    // Coins and the owned list are untouched by wearing something.
    expect(worn.coins).toBe(bought.coins);
    expect(worn.owned).toEqual(bought.owned);
  });

  it('refuses to put on something that is not owned', () => {
    const state = freshPlayer(9999);
    expect(canEquip(state, 'animal', 'bear')).toBe(false);
    expect(equip(state, 'animal', 'bear')).toBe(state);
    expect(state.equipped.animal).toBe('frog');
  });

  it('refuses an id the shop does not sell, even with coins to spare', () => {
    const state = freshPlayer(9999);
    expect(canEquip(state, 'ring', 'ufo')).toBe(false);
    expect(equip(state, 'ring', 'ufo')).toBe(state);
  });

  it('can always go back to the free starter', () => {
    let state = buy(freshPlayer(3000), 'animal', 'bear');
    state = equip(state, 'animal', 'bear');
    expect(state.equipped.animal).toBe('bear');
    state = equip(state, 'animal', 'frog');
    expect(state.equipped.animal).toBe('frog');
  });

  it('changes one half of the rider without touching the other', () => {
    let state = buy(freshPlayer(9999), 'animal', 'pig');
    state = buy(state, 'ring', 'toilet');
    state = equip(state, 'animal', 'pig');
    expect(state.equipped).toEqual({ animal: 'pig', ring: 'tube' });
    state = equip(state, 'ring', 'toilet');
    expect(state.equipped).toEqual({ animal: 'pig', ring: 'toilet' });
  });
});

describe('what a card says', () => {
  it('reads equipped, owned, affordable or too dear', () => {
    let state = freshPlayer(600);
    expect(itemStatus(state, 'animal', 'frog')).toBe('equipped');
    expect(itemStatus(state, 'ring', 'donut')).toBe('affordable');
    expect(itemStatus(state, 'ring', 'toilet')).toBe('tooDear');

    state = buy(state, 'ring', 'donut');
    expect(itemStatus(state, 'ring', 'donut')).toBe('owned');
    // And spending the coins moves the rest out of reach.
    expect(itemStatus(state, 'ring', 'hoop')).toBe('tooDear');

    state = equip(state, 'ring', 'donut');
    expect(itemStatus(state, 'ring', 'donut')).toBe('equipped');
  });

  it('says it knows nothing about anything else', () => {
    expect(itemStatus(freshPlayer(0), 'animal', 'dragon')).toBe('unknown');
  });

  it('calls something affordable exactly when it can be bought', () => {
    for (const coins of [0, 299, 300, 1999, 2000, 5000]) {
      const state = freshPlayer(coins);
      for (const item of CATALOG) {
        const status = itemStatus(state, item.kind, item.id);
        expect(status === 'affordable', `${item.id} at ${coins}`).toBe(
          canBuy(state, item.kind, item.id),
        );
      }
    }
  });
});

describe('what the shop can say (rule 9)', () => {
  it('has a name for every card, so none of them shows a bare id', () => {
    const names: Readonly<Record<ItemKind, Readonly<Record<string, string>>>> = {
      animal: STRINGS.animals,
      ring: STRINGS.rings,
    };
    for (const item of CATALOG) {
      const name = names[item.kind][item.id];
      expect(name, `${item.kind}/${item.id}`).toBeTruthy();
      expect(name, `${item.kind}/${item.id}`).not.toBe(item.id);
    }
  });

  it('puts the numbers into the strings that have slots for them', () => {
    expect(fill(STRINGS.shop.notEnough, { coins: 250 })).toBe('Need 250 more');
    expect(fill(STRINGS.shop.confirm, { name: 'Bear', coins: '2,500' })).toBe(
      'Buy Bear for 2,500?',
    );
    // A slot nothing was given for is left as it is, rather than saying undefined.
    expect(fill('a {b} c', {})).toBe('a {b} c');
  });

  it('names both tabs', () => {
    for (const kind of ITEM_KINDS) expect(STRINGS.shop.tabs[kind], kind).toBeTruthy();
  });
});
