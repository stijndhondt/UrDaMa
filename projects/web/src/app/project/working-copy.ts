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

const DB_NAME = 'urdama';
/** Where the working copy was kept before the app was called Urdama: read once, never written. */
const LEGACY_DB_NAME = 'lakudemis';
const STORE = 'working-copy';
const KEY = 'current';

function open(name = DB_NAME): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function readWorkingCopy(): Promise<WorkingCopy | null> {
  try {
    // None under the new name yet: the one kept under the app's earlier name carries over (the
    // next save writes it under the new name).
    return (await readFrom(DB_NAME)) ?? (await readFrom(LEGACY_DB_NAME));
  } catch {
    return null; // storage unavailable (private window, blocked site data): start fresh
  }
}

async function readFrom(name: string): Promise<WorkingCopy | null> {
  const db = await open(name);
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
      request.onsuccess = () => resolve((request.result as WorkingCopy | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
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
    // Closed after each write, so nothing holds the database open.
    db.close();
  } catch {
    // storage unavailable: the working copy just isn't kept
  }
}
