/**
 * The shop screen, and the bits of the title screen that belong to it
 * (docs/ART-AND-SHOP.md §3).
 *
 * Two tabs, a grid of cards, and under the tabs a big picture of whatever was
 * tapped last — the item together with the other half of the rider already
 * equipped, so a bear in a toilet seat can be looked at before it is paid
 * for. The button under it says the one thing that can be done next: buy it,
 * wear it, or how many coins are still missing.
 *
 * It decides nothing: which cards exist, what they cost and whether a
 * purchase is allowed all come from src/game/shop.ts, and every change is
 * handed back out through the handlers so src/main.ts can save it. The
 * pictures come from the one rider painter the debug gallery uses, so a card
 * shows exactly what the game will draw (CLAUDE.md rules 4 and 13).
 */

import { SHOP } from '../config';
import {
  itemsOfKind,
  itemStatus,
  ITEM_KINDS,
  coinsMissing,
  priceOf,
  type ItemKind,
  type ShopState,
} from '../game/shop';
import {
  createRiderPainter,
  type PreviewOptions,
  type RiderPainter,
} from '../render/rider-preview';
import { resolveRider } from '../render/sprites';
import { coinIconDataUrl } from '../render/textures';
import { fill, itemName, STRINGS } from './strings';

export interface ShopHandlers {
  /**
   * The player has confirmed a purchase. True if it went through, which is
   * when the coins burst out; the sound and the saving are the caller's.
   */
  onBuy(kind: ItemKind, id: string): boolean;
  /** The player wants to wear something they own. */
  onEquip(kind: ItemKind, id: string): void;
  /** Back, from the button, the keyboard or the phone's own back gesture. */
  onBack(): void;
  /** Every button, so a tap can be heard (SPEC 12). */
  onTap(): void;
}

export interface ShopScreen {
  /** The coins, the owned lists and the equipped pair, after any change. */
  setState(state: ShopState): void;
  /** Called when the shop opens, so it starts on what is being worn. */
  open(): void;
  /** Called every frame: the idle bob and the ring turning over. */
  tick(seconds: number): void;
}

function byId<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function setText(id: string, text: string): void {
  const element = byId(id);
  if (element !== null) element.textContent = text;
}

function formatNumber(value: number): string {
  return Math.max(0, Math.floor(value)).toLocaleString('en-US');
}

/** One card in the grid. */
interface Card {
  kind: ItemKind;
  id: string;
  root: HTMLButtonElement;
  price: HTMLElement;
  ctx: CanvasRenderingContext2D | null;
}

export function createShopScreen(handlers: ShopHandlers): ShopScreen {
  const painter: RiderPainter = createRiderPainter();
  const coinIcon = coinIconDataUrl();

  // Every coin in the overlay is the same pixel map, painted once and handed
  // to the stylesheet as a custom property (rule 8): the balances, the prices
  // and the coins of a purchase all read it from there.
  document.documentElement.style.setProperty('--coin-url', `url(${coinIcon})`);

  // --- Fixed text ------------------------------------------------------------
  setText('start-shop', STRINGS.shop.open);
  setText('over-shop', STRINGS.shop.open);
  setText('over-total-label', STRINGS.total);
  setText('shop-title', STRINGS.shop.title);
  setText('shop-back', STRINGS.shop.back);
  setText('shop-confirm-yes', STRINGS.shop.confirmYes);
  setText('shop-confirm-no', STRINGS.shop.confirmNo);

  // --- What the screen is showing -------------------------------------------
  let state: ShopState = {
    coins: 0,
    owned: { animal: [], ring: [] },
    equipped: { animal: '', ring: '' },
  };
  let tab: ItemKind = 'animal';
  /** The card tapped last in each tab. Starts on whatever is being worn. */
  const selected: Record<ItemKind, string> = { animal: '', ring: '' };
  /** True while the quick confirm is up, so one tap cannot spend by accident. */
  let confirming = false;

  // --- Tabs -----------------------------------------------------------------
  const tabBar = byId('shop-tabs');
  const tabButtons: Array<{ kind: ItemKind; button: HTMLButtonElement }> = [];
  for (const kind of ITEM_KINDS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'shop-tab';
    button.textContent = STRINGS.shop.tabs[kind];
    button.addEventListener('click', () => {
      handlers.onTap();
      tab = kind;
      confirming = false;
      refresh();
    });
    tabButtons.push({ kind, button });
    tabBar?.appendChild(button);
  }

  // --- The grid of cards, built once from the catalog ------------------------
  const grid = byId('shop-grid');
  const cards: Card[] = [];
  for (const kind of ITEM_KINDS) {
    for (const item of itemsOfKind(kind)) {
      const root = document.createElement('button');
      root.type = 'button';
      root.className = 'shop-card';

      const canvas = document.createElement('canvas');
      canvas.className = 'rider-canvas';
      const ctx = painter.prepare(canvas, SHOP.cardZoom);

      const name = document.createElement('span');
      name.className = 'shop-card-name';
      name.textContent = itemName(kind, item.id);

      const price = document.createElement('span');
      price.className = 'shop-card-price';

      root.append(canvas, name, price);
      root.addEventListener('click', () => {
        handlers.onTap();
        selected[kind] = item.id;
        confirming = false;
        refresh();
      });
      grid?.appendChild(root);
      cards.push({ kind, id: item.id, root, price, ctx });
    }
  }

  // --- The big preview and its button ---------------------------------------
  const preview = byId<HTMLCanvasElement>('shop-preview');
  const previewCtx = preview === null ? null : painter.prepare(preview, SHOP.previewZoom);
  const titleRider = byId<HTMLCanvasElement>('start-rider');
  const titleCtx = titleRider === null ? null : painter.prepare(titleRider, SHOP.titleZoom);

  const action = byId<HTMLButtonElement>('shop-action');
  const confirm = byId('shop-confirm');
  const burst = byId('shop-burst');

  action?.addEventListener('click', () => {
    handlers.onTap();
    const kind = tab;
    const id = selected[kind];
    const status = itemStatus(state, kind, id);
    if (status === 'owned') {
      handlers.onEquip(kind, id);
      return;
    }
    // Buying asks first (§3); anything else is not a thing that can be done.
    if (status === 'affordable') {
      confirming = true;
      refresh();
    }
  });

  byId('shop-confirm-no')?.addEventListener('click', () => {
    handlers.onTap();
    confirming = false;
    refresh();
  });

  byId('shop-confirm-yes')?.addEventListener('click', () => {
    handlers.onTap();
    confirming = false;
    const kind = tab;
    const id = selected[kind];
    if (handlers.onBuy(kind, id)) playBurst();
    // The state comes back through setState, which refreshes everything.
  });

  byId('shop-back')?.addEventListener('click', () => {
    handlers.onTap();
    handlers.onBack();
  });

  /** A handful of pixel coins flying out of the preview (§3). */
  function playBurst(): void {
    if (burst === null) return;
    for (let i = 0; i < SHOP.burstCoins; i += 1) {
      const coin = document.createElement('i');
      coin.className = 'coin-icon burst-coin';
      // Spread evenly either way, so the burst looks like a fountain.
      const spread = (i / Math.max(1, SHOP.burstCoins - 1) - 0.5) * 2;
      coin.style.setProperty('--dx', `${Math.round(spread * SHOP.burstSpread)}px`);
      coin.style.setProperty(
        '--dy',
        `${-SHOP.burstRise - Math.round((1 - spread * spread) * 20)}px`,
      );
      coin.style.setProperty('--spin', `${Math.round(spread * 180)}deg`);
      coin.style.animationDuration = `${SHOP.burstSeconds}s`;
      coin.addEventListener('animationend', () => coin.remove());
      burst.appendChild(coin);
    }
  }

  // --- Drawing --------------------------------------------------------------
  /** The pair to show for one item: it, plus the other half already worn. */
  const pairFor = (kind: ItemKind, id: string) =>
    kind === 'animal'
      ? resolveRider(id, state.equipped.ring)
      : resolveRider(state.equipped.animal, id);

  let clock = 0;
  let drawnKey = '';

  function drawCards(): void {
    for (const card of cards) {
      if (card.ctx === null) continue;
      painter.draw(card.ctx, pairFor(card.kind, card.id), {
        // Cards hold still: only the big preview and the title rider move.
        clock: 0,
        background: 'sky',
        // One half of the rider on its own, so each card reads as one thing.
        layers: card.kind,
      });
    }
  }

  function drawAnimated(force: boolean): void {
    const options: PreviewOptions = { clock, background: 'none' };
    const key = painter.frameKey(options);
    if (!force && key === drawnKey) return;
    drawnKey = key;
    if (titleCtx !== null) {
      painter.draw(titleCtx, resolveRider(state.equipped.animal, state.equipped.ring), options);
    }
    if (previewCtx !== null) {
      painter.draw(previewCtx, pairFor(tab, selected[tab]), { ...options, background: 'sky' });
    }
  }

  /** Everything the screen says, from the state and what is selected. */
  function refresh(): void {
    const coins = formatNumber(state.coins);
    for (const id of ['start-coins', 'shop-coins']) {
      const span = byId(id)?.querySelector('span');
      if (span !== null && span !== undefined) span.textContent = coins;
    }

    for (const { kind, button } of tabButtons) button.classList.toggle('on', kind === tab);

    for (const card of cards) {
      const status = itemStatus(state, card.kind, card.id);
      card.root.hidden = card.kind !== tab;
      card.root.classList.toggle('on', card.kind === tab && card.id === selected[card.kind]);
      card.root.classList.toggle('owned', status === 'owned' || status === 'equipped');
      card.root.classList.toggle('equipped', status === 'equipped');
      card.root.classList.toggle('too-dear', status === 'tooDear');
      const price = priceOf(card.kind, card.id) ?? 0;
      if (status === 'equipped') {
        card.price.textContent = STRINGS.shop.equipped;
        card.price.classList.remove('with-coin');
      } else if (status === 'owned') {
        card.price.textContent = STRINGS.shop.owned;
        card.price.classList.remove('with-coin');
      } else {
        card.price.textContent = formatNumber(price);
        card.price.classList.add('with-coin');
      }
    }

    const kind = tab;
    const id = selected[kind];
    const status = itemStatus(state, kind, id);
    setText('shop-name', itemName(kind, id));
    const price = priceOf(kind, id) ?? 0;
    setText(
      'shop-price',
      status === 'equipped'
        ? STRINGS.shop.equipped
        : status === 'owned'
          ? STRINGS.shop.owned
          : price === 0
            ? STRINGS.shop.free
            : formatNumber(price),
    );
    byId('shop-price')?.classList.toggle(
      'with-coin',
      status !== 'equipped' && status !== 'owned' && price > 0,
    );

    if (action !== null) {
      action.hidden = confirming;
      action.disabled = status === 'tooDear' || status === 'equipped';
      action.classList.toggle('ghost', status !== 'affordable' && status !== 'owned');
      action.classList.toggle('primary', status === 'affordable' || status === 'owned');
      action.textContent =
        status === 'equipped'
          ? STRINGS.shop.wearing
          : status === 'owned'
            ? STRINGS.shop.equip
            : status === 'affordable'
              ? STRINGS.shop.buy
              : fill(STRINGS.shop.notEnough, {
                  coins: formatNumber(coinsMissing(state, kind, id)),
                });
    }

    if (confirm !== null) confirm.hidden = !confirming;
    if (confirming) {
      setText(
        'shop-confirm-text',
        fill(STRINGS.shop.confirm, { name: itemName(kind, id), coins: formatNumber(price) }),
      );
    }

    drawCards();
    drawAnimated(true);
  }

  return {
    setState(next) {
      state = next;
      for (const kind of ITEM_KINDS) {
        // A card that is no longer a thing — or nothing tapped yet — falls
        // back to what is being worn, which is always owned.
        if (itemStatus(state, kind, selected[kind]) === 'unknown') {
          selected[kind] = state.equipped[kind];
        }
      }
      refresh();
    },

    open() {
      // Opens on the rider as it stands, on the animals tab (§3).
      tab = 'animal';
      confirming = false;
      for (const kind of ITEM_KINDS) selected[kind] = state.equipped[kind];
      refresh();
    },

    tick(seconds) {
      clock += seconds;
      drawAnimated(false);
    },
  };
}
