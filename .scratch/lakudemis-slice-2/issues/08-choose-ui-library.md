# 08: Choose the UI library (ADR)

**What to build:** The user tries both prototypes and chooses Taiga UI or Optimus. The choice and its reasons are recorded as ADR 0008 (a technology choice with lock-in and a real trade-off).

**Blocked by:** 06 Taiga UI prototype, 07 Optimus prototype

**Status:** done

- [x] The user has chosen a library.
- [x] ADR 0008 records the choice, the alternative and why.
- [x] The branch of the prototype that was not chosen is deleted.

## Comments

**2026-09-27, decision:** Optimus UI. The user found Taiga UI cramped and Optimus's flow better; the properties panel itself is badly designed in both and gets its own mockup (ticket 24). Icons: Iconify, one main set plus matching sets, bundled. Recorded in `docs/adr/0008-optimus-ui-component-library.md`; `prototype/taiga-ui` deleted, `prototype/optimus-ui` kept as the reference for ticket 09.
