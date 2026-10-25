/**
 * Every visual is built here (CLAUDE.md rule 8).
 *
 * Nothing is downloaded: each shape is assembled out of primitives in code,
 * its part colours baked into its vertices, and shaded with the three-step
 * toon ramp and dark outline from materials.ts (docs/ART-AND-SHOP.md §1).
 *
 * The shapes and sizes of the obstacles are unchanged from the placeholder
 * art — only their looks are new — because the hitboxes in src/game/ are
 * worked out from the same numbers in OBSTACLES.size (SPEC 7).
 */

import {
  AmbientLight,
  BoxGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DynamicDrawUsage,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  type BufferGeometry,
  type Object3D,
  PlaneGeometry,
  TorusGeometry,
  type Texture,
} from 'three';
import { COINS, OBSTACLES, PLAYER, POWERUPS, RETRO, RIDER, TRACK } from '../config';
import { palette, theme } from './theme';
import type { ObstacleType } from '../game/obstacles';
import type { PowerUpType } from '../game/powerups';
import { mergeColoredParts, type GeometryPart } from './geometry';
import {
  addOutline,
  outlineGeometry,
  outlineMaterial,
  surfaceMaterial,
  type SurfaceMaterial,
} from './materials';
import type { SceneryKind } from './scenery-layout';
import { RIDER_LAYOUT } from './rider-pose';
import { GROUND_AHEAD, GROUND_BEHIND } from './ground-layout';
import { EFFECT_IN_FRONT } from './sprites';
import {
  createCoinStripTexture,
  createGroundTexture,
  createPickupIconTexture,
  createRiderAtlasTexture,
} from './textures';

/** How many times the geometry of a track segment is cut across its length. */
export const SEGMENT_DIVISIONS = 12;

/** Shorthand for placing a part inside a prop. */
function at(x: number, y: number, z: number): Matrix4 {
  return new Matrix4().makeTranslation(x, y, z);
}

/** Shorthand for a part that is moved and turned. */
function placed(x: number, y: number, z: number, rotation: Matrix4): Matrix4 {
  return at(x, y, z).multiply(rotation);
}

/**
 * One recycled piece of slide, lying flat and cut across its length so the
 * visual bend in curve.ts can be baked into its vertices.
 */
export function createTrackSegment(texture: Texture): Mesh<PlaneGeometry, SurfaceMaterial> {
  const geometry = new PlaneGeometry(
    TRACK.width,
    TRACK.segmentLength,
    1,
    SEGMENT_DIVISIONS,
  ).rotateX(-Math.PI / 2);
  const material = surfaceMaterial({ map: texture });
  const mesh = new Mesh(geometry, material);
  mesh.matrixAutoUpdate = true;
  return mesh;
}

/**
 * The grass under the slide: a plane cut into rows across its length, which
 * src/render/ground.ts bends to follow the slide every frame (§1).
 *
 * It sits a little below the slide floor, and the polygon offset pushes it a
 * touch further back in the depth test as well, so where the two nearly touch
 * the slide always wins rather than flickering against the grass.
 */
export function createGroundMesh(): Mesh<PlaneGeometry, SurfaceMaterial> {
  const geometry = new PlaneGeometry(
    RETRO.ground.width,
    GROUND_AHEAD + GROUND_BEHIND,
    1,
    RETRO.ground.rows,
  ).rotateX(-Math.PI / 2);
  const material = surfaceMaterial({ map: createGroundTexture() });
  material.polygonOffset = true;
  material.polygonOffsetFactor = 1;
  material.polygonOffsetUnits = 1;
  return new Mesh(geometry, material);
}

/** The rider's layers, back to front, and what they share. */
export interface RiderMesh {
  /** Sits on the slide under the rider's middle; this is what gets moved about. */
  group: Group;
  /** The ring and the animal together, so a duck can drop them both. */
  body: Group;
  ringBack: Mesh<PlaneGeometry, MeshBasicMaterial>;
  animal: Mesh<PlaneGeometry, MeshBasicMaterial>;
  ringFront: Mesh<PlaneGeometry, MeshBasicMaterial>;
  /** One quad per power-up, in front of the rider or behind it, hidden when off. */
  effects: Record<PowerUpType, Mesh<PlaneGeometry, MeshBasicMaterial>>;
  /** The one atlas every layer draws from, and the one material they share. */
  texture: Texture;
  material: MeshBasicMaterial;
}

/**
 * The player: an animal sitting in a ring, as flat pixel sprites facing down
 * the slide (docs/ART-AND-SHOP.md §2).
 *
 * Three layers make the rider — the ring's back half, the animal, the ring's
 * front half — so any animal fits any ring, and one more per power-up carries
 * its effect, in front of the rider or behind it. Every layer is a quad drawn
 * from the same atlas with the same material; which frame each shows is
 * chosen by its UVs, so the rider costs three tiny draw calls and one texture,
 * plus one for each power-up running.
 *
 * The quads face +Z, towards the camera behind the player, and the rider turns
 * the whole group square to the camera every frame so the pixels stay square
 * on the drops too (rider.ts). Like the coins they cut their clear pixels out
 * rather than blending them, which keeps them out of the transparency sort;
 * the layers are a hair apart in depth, which is all it takes to stack them
 * in the right order.
 *
 * Purely a picture: how big it is has nothing to do with the hitbox, which is
 * still PLAYER's (CLAUDE.md rule 13).
 */
export function createRiderMesh(): RiderMesh {
  const texture = createRiderAtlasTexture();
  const material = new MeshBasicMaterial({ map: texture, alphaTest: 0.5, transparent: false });
  const unit = 1 / RIDER.pixelsPerUnit;

  const quad = (width: number, height: number): Mesh<PlaneGeometry, MeshBasicMaterial> => {
    const mesh = new Mesh(new PlaneGeometry(width * unit, height * unit), material);
    // Small and always right under the camera: never worth culling.
    mesh.frustumCulled = false;
    return mesh;
  };

  const group = new Group();
  const body = new Group();
  group.add(body);

  // The ring's bottom edge sits a little under the water, so it floats.
  const ringBottom = -RIDER.ringSinkPixels * unit;
  const ringBack = quad(RIDER.ringWidth, RIDER.ringHeight);
  const ringFront = quad(RIDER.ringWidth, RIDER.ringHeight);
  for (const [mesh, z] of [
    [ringBack, -RIDER.layerGap],
    [ringFront, RIDER.layerGap],
  ] as const) {
    mesh.position.set(0, ringBottom + (RIDER.ringHeight / 2) * unit, z);
    body.add(mesh);
  }

  // The animal's resting place; the rider view moves it from here per pose.
  const animal = quad(RIDER.animalPixels, RIDER.animalPixels);
  animal.position.set(0, riderAnimalY(0), 0);
  body.add(animal);

  // The effects, centred on the middle of the whole rider: the ones in front
  // a step nearer than the ring's front half, the ones behind a step further
  // back than its back half.
  const middle = ringBottom + (RIDER_LAYOUT.height / 2) * unit;
  const effect = (type: PowerUpType): Mesh<PlaneGeometry, MeshBasicMaterial> => {
    const mesh = quad(RIDER.effectWidth, RIDER.effectHeight);
    mesh.position.set(0, middle, (EFFECT_IN_FRONT[type] ? 2 : -2) * RIDER.layerGap);
    mesh.visible = false;
    group.add(mesh);
    return mesh;
  };
  const effects = { shield: effect('shield'), magnet: effect('magnet'), boost: effect('boost') };

  return { group, body, ringBack, animal, ringFront, effects, texture, material };
}

/**
 * Where the middle of the animal quad sits, in units above the slide, when it
 * is moved `dy` sprite pixels down from its resting place: its bottom edge on
 * `RIDER.animalBottomRow` of the ring.
 */
export function riderAnimalY(dy: number): number {
  const unit = 1 / RIDER.pixelsPerUnit;
  const ringBottom = -RIDER.ringSinkPixels * unit;
  const bottom = ringBottom + (RIDER.ringHeight - RIDER.animalBottomRow) * unit;
  return bottom + (RIDER.animalPixels / 2 - dy) * unit;
}

/** A soft blob shadow under the player — cheaper than a real shadow (SPEC 13). */
export function createBlobShadow(): Mesh<CircleGeometry, MeshBasicMaterial> {
  const geometry = new CircleGeometry(PLAYER.radius * 1.5, 8).rotateX(-Math.PI / 2);
  const material = new MeshBasicMaterial({
    color: palette().outline,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
  });
  return new Mesh(geometry, material);
}

/**
 * Two lights, no shadows (SPEC 13). The balance matters more than it did with
 * the old materials: too much ambient light and every toon surface lands on
 * the same step of the ramp, which flattens the picture completely.
 */
export function createLights(): Object3D[] {
  const ambient = new AmbientLight(palette().skyTop, 0.95);
  const sun = new DirectionalLight(palette().sun, 2.1);
  // Low and to one side, like the sun in the painted sky.
  sun.position.set(3, 7, 5);
  return [ambient, sun];
}

// --- Obstacles ---------------------------------------------------------------

/** The red buoy-mine: a spiked ball with a band round it (§1). */
function mineParts(): GeometryPart[] {
  const size = OBSTACLES.size.lowMine;
  const radius = size.w / 2;
  const parts: GeometryPart[] = [
    { geometry: new IcosahedronGeometry(radius, 1), color: palette().red },
    // The band, a flattened ring around the middle.
    {
      geometry: new CylinderGeometry(radius * 0.86, radius * 0.86, radius * 0.3, 10),
      color: palette().cream,
    },
  ];
  // Spikes around the equator and one on top, in the outline colour, so the
  // mine reads as dangerous even as a silhouette.
  const spike = (): BufferGeometry => new ConeGeometry(radius * 0.17, radius * 0.5, 5);
  const spikes = 6;
  for (let i = 0; i < spikes; i += 1) {
    const angle = (i / spikes) * Math.PI * 2;
    const reach = radius * 1.1;
    parts.push({
      geometry: spike(),
      matrix: placed(
        Math.cos(angle) * reach,
        0,
        Math.sin(angle) * reach,
        new Matrix4().makeRotationZ(-Math.PI / 2).premultiply(new Matrix4().makeRotationY(-angle)),
      ),
      color: palette().outline,
    });
  }
  parts.push({ geometry: spike(), matrix: at(0, radius * 1.1, 0), color: palette().outline });
  return parts;
}

/** The blue bar you slide under, with a banner above it (§1). */
function highObstacleParts(): GeometryPart[] {
  const size = OBSTACLES.size.highObstacle;
  const barHeight = Math.min(0.55, size.h * 0.26);
  const bannerHeight = size.h - barHeight;
  return [
    // The bar itself sits at the bottom of the box: that is the edge the
    // player has to get under, so it is the edge that must read clearly.
    {
      geometry: new BoxGeometry(size.w, barHeight, size.d),
      matrix: at(0, -size.h / 2 + barHeight / 2, 0),
      color: palette().blue,
    },
    // The banner above it, which is what you see from a distance.
    {
      geometry: new BoxGeometry(size.w * 0.92, bannerHeight * 0.86, size.d * 0.45),
      matrix: at(0, -size.h / 2 + barHeight + (bannerHeight * 0.86) / 2, 0),
      color: palette().skyBlue,
    },
    // A cream stripe across the banner.
    {
      geometry: new BoxGeometry(size.w * 0.92, bannerHeight * 0.2, size.d * 0.6),
      matrix: at(0, -size.h / 2 + barHeight + bannerHeight * 0.5, 0),
      color: palette().cream,
    },
  ];
}

/** The lane-filling blocker: three stacked crates with a hazard band (§1). */
function fullBlockerParts(): GeometryPart[] {
  const size = OBSTACLES.size.fullBlocker;
  const crates = 3;
  const gap = 0.07;
  const crateHeight = size.h / crates - gap;
  const parts: GeometryPart[] = [];

  for (let i = 0; i < crates; i += 1) {
    const y = -size.h / 2 + crateHeight / 2 + i * (crateHeight + gap);
    parts.push({
      geometry: new BoxGeometry(size.w, crateHeight, size.d),
      matrix: at(0, y, 0),
      color: i % 2 === 0 ? palette().sand : palette().slideEdge,
    });
    // A plank line across each crate.
    parts.push({
      geometry: new BoxGeometry(size.w * 1.04, crateHeight * 0.2, size.d * 1.04),
      matrix: at(0, y, 0),
      color: palette().outline,
    });
  }

  // The hazard band across the middle crate: the "do not try it" signal.
  parts.push({
    geometry: new BoxGeometry(size.w * 1.06, crateHeight * 0.4, size.d * 0.3),
    matrix: at(0, 0, size.d / 2),
    color: palette().orange,
  });
  return parts;
}

/** The yellow inflatable: a ring lying flat, with a cream stripe (§1). */
function softObstacleParts(): GeometryPart[] {
  const size = OBSTACLES.size.softObstacle;
  const flat = new Matrix4().makeRotationX(-Math.PI / 2);
  return [
    {
      geometry: new TorusGeometry(size.w / 2.6, size.h / 2, 6, 12),
      matrix: flat,
      color: palette().softObstacle,
    },
    // A thinner ring sitting just on top, which gives it its inflated look.
    {
      geometry: new TorusGeometry(size.w / 2.6, size.h / 3.4, 6, 12),
      matrix: placed(0, size.h * 0.22, 0, flat),
      color: palette().cream,
    },
  ];
}

/** The merged, vertex-coloured geometry for one obstacle type (SPEC 7). */
export function createObstacleGeometry(type: ObstacleType): BufferGeometry {
  switch (type) {
    case 'lowMine':
      return mergeColoredParts(mineParts());
    case 'highObstacle':
      return mergeColoredParts(highObstacleParts());
    case 'fullBlocker':
      return mergeColoredParts(fullBlockerParts());
    case 'softObstacle':
      return mergeColoredParts(softObstacleParts());
  }
}

/** Where the middle of an obstacle's mesh sits above the slide, in units. */
export function obstacleMeshHeight(type: ObstacleType): number {
  const size = OBSTACLES.size[type];
  return size.y + size.h / 2;
}

// --- Coins and pickups -------------------------------------------------------

/**
 * The coins: one instanced billboard, drawn with one frame of the pixel strip
 * at a time, so a whole trail costs a single draw call (SPEC 13).
 *
 * The camera is always behind the player, so a flat quad facing down the slide
 * never needs turning to face it. The dark rim is part of the painted sprite
 * rather than a hull: a hull around a flat quad would show as a border on one
 * side only, and a painted rim is free.
 */
export function createCoinInstances(capacity: number): {
  mesh: InstancedMesh;
  texture: Texture;
} {
  const geometry = new PlaneGeometry(COINS.radius * 2, COINS.radius * 2);
  const texture = createCoinStripTexture();
  const material = new MeshBasicMaterial({
    map: texture,
    // Cut the clear pixels out rather than blending them: a pixel sprite has
    // no soft edges to preserve, and this keeps the coins out of the
    // transparency sorting, where a long trail would flicker.
    alphaTest: 0.5,
    transparent: false,
  });
  const mesh = new InstancedMesh(geometry, material, capacity);
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.count = 0;
  return { mesh, texture };
}

/** A floating pickup: the ring that turns, and the icon that does not. */
export interface PickupProp {
  /** Both parts together; this is what gets moved about. */
  group: Group;
  /** The ring, which is the part that spins. */
  ring: Mesh;
}

/**
 * The floating pickup: a ring in the power-up's colour with its pixel icon
 * hanging in the middle (§1).
 *
 * The icon is a sibling of the ring rather than its child, so the ring can
 * turn while the icon keeps facing the player — an icon spinning on the spot
 * would be unreadable, which is the one thing an icon must not be.
 */
export function createPickupMesh(type: PowerUpType): PickupProp {
  const color =
    type === 'shield' ? palette().shield : type === 'magnet' ? palette().magnet : palette().boost;
  const radius = POWERUPS.pickupSize;
  const group = new Group();

  const ring = new Mesh(
    new TorusGeometry(radius * 0.82, radius * 0.16, 6, 14),
    surfaceMaterial({ color }),
  );
  addOutline(ring);
  group.add(ring);

  const icon = new Mesh(
    new PlaneGeometry(radius * 1.15, radius * 1.15),
    new MeshBasicMaterial({
      map: createPickupIconTexture(type),
      alphaTest: 0.5,
      transparent: false,
    }),
  );
  // Just in front of the ring, so it never fights it for depth.
  icon.position.z = radius * 0.25;
  icon.name = 'icon';
  group.add(icon);

  return { group, ring };
}

// --- Scenery -----------------------------------------------------------------

/**
 * A water-slide tower: a column, a platform, a roof and a slide spiralling
 * down round it, exactly the landmark the reference art is built around (§1).
 *
 * The spiral is a run of small blocks following a helix. Working it out here,
 * once, costs nothing at run time — and merged into the prop it is still a
 * single draw call.
 *
 * @param warm true for the red/orange tower, false for the blue/sky-blue one
 */
function towerParts(warm: boolean): GeometryPart[] {
  const height = 9;
  const columnRadius = 0.5;
  const slideRadius = 2.1;
  const slideColors = warm
    ? [palette().red, palette().orange]
    : [palette().blue, palette().skyBlue];
  const roofColor = warm ? palette().red : palette().blue;

  const parts: GeometryPart[] = [
    // The column.
    {
      geometry: new CylinderGeometry(columnRadius, columnRadius * 1.2, height, 8),
      matrix: at(0, height / 2, 0),
      color: palette().slideEdge,
    },
    // The platform at the top.
    {
      geometry: new CylinderGeometry(1.5, 1.5, 0.4, 8),
      matrix: at(0, height, 0),
      color: palette().sand,
    },
    // A pointed roof over it.
    {
      geometry: new ConeGeometry(1.9, 1.8, 8),
      matrix: at(0, height + 1.1, 0),
      color: roofColor,
    },
    // The ladder up the back.
    {
      geometry: new BoxGeometry(0.12, height, 0.12),
      matrix: at(-columnRadius - 0.25, height / 2, 0),
      color: palette().outline,
    },
  ];

  // The spiral slide: blocks down a helix, two colours alternating so the
  // turns read even at a distance.
  const blocks = 20;
  const turns = 2.2;
  for (let i = 0; i < blocks; i += 1) {
    const t = i / (blocks - 1);
    const angle = t * turns * Math.PI * 2;
    const y = height * 0.92 - t * (height * 0.86);
    parts.push({
      geometry: new BoxGeometry(1.15, 0.34, 0.62),
      matrix: placed(
        Math.cos(angle) * slideRadius,
        y,
        Math.sin(angle) * slideRadius,
        new Matrix4().makeRotationY(-angle),
      ),
      color: slideColors[i % 2] as number,
    });
  }

  // The splash pool at the bottom.
  parts.push({
    geometry: new CylinderGeometry(slideRadius + 0.8, slideRadius + 0.9, 0.5, 10),
    matrix: at(0, 0.25, 0),
    color: palette().water,
  });
  return parts;
}

/** A round pixel tree: a trunk and two stacked crowns (§1). */
function treeParts(): GeometryPart[] {
  return [
    {
      geometry: new CylinderGeometry(0.26, 0.34, 2.2, 6),
      matrix: at(0, 1.1, 0),
      color: palette().forestDark,
    },
    {
      geometry: new IcosahedronGeometry(1.5, 0),
      matrix: at(0, 3, 0),
      color: palette().forest,
    },
    {
      geometry: new IcosahedronGeometry(1, 0),
      matrix: at(0.2, 4.1, 0.1),
      color: palette().forestLight,
    },
  ];
}

/** A palm: a leaning trunk, a crown of fronds and two coconuts (§1). */
function palmParts(): GeometryPart[] {
  const height = 4.6;
  const parts: GeometryPart[] = [
    {
      geometry: new CylinderGeometry(0.17, 0.3, height, 6),
      matrix: placed(0, height / 2, 0, new Matrix4().makeRotationZ(0.12)),
      color: palette().sand,
    },
  ];

  const fronds = 6;
  for (let i = 0; i < fronds; i += 1) {
    const angle = (i / fronds) * Math.PI * 2;
    const reach = 1.25;
    parts.push({
      geometry: new BoxGeometry(2.3, 0.16, 0.6),
      matrix: placed(
        Math.cos(angle) * reach - 0.3,
        height - 0.1,
        Math.sin(angle) * reach,
        new Matrix4().makeRotationZ(-0.25).premultiply(new Matrix4().makeRotationY(-angle)),
      ),
      color: i % 2 === 0 ? palette().forest : palette().forestLight,
    });
  }

  for (const side of [-1, 1]) {
    parts.push({
      geometry: new IcosahedronGeometry(0.22, 0),
      matrix: at(side * 0.26 - 0.3, height - 0.45, 0.1),
      color: palette().forestDark,
    });
  }
  return parts;
}

/** A small hut: walls, a pyramid roof and a dark doorway (§1). */
function hutParts(): GeometryPart[] {
  const width = 2.4;
  const wall = 1.7;
  return [
    {
      geometry: new BoxGeometry(width, wall, width),
      matrix: at(0, wall / 2, 0),
      color: palette().slideEdge,
    },
    {
      geometry: new ConeGeometry(width * 0.92, 1.4, 4),
      matrix: placed(0, wall + 0.7, 0, new Matrix4().makeRotationY(Math.PI / 4)),
      color: palette().forestDark,
    },
    // The doorway.
    {
      geometry: new BoxGeometry(width * 0.34, wall * 0.62, 0.12),
      matrix: at(0, wall * 0.31, width / 2),
      color: palette().outline,
    },
    // A sand step at the front.
    {
      geometry: new BoxGeometry(width * 0.6, 0.18, 0.5),
      matrix: at(0, 0.09, width / 2 + 0.2),
      color: palette().sand,
    },
  ];
}

/** The merged, vertex-coloured geometry for one kind of scenery prop. */
export function createSceneryGeometry(kind: SceneryKind): BufferGeometry {
  switch (kind) {
    case 'towerWarm':
      return mergeColoredParts(towerParts(true));
    case 'towerCool':
      return mergeColoredParts(towerParts(false));
    case 'tree':
      return mergeColoredParts(treeParts());
    case 'palm':
      return mergeColoredParts(palmParts());
    case 'hut':
      return mergeColoredParts(hutParts());
  }
}

// --- Instancing with an outline ---------------------------------------------

/** An instanced prop and the inside-out copy that gives it its dark rim. */
export interface OutlinedInstances {
  mesh: InstancedMesh;
  outline: InstancedMesh;
}

/**
 * One instanced mesh for a shape, plus a second one drawn inside out and
 * fattened, so every copy of the shape gets the dark rim for two draw calls in
 * total however many are on screen (§1).
 *
 * @param geometry the merged, vertex-coloured shape
 * @param capacity the most copies that can ever be drawn at once
 */
export function createOutlinedInstances(
  geometry: BufferGeometry,
  capacity: number,
): OutlinedInstances {
  const mesh = new InstancedMesh(geometry, surfaceMaterial({ vertexColors: true }), capacity);
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.count = 0;

  // The rim is a fixed number of game pixels wide on screen, whatever the
  // shape's size or distance; see outlineMaterial in materials.ts.
  const outline = new InstancedMesh(outlineGeometry(geometry), outlineMaterial(), capacity);
  outline.instanceMatrix.setUsage(DynamicDrawUsage);
  outline.frustumCulled = false;
  outline.count = 0;
  // A smooth look has no rims; the copy is kept so the layers that place it
  // need not care, but it is never drawn.
  outline.visible = theme().outlines;
  return { mesh, outline };
}

/**
 * The square pixel splashes thrown up when the player lands (§1).
 *
 * One instanced quad, three colours from the water palette picked per
 * particle. The pool never grows (rule 7).
 */
export function createSplashInstances(capacity: number): InstancedMesh {
  const geometry = new PlaneGeometry(RETRO.splash.size, RETRO.splash.size);
  const material = new MeshBasicMaterial({ color: 0xffffff });
  const mesh = new InstancedMesh(geometry, material, capacity);
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.count = 0;
  return mesh;
}
