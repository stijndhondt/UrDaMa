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
