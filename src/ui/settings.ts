/**
 * The Settings screen (docs/VISUAL-STYLES.md §3): the visual style, the sound
 * effects, the music, and the shake and flash of a hit.
 *
 * Like the other screens it only reports what was pressed; main.ts saves the
 * change and acts on it. Every control is a real button: the style cards and
 * the switches say whether they are on with `aria-pressed`, so a screen reader
 * hears "Retro Pixel, pressed" rather than guessing from a colour.
 */

import { THEMES, VISUAL_STYLES, type VisualStyle } from '../config';
import { paintStylePreview } from '../render/style-preview';
import { STRINGS } from './strings';

export interface SettingsValues {
  visualStyle: VisualStyle;
  sfxOff: boolean;
  musicOff: boolean;
  effectsOff: boolean;
}

export interface SettingsHandlers {
  onStyle(style: VisualStyle): void;
  onToggleSfx(): void;
  onToggleMusic(): void;
  onToggleEffects(): void;
  onBack(): void;
  /** Called by every button, so a tap can be heard (SPEC 12). */
  onTap(): void;
}

export interface SettingsScreen {
  /** Puts the saved settings on screen. */
  setValues(values: SettingsValues): void;
}

function byId<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function setText(id: string, text: string): void {
  const element = byId(id);
  if (element !== null) element.textContent = text;
}

export function createSettingsScreen(handlers: SettingsHandlers): SettingsScreen {
  setText('settings-back', STRINGS.settings.back);
  setText('settings-title', STRINGS.settings.title);
  setText('settings-style-heading', STRINGS.settings.styleHeading);
  setText('settings-audio-heading', STRINGS.settings.audioHeading);
  setText('settings-other-heading', STRINGS.settings.otherHeading);
  setText('settings-sfx-label', STRINGS.settings.sfx);
  setText('settings-music-label', STRINGS.settings.music);
  setText('settings-effects-label', STRINGS.settings.effects);

  byId('settings-back')?.addEventListener('click', () => {
    handlers.onTap();
    handlers.onBack();
  });

  // One card per look, each with its picture painted once: a card shows its
  // own look whichever one is on.
  const cards = new Map<VisualStyle, HTMLButtonElement>();
  const holder = byId('settings-styles');
  for (const style of VISUAL_STYLES) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'ghost style-card';
    card.dataset['style'] = style;

    const preview = document.createElement('canvas');
    preview.className = THEMES[style].pixelated ? 'style-preview' : 'style-preview smooth';
    preview.setAttribute('aria-hidden', 'true');
    paintStylePreview(preview, THEMES[style]);

    const name = document.createElement('span');
    name.className = 'style-name';
    name.textContent = STRINGS.settings.styles[style];

    const tag = document.createElement('span');
    tag.className = 'style-tag';
    tag.textContent = STRINGS.settings.selected;
    // The tag repeats what aria-pressed already says.
    tag.setAttribute('aria-hidden', 'true');

    card.append(preview, name, tag);
    card.addEventListener('click', () => {
      handlers.onTap();
      handlers.onStyle(style);
    });
    holder?.append(card);
    cards.set(style, card);
  }

  const switches: ReadonlyArray<[string, () => void]> = [
    ['settings-sfx', () => handlers.onToggleSfx()],
    ['settings-music', () => handlers.onToggleMusic()],
    ['settings-effects', () => handlers.onToggleEffects()],
  ];
  for (const [id, onToggle] of switches) {
    const button = byId(id);
    button?.setAttribute('aria-labelledby', `${id}-label`);
    button?.addEventListener('click', () => {
      onToggle();
      // Heard after the switch, so turning the effects back on says so.
      handlers.onTap();
    });
  }

  const setSwitch = (id: string, on: boolean): void => {
    const button = byId(id);
    if (button === null) return;
    button.setAttribute('aria-pressed', String(on));
    button.textContent = on ? STRINGS.settings.on : STRINGS.settings.off;
  };

  return {
    setValues(values) {
      for (const [style, card] of cards) {
        const selected = style === values.visualStyle;
        card.setAttribute('aria-pressed', String(selected));
        const tag = card.querySelector<HTMLElement>('.style-tag');
        if (tag !== null) tag.hidden = !selected;
      }
      setSwitch('settings-sfx', !values.sfxOff);
      setSwitch('settings-music', !values.musicOff);
      setSwitch('settings-effects', !values.effectsOff);
    },
  };
}
