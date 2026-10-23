/**
 * Drawing hitboxes in debug mode (SPEC 13).
 *
 * Each box is an outline drawn on top of everything, so a hitbox inside a
 * mesh still shows: green for the player, red for what kills from the front,
 * yellow for what only trips. The outlines are pooled and share one geometry,
 * like the obstacles themselves (CLAUDE.md rule 7).
 *
 * Only built when debug mode is on; a normal game never creates any of this.
 */

import { BoxGeometry, EdgesGeometry, LineBasicMaterial, LineSegments, type Scene } from 'three';
import { PALETTE } from '../config';
import type { Box } from '../game/obstacles';
import type { HitboxList } from '../game/hitboxes';
import { curveX, curveY } from './curve';

export interface HitboxLayer {
  /** Draws the boxes in `list`, or hides them all when `list` is null. */
  update(list: HitboxList | null, playerS: number): void;
  dispose(): void;
}

function outlineMaterial(color: number): LineBasicMaterial {
  return new LineBasicMaterial({ color, depthTest: false, transparent: true });
}

export function createHitboxLayer(scene: Scene): HitboxLayer {
  const cube = new BoxGeometry(1, 1, 1);
  const edges = new EdgesGeometry(cube);
  cube.dispose();

  const playerMaterial = outlineMaterial(PALETTE.debugPlayer);
  const deadlyMaterial = outlineMaterial(PALETTE.debugDeadly);
  const stumbleMaterial = outlineMaterial(PALETTE.debugStumble);

  const make = (material: LineBasicMaterial): LineSegments => {
    const outline = new LineSegments(edges, material);
    // Drawn last, over the meshes it belongs to.
    outline.renderOrder = 10;
    outline.visible = false;
    scene.add(outline);
    return outline;
  };

  const playerOutline = make(playerMaterial);
  const pool: LineSegments[] = [];

  /** Sizes and places an outline over a box `along` units down the slide. */
  const place = (outline: LineSegments, box: Box, along: number, worldZ: number): void => {
    outline.scale.set(box.halfW * 2, box.maxY - box.minY, box.halfD * 2);
    outline.position.set(curveX(along) + box.x, curveY(along) + (box.minY + box.maxY) / 2, worldZ);
    outline.visible = true;
  };

  return {
    update(list, playerS) {
      if (list === null) {
        playerOutline.visible = false;
        for (const outline of pool) outline.visible = false;
        return;
      }

      // The player is drawn where the player mesh is, which is always z = 0.
      place(playerOutline, list.player, playerS, 0);

      for (let i = 0; i < list.count; i += 1) {
        const box = list.obstacles[i] as Box;
        const outline = pool[i] ?? make(deadlyMaterial);
        if (pool[i] === undefined) pool.push(outline);
        outline.material = list.deadly[i] === true ? deadlyMaterial : stumbleMaterial;
        place(outline, box, box.z, playerS - box.z);
      }
      for (let i = list.count; i < pool.length; i += 1) {
        (pool[i] as LineSegments).visible = false;
      }
    },

    dispose() {
      scene.remove(playerOutline, ...pool);
      pool.length = 0;
      edges.dispose();
      playerMaterial.dispose();
      deadlyMaterial.dispose();
      stumbleMaterial.dispose();
    },
  };
}
