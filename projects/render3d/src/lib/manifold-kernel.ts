import type { BuildingSolids } from '@urdama/core';
import type { BuildReply, BuildRequest } from '@urdama/render3d/worker';
import type { ElementMesh, SolidKernel } from './solid-kernel';

/**
 * The SolidKernel backed by manifold-3d in a Web Worker (ADR 0005). Only the newest request
 * counts: an older one still in flight resolves as 'superseded'.
 *
 * The app creates the Worker, from a module of its own that calls `serveManifold()` from
 * `@urdama/render3d/worker`, so the app's bundler packs it:
 *
 * ```ts
 * new ManifoldKernel(new Worker(new URL('./manifold.worker', import.meta.url), { type: 'module' }));
 * ```
 */
export class ManifoldKernel implements SolidKernel {
  private latest = 0;
  private readonly pending = new Map<
    number,
    (result: readonly ElementMesh[] | 'superseded' | Error) => void
  >();

  /**
   * @param worker A worker running `serveManifold()`
   * @param wasmUrl Where the app serves `manifold.wasm` (copied from the manifold-3d package)
   */
  constructor(
    private readonly worker: Worker,
    private readonly wasmUrl = '/manifold.wasm',
  ) {
    this.worker.addEventListener('message', (event: MessageEvent<BuildReply>) => {
      const reply = event.data;
      const resolve = this.pending.get(reply.request);
      this.pending.delete(reply.request);
      if (!resolve) return;
      if ('error' in reply) resolve(new Error(reply.error));
      else resolve(reply.request === this.latest ? reply.meshes : 'superseded');
    });
  }

  build(solids: BuildingSolids): Promise<readonly ElementMesh[] | 'superseded'> {
    const request = ++this.latest;
    for (const [older, resolve] of this.pending) {
      resolve('superseded');
      this.pending.delete(older);
    }
    return new Promise((resolve, reject) => {
      this.pending.set(request, (result) =>
        result instanceof Error ? reject(result) : resolve(result),
      );
      const message: BuildRequest = { request, solids, wasmUrl: this.wasmUrl };
      this.worker.postMessage(message);
    });
  }

  dispose(): void {
    this.worker.terminate();
    for (const resolve of this.pending.values()) resolve('superseded');
    this.pending.clear();
  }
}
