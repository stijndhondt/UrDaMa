import type { BuildingSolids } from '@lakudemis/core';
import type { ElementMesh, SolidKernel } from './solid-kernel';

type Reply =
  | { readonly request: number; readonly meshes: ElementMesh[] }
  | { readonly request: number; readonly error: string };

/**
 * The SolidKernel backed by manifold-3d in a Web Worker (ADR 0005). Only the newest request
 * counts: an older one still in flight resolves as 'superseded'.
 */
export class ManifoldKernel implements SolidKernel {
  private readonly worker = new Worker(new URL('./manifold.worker', import.meta.url), {
    type: 'module',
  });
  private latest = 0;
  private readonly pending = new Map<
    number,
    (result: readonly ElementMesh[] | 'superseded' | Error) => void
  >();

  /** @param wasmUrl Where the app serves `manifold.wasm` (copied from the manifold-3d package). */
  constructor(private readonly wasmUrl = '/manifold.wasm') {
    this.worker.addEventListener('message', (event: MessageEvent<Reply>) => {
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
      this.worker.postMessage({ request, solids, wasmUrl: this.wasmUrl });
    });
  }

  dispose(): void {
    this.worker.terminate();
    for (const resolve of this.pending.values()) resolve('superseded');
    this.pending.clear();
  }
}
