/**
 * The working copy (ticket 11 decisions): the open project, saved in the browser (IndexedDB)
 * after every command and restored when the app reopens. It holds the same text as the project
 * file, plus what is needed to know whether that file is up to date.
 */
export interface WorkingCopy {
  /** The project, exactly as `serializeProject` writes it. */
  readonly text: string;
  /** The text last saved to the project file (null: never saved). */
  readonly savedText: string | null;
  /** The file name last saved to or opened from. */
  readonly fileName: string | null;
  /** The file itself, when the browser lets us write back to it (File System Access API). */
  readonly fileHandle: FileSystemFileHandle | null;
}

const DB_NAME = 'lakudemis';
const STORE = 'working-copy';
const KEY = 'current';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function readWorkingCopy(): Promise<WorkingCopy | null> {
  try {
    const db = await open();
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
      request.onsuccess = () => resolve((request.result as WorkingCopy | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null; // storage unavailable (private window, blocked site data): start fresh
  }
}

export async function writeWorkingCopy(copy: WorkingCopy): Promise<void> {
  try {
    const db = await open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      try {
        store.put(copy, KEY);
      } catch {
        // The file handle can't be stored (not cloneable): keep the project without it, so a
        // reload still brings it back; Save then asks where to save.
        store.put({ ...copy, fileHandle: null }, KEY);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // storage unavailable: the working copy just isn't kept
  }
}
