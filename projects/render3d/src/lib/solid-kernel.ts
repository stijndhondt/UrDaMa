import type { BuildingSolids, SolidRef } from '@lakudemis/core';

/** One element's triangle mesh, in plan millimetres: x right, y down (plan), z up. */
export type ElementMesh = SolidRef & {
  /** x, y, z per vertex */
  readonly positions: Float32Array;
  /** Three vertex indices per triangle, counter-clockwise seen from outside (z up). */
  readonly indices: Uint32Array;
};

/**
 * Turns solid descriptions into meshes (ADR 0005): manifold-3d in a Web Worker today, anything
 * else later. Results may lag behind the model; nothing waits for them (ADR 0003).
 */
export interface SolidKernel {
  /** Meshes for the given solids; a newer call supersedes an older one still running. */
  build(solids: BuildingSolids): Promise<readonly ElementMesh[] | 'superseded'>;
  dispose(): void;
}
