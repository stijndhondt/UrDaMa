import { defineConfig } from 'vitest/config';

// The meshing tests run manifold-3d (WASM) in plain Node.
export default defineConfig({
  test: { environment: 'node' },
});
