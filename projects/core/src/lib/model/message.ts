/**
 * Text never comes out of `core` as a sentence: always a translation key plus parameters,
 * so the UI can show it in any language (ngx-translate, ADR 0005).
 */
export interface Message {
  readonly key: string;
  readonly params?: Readonly<Record<string, string | number>>;
}

export const message = (key: string, params?: Message['params']): Message =>
  params ? { key, params } : { key };
