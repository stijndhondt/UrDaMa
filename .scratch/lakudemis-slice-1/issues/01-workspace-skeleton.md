# 01: Workspace skeleton

**What to build:** An empty Lakudemis app runs: an Angular CLI monorepo with the four projects (`core`, `editor2d`, `render3d`, `web`), pnpm, and Node ≥ 24.15 pinned with Volta. The `web` app shows an empty plan canvas with an English / Dutch language switch (ngx-translate + messageformat compiler, JSON files). All tooling is in place, so every later ticket lands on green checks. This is the prefactor for the whole slice. See the spec's "Milestones" (M0), ADR 0005 and ADR 0006.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `pnpm install`, `pnpm start`, build, lint and `ng test` (Vitest) all succeed from a fresh clone.
- [ ] TypeScript strict mode is on everywhere; ESLint + Prettier are configured.
- [ ] An ESLint rule fails the build when `core` imports the DOM or any Angular API other than `signal` / `computed` from `@angular/core` (and only from one wrapper module). A deliberate violation proves it.
- [ ] Pre-commit hooks run format, type check and tests.
- [ ] The app shows an empty canvas and switches between English and Dutch at runtime.
- [ ] The licence file is AGPL-3.0-or-later, and the README states it.
