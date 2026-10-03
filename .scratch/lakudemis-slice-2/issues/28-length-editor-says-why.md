# 28: Length editor says why a typed length is not taken

**What to build:** In the Wall length editor (panel and plan), a length that can't be read ("0", "abc", "-1") is now ignored without a word: Enter does nothing and the editor stays open. Show the reason near the editor, as a refused command does ("Type a length above 0, such as 2.70 or 2700"), in English and Dutch.

**Blocked by:** none

**Status:** needs-triage

- [ ] "0", text and negative numbers show a reason near the editor; the model is unchanged.
- [ ] All new text exists in English and Dutch.

## Comments

**2026-10-03:** found in the Slice 2 acceptance run (ticket 22, story 9).
