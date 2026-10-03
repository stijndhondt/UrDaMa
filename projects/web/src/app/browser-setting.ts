/**
 * A small per-browser setting (language, theme, length mode): a convenience, never project data.
 * Storage can be unavailable (private windows, blocked site data); the setting then lasts for the
 * session only.
 */
export function readSetting<T extends string>(key: string, allowed: readonly T[]): T | null {
  try {
    const v = localStorage.getItem(key);
    return (allowed as readonly string[]).includes(v ?? '') ? (v as T) : null;
  } catch {
    return null;
  }
}

export function writeSetting(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable: the setting isn't remembered
  }
}

/** A remembered JSON value, or null when there is none or it can't be read. */
export function readJson(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') as unknown;
  } catch {
    return null;
  }
}

/** Remembers a JSON value; without storage it lasts for the session only. */
export function writeJson(key: string, value: unknown): void {
  writeSetting(key, JSON.stringify(value));
}

/** A remembered list of strings (e.g. IDs), empty when there is none. */
export function readList(key: string): string[] {
  const v = readJson(key);
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}
