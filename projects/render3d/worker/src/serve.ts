/**
 * The manifold-3d worker side: loads the WASM module on first use, meshes the solids it is sent
 * and posts the meshes back (their buffers transferred, not copied).
 */
import Module, { type ManifoldToplevel } from 'manifold-3d/manifold';
import { meshSolids } from './manifold-meshes';
import type { BuildReply, BuildRequest } from './protocol';

/** The part of a dedicated worker's global scope this needs. */
export interface WorkerScope {
  addEventListener(type: 'message', listener: (event: MessageEvent<BuildRequest>) => void): void;
  postMessage(message: BuildReply, transfer?: Transferable[]): void;
}

/**
 * Answers ManifoldKernel's build requests. Call it from the app's own worker module, so the
 * app's bundler packs the worker:
 *
 * ```ts
 * import { serveManifold } from '@lakudemis/render3d/worker';
 * serveManifold();
 * ```
 */
export function serveManifold(scope: WorkerScope = globalThis as unknown as WorkerScope): void {
  let wasm: Promise<ManifoldToplevel> | null = null;
  scope.addEventListener('message', async (event) => {
    const { request, solids, wasmUrl } = event.data;
    try {
      wasm ??= Module({ locateFile: () => wasmUrl }).then((m) => {
        m.setup();
        return m;
      });
      const { meshes, problems } = meshSolids(await wasm, solids);
      if (problems.length) console.warn('manifold-3d:', problems);
      scope.postMessage(
        { request, meshes },
        meshes.flatMap((m) => [m.positions.buffer, m.indices.buffer]),
      );
    } catch (error) {
      scope.postMessage({ request, error: String(error) });
    }
  });
}
