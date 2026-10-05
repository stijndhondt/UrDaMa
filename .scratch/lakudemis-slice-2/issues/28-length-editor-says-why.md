# 28: Length editor says why a typed length is not taken

**What to build:** In the Wall length editor (panel and plan), a length that can't be read ("0", "abc", "-1") is now ignored without a word: Enter does nothing and the editor stays open. Show the reason near the editor, as a refused command does ("Type a length above 0, such as 2.70 or 2700"), in English and Dutch.

**Blocked by:** none

**Status:** done

- [x] "0", text and negative numbers show a reason near the editor; the model is unchanged.
- [x] All new text exists in English and Dutch.

## Comments

**2026-10-03:** found in the Slice 2 acceptance run (ticket 22, story 9).

**2026-10-05:** done. The reason shows under the field in the editor (panel and plan) and in the status bar; a refused length command shows there too, instead of as a plan note under the editor. The example reads "2700 or 2.70 m", since a bare number is mm.
