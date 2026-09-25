import { defineConfig } from 'vitest/config';

// `core` must work without a browser: its tests run in plain Node, not jsdom.
export default defineConfig({
  test: { environment: 'node' },
});
