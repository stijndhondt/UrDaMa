import type { BuildingSolids, SolidRef } from '@urdama/core';

/** One element's triangle mesh, in plan millimetres: x right, y down (plan), z up. */
export type ElementMesh = SolidRef & {
  /** x, y, z per vertex */
  readonly positions: Float32Array;
  /** Three vertex indices per triangle, counter-clockwise seen from outside (z up). */
  readonly indices: Uint32Array;
};

/** From the page to the worker: mesh these solids. */
export interface BuildRequest {
  readonly request: number;
  readonly solids: BuildingSolids;
  /** Where the page serves manifold.wasm */
  readonly wasmUrl: string;
}

/** From the worker to the page: the meshes for a request, or why there are none. */
export type BuildReply =
  | { readonly request: number; readonly meshes: ElementMesh[] }
  | { readonly request: number; readonly error: string };
