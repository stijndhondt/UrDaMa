# 18: Opening types and "only this one"

**What to build:** Opening types can be added to a family, renamed and deleted (refused while Openings use them). Editing a placed Opening's type sizes asks whether the change applies to all Openings of that type or only this one; "only this one" detaches the Opening into a new type with a readable name such as "Front door (2)".

**Blocked by:** 17 Wall openings and garage doors

**Status:** ready-for-agent

- [ ] A type change reaches every Opening of that type and no other (store test).
- [ ] "Only this one" creates a new type, reassigns the Opening, and leaves the other Openings unchanged (store test).
- [ ] Deleting a type in use is refused with a reason (store test).
- [ ] The properties panel shows the Opening's type, its own fields (position, hinge, swing, sill) and the type's sizes with the all / only-this-one choice.
- [ ] All new UI text exists in English and Dutch.
