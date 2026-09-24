# Technology stack and workspace

Lakudemis is a browser-first TypeScript app built as an **Angular CLI monorepo**: everything sits under `projects/` and pnpm is the package manager. The workspace has four projects:

- `core`: an Angular library, but with no DOM or UI
- `editor2d`: an Angular library
- `render3d`: an Angular library
- `web`: the Angular 22 app

We chose Angular because the author knows it, and because the planned desktop app (Electron) keeps Angular too. The main libraries were each picked by research or a prototype:

- **2D plan editor:** plain **Canvas2D** in a framework-free editor module, with an rbush spatial index. In the canvas-speed prototype it held a stable 60 fps where PixiJS dropped to ~45, with 3–4× lower drawing time per frame.
- **3D view:** **three.js**, behind our own thin adapter.
- **3D solids:** **manifold-3d**, which extrudes Wall solids and cuts openings. It is C++ compiled to WASM: accepted because we never write or build C++, it loads lazily in a Web Worker behind a `SolidKernel` interface, and no calculation depends on it.
- **2D geometry:** **clipper2-ts** plus `robust-predicates`. Wall joins and room detection are our own code.
- **Dependency engine:** Angular `signal()` / `computed()` inside `core` (ADR 0003).
- **Translation:** **ngx-translate** with JSON files and the messageformat compiler (ICU plurals, number formats). It won the translation trial against Transloco: equivalent features, a simpler signal API, and familiar to the author. Features keep their keys under a top-level prefix (`editor.*`, `panel.*`) because all files are merged at the root.

## Considered Options

- **PixiJS (WebGL) for the plan:** faster on tiny plans, but slower and less smooth under load in the prototype. It remains the named fallback behind the renderer interface.
- **Babylon.js for 3D:** the runner-up, worth revisiting when the 3D view becomes editable.
- **Transloco:** lazy per-feature scopes and more tooling, but more setup and a scope pitfall: a scope applies to everything in its component.
- **pnpm workspaces without Angular CLI projects:** rejected to match the author's existing monorepo layout.

## Consequences

- An ESLint rule keeps `projects/core` free of DOM and of Angular UI APIs. Only `signal` / `computed` are allowed, in one wrapper module.
- Tooling: TypeScript strict, ESLint + Prettier, Vitest via `ng test`, and local pre-commit hooks (format, type check, tests), because there is no CI server yet.
- **Node ≥ 24.15** is required by the Angular 22 CLI. Volta pins Node and pnpm in `package.json`.
- The build's first milestone benchmarks the real geometry (Clipper2 room detection) against the < 16 ms-per-edit target.
