import type { BuildingSolids } from '@lakudemis/core';
import type { ElementMesh } from '@lakudemis/render3d/worker';

export type { ElementMesh };

/**
 * Turns solid descriptions into meshes (ADR 0005): manifold-3d in a Web Worker today, anything
 * else later. Results may lag behind the model; nothing waits for them (ADR 0003).
 */
export interface SolidKernel {
  /** Meshes for the given solids; a newer call supersedes an older one still running. */
  build(solids: BuildingSolids): Promise<readonly ElementMesh[] | 'superseded'>;
  dispose(): void;
}
