import { manifoldWasmUrl } from './manifold-kernel';

describe('where the 3D worker finds manifold.wasm', () => {
  it('next to the app, wherever the app is served from', () => {
    // GitHub Pages serves the app under /UrDaMa/ (its base href).
    expect(manifoldWasmUrl('https://stijndhondt.github.io/UrDaMa/')).toBe(
      'https://stijndhondt.github.io/UrDaMa/manifold.wasm',
    );
    expect(manifoldWasmUrl('http://localhost:4200/')).toBe('http://localhost:4200/manifold.wasm');
  });
});
