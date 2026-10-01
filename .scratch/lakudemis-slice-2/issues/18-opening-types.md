# 18: Opening types and "only this one"

**What to build:** Opening types can be added to a family, renamed and deleted (refused while Openings use them). Editing a placed Opening's type sizes asks whether the change applies to all Openings of that type or only this one; "only this one" detaches the Opening into a new type with a readable name such as "Front door (2)".

**Blocked by:** 17 Wall openings and garage doors

**Status:** done

- [x] A type change reaches every Opening of that type and no other (store test).
- [x] "Only this one" creates a new type, reassigns the Opening, and leaves the other Openings unchanged (store test).
- [x] Deleting a type in use is refused with a reason (store test).
- [x] The properties panel shows the Opening's type, its own fields (position, hinge, swing, sill) and the type's sizes with the all / only-this-one choice.
- [x] All new UI text exists in English and Dutch.

## Comments

**2026-10-01, built:** commands `addOpeningType`, `renameOpeningType` (an empty name shows the sizes again), `deleteOpeningType` (refused while Openings use it, saying how many), `updateOpeningType` (new sizes for every Opening of the type) and `setOpeningType` (another type of the same family). "Only this one" is UpdateOpening with a new size: a named type detaches into "Front door (2)" (the first free number), an unnamed one moves to the unnamed type of that size, as before; named types are never picked by size. The properties panel's Type section has a type picker, the type's sizes and a Types… dialog (rename, change sizes for all, add, delete; delete is disabled with the reason for a type in use). Changing a size asks "all N / only this one" when other Openings share the type, and changes the type directly when this is its only Opening. Store tests for each command and the detaching names. Checked in the browser.
