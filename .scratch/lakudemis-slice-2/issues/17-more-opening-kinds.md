# 17: Wall openings and garage doors

**What to build:** Two new built-in Opening families: a plain wall opening (no frame, no leaf) and a garage door. The Opening tool in the floating toolbar gets a flyout listing the Opening types; the chosen type is placed with the distances to both inside corners, as today. Each kind has its plan symbol, its 3D form and correct quantities.

**Blocked by:** 16 Opening model: families, types, migration, 09 Workspace shell

**Status:** done

- [x] A wall opening and a garage door can be placed; each cuts its Wall and counts in net Wall face areas and reveals (store tests).
- [x] The flyout lists all Opening types; the chosen one is placed; its plan symbol and 3D form match its kind.
- [x] The old D / N shortcuts still place a door / window.
- [x] All new UI text exists in English and Dutch.

## Comments

**2026-09-28, built:** two new Opening kinds (`wallOpening`, `garageDoor`), each with a built-in family (`ofm_wall_opening`, `ofm_garage_door`) and a default type (0,90 × 2,11 m; 2,40 × 2,125 m); schema 3 adds them to older files (tested with a real schema 2 fixture). `addOpening` can place a chosen Opening type. A sill reveal now counts for any Opening that starts above the floor (it was windows only). The tool bar has a tool per kind (door D, window N; the two new ones without a key) and a flyout listing every Opening type by kind; a type chosen there is placed with its sizes, a tool chosen by button or key places the kind's default size. Plan symbols: a wall opening shows its head dashed along both faces; a garage door its door in the middle of the Wall and its overhead track dashed into the Room. 3D cuts them as holes, like doors and windows (parts come with ticket 19). The tool bar scrolls sideways in a narrow Plan panel. Checked in the browser: the flyout, a garage door placed from it, a door with D, a wall opening from its button, all three in 3D.
