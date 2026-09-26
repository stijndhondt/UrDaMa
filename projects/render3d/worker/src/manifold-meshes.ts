/**
 * Solids to meshes with manifold-3d: each prism is extruded from its plan rings, and a Wall's
 * Openings are subtracted from it, so holes are clean and every result is a closed (manifold)
 * solid. Runs wherever the WASM module was loaded: in the Web Worker, or in Node for tests.
 */
import { solidRef, type BuildingSolids, type Prism } from '@lakudemis/core';
import type { Manifold, ManifoldToplevel } from 'manifold-3d/manifold';
import type { ElementMesh } from './protocol';

function prism(wasm: ManifoldToplevel, p: Prism): Manifold {
  const section = new wasm.CrossSection(
    p.rings.map((ring) => ring.map((v) => [v.x, v.y] as [number, number])),
    'EvenOdd',
  );
  const solid = section.extrude(p.top - p.bottom).translate(0, 0, p.bottom);
  section.delete();
  return solid;
}

/** The mesh of each solid, plus whether manifold reported any problem with it. */
export function meshSolids(
  wasm: ManifoldToplevel,
  input: BuildingSolids,
): { meshes: ElementMesh[]; problems: string[] } {
  const meshes: ElementMesh[] = [];
  const problems: string[] = [];
  for (const solid of input.solids) {
    if (solid.body.top - solid.body.bottom <= 0) continue;
    let shape = prism(wasm, solid.body);
    if (solid.kind === 'wall' && solid.cuts.length) {
      const cuts = solid.cuts.map((c) => prism(wasm, c));
      const all = wasm.Manifold.union(cuts);
      const cut = shape.subtract(all);
      [shape, all, ...cuts].forEach((m) => m.delete());
      shape = cut;
    }
    const status = shape.status();
    if (status !== 'NoError') problems.push(`${solid.kind} ${solid.id}: ${status}`);
    if (!shape.isEmpty()) {
      const mesh = shape.getMesh();
      const positions = new Float32Array(mesh.numVert * 3);
      for (let i = 0; i < mesh.numVert; i++) {
        positions[i * 3] = mesh.vertProperties[i * mesh.numProp]!;
        positions[i * 3 + 1] = mesh.vertProperties[i * mesh.numProp + 1]!;
        positions[i * 3 + 2] = mesh.vertProperties[i * mesh.numProp + 2]!;
      }
      meshes.push({
        ...solidRef(solid),
        positions,
        indices: new Uint32Array(mesh.triVerts),
      });
    }
    shape.delete();
  }
  return { meshes, problems };
}
