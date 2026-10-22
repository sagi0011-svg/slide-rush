/**
 * Every visual is built here (CLAUDE.md rule 8).
 *
 * Placeholder primitives with flat colours from the palette in src/config.ts.
 * Real models can replace the bodies of these functions later without any
 * change to game logic.
 */

import {
  BoxGeometry,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  AmbientLight,
  DirectionalLight,
} from 'three';
import { PALETTE } from '../config';

/** The M0 proof-of-life cube. Replaced by the player capsule in M1. */
export function createPlaceholderCube(): Mesh<BoxGeometry, MeshStandardMaterial> {
  const geometry = new BoxGeometry(1.4, 1.4, 1.4);
  const material = new MeshStandardMaterial({
    color: PALETTE.player,
    roughness: 0.45,
    metalness: 0.1,
  });
  return new Mesh(geometry, material);
}

/** Simple two-light rig: no shadows, cheap on mobile (SPEC 13). */
export function createLights(): Object3D[] {
  const ambient = new AmbientLight(0xffffff, 1.5);
  const sun = new DirectionalLight(0xffffff, 2.2);
  sun.position.set(3, 8, 5);
  return [ambient, sun];
}
