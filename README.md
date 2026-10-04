# Urdama

**Every part. One model.** Urdama is an open-source, browser-based tool for drawing a house at the sizes you measured with a tape. It turns that drawing into one connected building model: 2D plans, a 3D view and surface calculations all come from the same model.

Status: in development. See [Slice 1](.scratch/lakudemis-slice-1/spec.md) for what is being built now.

## Running it

Requires **Node ≥ 24.15** and **pnpm 11** (both pinned with [Volta](https://volta.sh) in `package.json`).

```bash
pnpm install
pnpm start          # the app at http://localhost:4200
pnpm test           # all unit tests (Vitest)
pnpm lint
pnpm typecheck
```

Chromium browsers (Chrome, Edge) on desktop are supported.

## Layout

An Angular CLI monorepo; everything lives under `projects/`:

| Project | What it is |
|---|---|
| `core` | The building model, commands and undo, geometry, calculations and the project file. **No DOM, no UI.** It uses Angular only for `signal` / `computed`, in one module (ADR 0003). |
| `editor2d` | The Canvas2D plan editor and its drawing tools. |
| `render3d` | The three.js 3D view. |
| `web` | The Angular app: panels, storage and translation (English, Dutch). |

## Documentation

- [`CONTEXT.md`](CONTEXT.md): the domain glossary (Level, Wall, Room, Room separator, Preset, …).
- [`Docs/adr/`](Docs/adr): architecture decisions.
- [`Docs/idea.md`](Docs/idea.md): the long-term vision.

## Licence

[AGPL-3.0-or-later](LICENSE) (ADR 0006). If you run a modified Urdama for others over a network, you must share its source.
