/**
 * Every visual is built here (CLAUDE.md rule 8).
 *
 * Placeholder primitives with flat colours from the palette in src/config.ts.
 * Real models can replace the bodies of these functions later without any
 * change to game logic.
 */

import {
  AmbientLight,
  BoxGeometry,
  CanvasTexture,
  CapsuleGeometry,
  CircleGeometry,
  CylinderGeometry,
  DirectionalLight,
  DynamicDrawUsage,
  IcosahedronGeometry,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Object3D,
  OctahedronGeometry,
  PlaneGeometry,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
} from 'three';
import { COINS, LANES, OBSTACLES, PALETTE, PLAYER, POWERUPS, TRACK } from '../config';
import type { ObstacleType } from '../game/obstacles';
import type { PowerUpType } from '../game/powerups';

/** How many times the geometry of a track segment is cut across its length. */
export const SEGMENT_DIVISIONS = 12;

/** How long the painted pattern on the slide is before it repeats, in units. */
const PATTERN_LENGTH = 10;

function colorToCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

/**
 * The painted surface of the slide: lane divider lines plus cross stripes that
 * make the speed readable. Drawn once into a texture and repeated along the
 * track, so a whole segment costs a single draw call.
 */
export function createSlideTexture(): CanvasTexture {
  // 64 pixels per unit across the slide, enough to stay crisp on a phone.
  const pixelsPerUnit = 32;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(TRACK.width * pixelsPerUnit);
  canvas.height = Math.round(PATTERN_LENGTH * pixelsPerUnit);

  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('createSlideTexture: no 2D canvas support');

  ctx.fillStyle = colorToCss(PALETTE.slide);
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Cross stripes, lighter, every half pattern: these are what you see rushing by.
  ctx.fillStyle = colorToCss(PALETTE.water);
  ctx.globalAlpha = 0.35;
  const stripeHeight = canvas.height * 0.06;
  ctx.fillRect(0, 0, canvas.width, stripeHeight);
  ctx.fillRect(0, canvas.height * 0.5, canvas.width, stripeHeight);
  ctx.globalAlpha = 1;

  // Lane dividers: lines on the two boundaries between the three lanes.
  ctx.fillStyle = colorToCss(PALETTE.slideEdge);
  const markerPx = TRACK.markerWidth * pixelsPerUnit;
  for (const boundary of [-0.5, 0.5]) {
    const x = canvas.width / 2 + boundary * LANES.width * pixelsPerUnit - markerPx / 2;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(x, 0, markerPx, canvas.height);
  }

  // Solid edges, so the sides of the slide are obvious.
  ctx.globalAlpha = 0.9;
  const edgePx = markerPx * 2.5;
  ctx.fillRect(0, 0, edgePx, canvas.height);
  ctx.fillRect(canvas.width - edgePx, 0, edgePx, canvas.height);
  ctx.globalAlpha = 1;

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(1, TRACK.segmentLength / PATTERN_LENGTH);
  texture.anisotropy = 4;
  return texture;
}

/**
 * One recycled piece of slide, lying flat and cut across its length so the
 * visual bend in curve.ts can be baked into its vertices.
 */
export function createTrackSegment(
  texture: CanvasTexture,
): Mesh<PlaneGeometry, MeshStandardMaterial> {
  const geometry = new PlaneGeometry(
    TRACK.width,
    TRACK.segmentLength,
    1,
    SEGMENT_DIVISIONS,
  ).rotateX(-Math.PI / 2);
  const material = new MeshStandardMaterial({
    map: texture,
    roughness: 0.6,
    metalness: 0.05,
  });
  const mesh = new Mesh(geometry, material);
  mesh.matrixAutoUpdate = true;
  return mesh;
}

/** The player: a capsule standing on the slide. A real model replaces this later. */
export function createPlayerMesh(): Mesh<CapsuleGeometry, MeshStandardMaterial> {
  const bodyLength = PLAYER.standHeight - PLAYER.radius * 2;
  const geometry = new CapsuleGeometry(PLAYER.radius, bodyLength, 4, 12);
  const material = new MeshStandardMaterial({
    color: PALETTE.player,
    roughness: 0.4,
    metalness: 0.1,
  });
  return new Mesh(geometry, material);
}

/** A soft blob shadow under the player — cheaper than a real shadow (SPEC 13). */
export function createBlobShadow(): Mesh<CircleGeometry, MeshBasicMaterial> {
  const geometry = new CircleGeometry(PLAYER.radius * 1.5, 16).rotateX(-Math.PI / 2);
  const material = new MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
  });
  return new Mesh(geometry, material);
}

/** Simple two-light rig: no shadows, cheap on mobile (SPEC 13). */
export function createLights(): Object3D[] {
  const ambient = new AmbientLight(0xffffff, 1.6);
  const sun = new DirectionalLight(0xffffff, 2);
  sun.position.set(3, 10, 4);
  return [ambient, sun];
}

/** One placeholder mesh per obstacle type (SPEC 7). */
export function createObstacleMesh(type: ObstacleType): Mesh {
  const size = OBSTACLES.size[type];
  switch (type) {
    case 'lowMine': {
      // Red spiky ball sitting low on the slide.
      const geometry = new IcosahedronGeometry(size.w / 2, 0);
      const material = new MeshStandardMaterial({
        color: PALETTE.lowMine,
        roughness: 0.5,
        flatShading: true,
      });
      return new Mesh(geometry, material);
    }
    case 'highObstacle': {
      // Blue arch spanning the lane, with a gap underneath to slide through.
      const geometry = new BoxGeometry(size.w, size.h, size.d);
      const material = new MeshStandardMaterial({ color: PALETTE.highObstacle, roughness: 0.4 });
      return new Mesh(geometry, material);
    }
    case 'fullBlocker': {
      // Grey wall filling the lane from the floor up.
      const geometry = new BoxGeometry(size.w, size.h, size.d);
      const material = new MeshStandardMaterial({ color: PALETTE.fullBlocker, roughness: 0.75 });
      return new Mesh(geometry, material);
    }
    case 'softObstacle': {
      // Yellow inflatable ring lying flat.
      const geometry = new TorusGeometry(size.w / 2.6, size.h / 2, 8, 16).rotateX(-Math.PI / 2);
      const material = new MeshStandardMaterial({ color: PALETTE.softObstacle, roughness: 0.6 });
      return new Mesh(geometry, material);
    }
  }
}

/** Where the middle of an obstacle's mesh sits above the slide, in units. */
export function obstacleMeshHeight(type: ObstacleType): number {
  const size = OBSTACLES.size[type];
  return size.y + size.h / 2;
}

/**
 * The coin mesh, built once and drawn for every coin at once through
 * instancing, so a trail of coins costs a single draw call (SPEC 13).
 *
 * The cylinder lies on its side, like a coin standing up facing the player.
 */
export function createCoinInstances(capacity: number): InstancedMesh {
  const geometry = new CylinderGeometry(COINS.radius, COINS.radius, COINS.thickness, 14);
  // Stand it upright and face it down the slide.
  geometry.rotateX(Math.PI / 2);
  const material = new MeshStandardMaterial({
    color: PALETTE.coin,
    roughness: 0.25,
    metalness: 0.6,
    emissive: PALETTE.coin,
    emissiveIntensity: 0.15,
  });
  const mesh = new InstancedMesh(geometry, material, capacity);
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.count = 0;
  return mesh;
}

/** The floating pickup that grants a power-up, coloured by type (SPEC 9). */
export function createPickupMesh(
  type: PowerUpType,
): Mesh<OctahedronGeometry, MeshStandardMaterial> {
  const color =
    type === 'shield' ? PALETTE.shield : type === 'magnet' ? PALETTE.magnet : PALETTE.boost;
  const geometry = new OctahedronGeometry(POWERUPS.pickupSize, 0);
  const material = new MeshStandardMaterial({
    color,
    roughness: 0.3,
    metalness: 0.3,
    emissive: color,
    emissiveIntensity: 0.4,
    flatShading: true,
  });
  return new Mesh(geometry, material);
}

/** The cyan bubble drawn around the player while a shield is up (SPEC 9). */
export function createShieldBubble(): Mesh<SphereGeometry, MeshBasicMaterial> {
  const geometry = new SphereGeometry(PLAYER.standHeight * 0.75, 16, 12);
  const material = new MeshBasicMaterial({
    color: PALETTE.shield,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
  });
  const mesh = new Mesh(geometry, material);
  mesh.visible = false;
  return mesh;
}
