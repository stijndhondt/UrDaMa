# 18: Keep the working copy when the file handle can't be stored

**Found by:** 15 Slice 1 acceptance run (round-trip test with a stand-in file handle)

**What to build:** The working copy is stored in IndexedDB together with the project file's handle. If the handle can't be stored (it can't be structured-cloned), the whole write fails and is swallowed, so nothing of the working copy is kept, silently. Real File System Access handles clone fine, so this is hardening: store the working copy without the handle when the handle is the problem.

**Blocked by:** none

**Status:** done

- [x] When storing the handle fails, the working copy is stored without it (text, saved text, file name).
- [x] After a reload the project comes back; Save then asks where to save.
