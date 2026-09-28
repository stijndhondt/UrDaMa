# 23: In-place length editor on double-click

**What to build:** Double-clicking a Wall's length label on the plan (with any tool) opens a compact in-place editor at the label: the length field with the direction (towards start / both / towards end, shown as plan-direction icons) and the mode (Move Room / Only this Wall) as small icon toggles with tooltips. Enter applies, Esc cancels, one undo step. The mode remembers the last choice (Move Room the first time), shared between this editor and the properties panel, kept per browser. This replaces the single click on the label from ticket 02, so a single click can select as usual.

**Blocked by:** 09 Workspace shell, 24 Properties panel design

**Status:** done

- [x] Double-clicking a length label opens the editor at the label with that Wall selected; a single click only selects.
- [x] Direction and mode are icon toggles with tooltips; the mode starts as the last one used (Move Room on first use) in both the editor and the panel.
- [x] Enter applies the same command as the panel; Esc and clicking elsewhere close without a change; Enter without typing changes nothing.
- [x] Verified in the browser on the reference house; all new text in English and Dutch.

## Comments

**2026-09-27:** from the user's review of the prototypes: "changing the length is not straightforward (we default to room mode for some reason); a double-click on the length should give an in-place editor with the selections." Decisions: double-click on the length label only; the mode remembers the last choice.

**2026-09-28, built:** a double click on a length label (any tool) cancels what the tool began, selects the Wall and opens `lk-length-editor` at the label (kept inside the plan, focused without scrolling the plan); it shows and takes that face's length, and the Baseline changes by the same amount. A single click on a label only selects the Wall; the old single-click typed box in the Select tool is gone. Enter applies (one command, one undo step), Esc or a click elsewhere on the plan closes without a change, Enter without typing changes nothing. Direction and mode are icon toggles with tooltips; the mode is shared with the properties panel and remembered per browser. `lengthLabelAt` (editor2d hit-test) is tested. Checked in the browser: 3,28 → 3,50 m outside face (Room 1 12,00 → 12,88 m²) with the Room tool active, a single click selecting only, Esc closing.

Done together with it (the user's request): the plan drawing takes its colours from the app's theme (`EditorHost.colors`, `PlanColors`; `--plan-*` variables in styles.css on Optimus's tokens), so the plan follows light and dark too; the plan's typed-size box uses the app's colour variables.
