# 23: In-place length editor on double-click

**What to build:** Double-clicking a Wall's length label on the plan (with any tool) opens a compact in-place editor at the label: the length field with the direction (towards start / both / towards end, shown as plan-direction icons) and the mode (Move Room / Only this Wall) as small icon toggles with tooltips. Enter applies, Esc cancels, one undo step. The mode remembers the last choice (Move Room the first time), shared between this editor and the properties panel, kept per browser. This replaces the single click on the label from ticket 02, so a single click can select as usual.

**Blocked by:** 09 Workspace shell, 24 Properties panel design

**Status:** ready-for-agent

- [ ] Double-clicking a length label opens the editor at the label with that Wall selected; a single click only selects.
- [ ] Direction and mode are icon toggles with tooltips; the mode starts as the last one used (Move Room on first use) in both the editor and the panel.
- [ ] Enter applies the same command as the panel; Esc and clicking elsewhere close without a change; Enter without typing changes nothing.
- [ ] Verified in the browser on the reference house; all new text in English and Dutch.

## Comments

**2026-09-27:** from the user's review of the prototypes: "changing the length is not straightforward (we default to room mode for some reason); a double-click on the length should give an in-place editor with the selections." Decisions: double-click on the length label only; the mode remembers the last choice.
