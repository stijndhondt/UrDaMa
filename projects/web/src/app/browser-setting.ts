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

/** A remembered list of strings (e.g. IDs), empty when there is none. */
export function readList(key: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
