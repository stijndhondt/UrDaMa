/// <reference lib="webworker" />
/**
 * The manifold-3d Web Worker: loads the WASM module on first use, meshes the solids it is sent
 * and posts the meshes back (their buffers transferred, not copied).
 */
import type { BuildingSolids } from '@lakudemis/core';
import Module, { type ManifoldToplevel } from 'manifold-3d/manifold';
import { meshSolids } from './manifold-meshes';

export interface BuildRequest {
  readonly request: number;
  readonly solids: BuildingSolids;
  /** Where the page serves manifold.wasm */
  readonly wasmUrl: string;
}

let wasm: Promise<ManifoldToplevel> | null = null;

addEventListener('message', async (event: MessageEvent<BuildRequest>) => {
  const { request, solids, wasmUrl } = event.data;
  try {
    wasm ??= Module({ locateFile: () => wasmUrl }).then((m) => {
      m.setup();
      return m;
    });
    const { meshes, problems } = meshSolids(await wasm, solids);
    if (problems.length) console.warn('manifold-3d:', problems);
    postMessage(
      { request, meshes },
      meshes.flatMap((m) => [m.positions.buffer, m.indices.buffer]),
    );
  } catch (error) {
    postMessage({ request, error: String(error) });
  }
});
