/**
 * The endless slide: a small pool of segments recycled from back to front
 * (SPEC 2, CLAUDE.md rule 7).
 *
 * Nothing here allocates while the game is running. Each frame only moves the
 * segments along Z; the bend from curve.ts is baked into a segment's vertices
 * once, when that segment is recycled onto a new stretch of slide.
 */

import type {
  BufferAttribute,
  CanvasTexture,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Scene,
} from 'three';
import { TRACK } from '../config';
import { createTrackSegment } from './factories';
import { curveX, curveY } from './curve';

interface Segment {
  mesh: Mesh<PlaneGeometry, MeshStandardMaterial>;
  /** Distance from the start of the slide to this segment's near edge, in units. */
  startS: number;
  /** The flat, unbent position of every vertex, so bending never accumulates. */
  baseX: Float32Array;
  baseZ: Float32Array;
}

export interface Track {
  /** Moves the slide to match how far the player has travelled, in units. */
  update(playerS: number): void;
  dispose(): void;
}

/** Enough segments to cover the visible track, plus one being recycled. */
function segmentCount(): number {
  return Math.ceil((TRACK.buildAhead + TRACK.recycleBehind) / TRACK.segmentLength) + 1;
}

/**
 * Bends one segment to match the shape of the slide along its stretch.
 *
 * The mesh's own position carries the bend at the segment's near edge, and the
 * vertices carry the change across its length, so neighbouring segments always
 * line up exactly however they are recycled.
 */
function shapeSegment(segment: Segment): void {
  const geometry = segment.mesh.geometry;
  const position = geometry.getAttribute('position') as BufferAttribute;
  const anchorX = curveX(segment.startS);
  const anchorY = curveY(segment.startS);

  for (let i = 0; i < position.count; i += 1) {
    const localZ = segment.baseZ[i] as number;
    // Forward along the slide is -Z, so the far edge of the segment is the
    // vertex with the smallest local Z.
    const s = segment.startS + TRACK.segmentLength / 2 - localZ;
    position.setX(i, (segment.baseX[i] as number) + curveX(s) - anchorX);
    position.setY(i, curveY(s) - anchorY);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  segment.mesh.position.x = anchorX;
  segment.mesh.position.y = anchorY;
}

export function createTrack(scene: Scene, texture: CanvasTexture): Track {
  const count = segmentCount();
  const span = count * TRACK.segmentLength;
  const segments: Segment[] = [];

  for (let i = 0; i < count; i += 1) {
    const mesh = createTrackSegment(texture);
    const position = mesh.geometry.getAttribute('position') as BufferAttribute;
    const baseX = new Float32Array(position.count);
    const baseZ = new Float32Array(position.count);
    for (let v = 0; v < position.count; v += 1) {
      baseX[v] = position.getX(v);
      baseZ[v] = position.getZ(v);
    }
    // The first segment starts just behind the player, the rest follow on.
    const segment: Segment = {
      mesh,
      startS: (i - 1) * TRACK.segmentLength,
      baseX,
      baseZ,
    };
    shapeSegment(segment);
    segments.push(segment);
    scene.add(mesh);
  }

  return {
    update(playerS: number) {
      for (const segment of segments) {
        // Once a segment is well behind the camera, move it to the front.
        if (segment.startS + TRACK.segmentLength < playerS - TRACK.recycleBehind) {
          segment.startS += span;
          shapeSegment(segment);
        }
        // The player sits at z = 0 and the slide slides past them.
        segment.mesh.position.z = playerS - segment.startS - TRACK.segmentLength / 2;
      }
    },
    dispose() {
      for (const segment of segments) {
        scene.remove(segment.mesh);
        segment.mesh.geometry.dispose();
        segment.mesh.material.dispose();
      }
      segments.length = 0;
    },
  };
}
