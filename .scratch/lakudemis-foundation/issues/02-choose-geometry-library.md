# Choose a geometry library

Type: research
Status: resolved
Blocked by:
Parent: [Lakudemis foundation & Slice 1](../map.md)

## Question

Which geometry library (or combination of libraries) should the Lakudemis core use for:

- 2D polygon booleans and offsets
- wall joins (L/T/X)
- finding polygons in a network of lines (room detection)
- 3D extrusion and booleans (openings cut into Walls)

Compare the candidates on:

- robustness and numerical tolerance
- how it runs in the browser: pure TypeScript/JS, or C++ compiled to WASM. Hand-written C/C++ is ruled out, but using a WASM build must be weighed as a trade-off.
- bundle size
- maintenance activity
- **licence compatibility with GPL-3.0/AGPL-3.0**

Research: branch `research/geometry-library`, file `Docs/research/geometry-library.md`.

## Answer

- **2D booleans, offsets and areas:** `clipper2-ts`, a pure TypeScript port of Clipper2 (about 122 KiB). It works on integer coordinates internally, supports four offset join styles and passes the Clipper2 reference tests. Fallback: `clipper2-wasm` runs the same algorithm, if speed ever becomes a problem. Risk: essentially one maintainer, so keep it behind a thin wrapper.
- **Wall joins and room detection:** no library does either, so we write both in our own TypeScript. They are the core domain algorithms anyway.
  - **Joins:** intersect the walls' face lines at each node where walls meet.
  - **Room detection:** split lines where they cross, build a half-edge graph and walk its faces.
  - **Support:** `robust-predicates` for exact geometric tests; Clipper2 for clean-up and net area.
  - **Test oracle:** JSTS `Polygonizer`, under its EDL-1.0 licence, in dev dependencies only.
- **3D extrusion and openings:** `manifold-3d` (Apache-2.0, about 529 KiB of **C++ compiled to WASM**). It is the only candidate that guarantees watertight (manifold) output, and it is used by OpenSCAD, Blender and Babylon.js. Load it lazily in a Web Worker, behind an interface. **Flag:** it is C++ compiled to WASM, which is the trade-off the Notes asked to surface. We would not write any C++ ourselves, and there is no pure-TypeScript candidate with the same guarantees. [Stack, licence and repository layout](12-stack-licence-repo-layout.md) must accept or reject this.
- **Rejected:**
  - polygon-clipping and martinez: no offsetting.
  - flatten-js: relies on a float tolerance.
  - turf: built for geographic coordinates.
  - three-bvh-csg: output not guaranteed manifold.
  - opencascade.js and replicad: 22–64 MiB and a stale release.
  - CGAL: no official WASM build.
  - verb: a NURBS library, not a solid kernel.
- **Licences:** all compatible with GPL-3/AGPL-3. Apache-2.0 rules out GPL-2.
- **Suggested validation prototypes:** T/X joins with unequal thicknesses; fuzzing our room detection against JSTS; timing openings cut by `manifold-3d` in a Web Worker.

Findings: branch `research/geometry-library` (commit 052d59d), `Docs/research/geometry-library.md`.
