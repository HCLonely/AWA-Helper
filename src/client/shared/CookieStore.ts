/** Minimal cookie-store contract required by authenticated platform contexts. */
export interface CookieStore {
  get(name: string): string | null;
  stringify(): string;
  update(setCookie: string[]): CookieStore;
}
