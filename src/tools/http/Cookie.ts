/** Mutable cookie collection with Set-Cookie and request-header conversion helpers. */
export class Cookie {
  private cookie: cookies;

  static ToJson(data: string | string[] | null | undefined): cookies {
    if (typeof data === 'string') {
      return Object.fromEntries(data.split(';').flatMap((text) => {
        const cookie = text.trim();
        const separator = cookie.indexOf('=');
        return separator <= 0 ? [] : [[cookie.slice(0, separator).trim(), cookie.slice(separator + 1).trim()]];
      }));
    }
    if (Array.isArray(data)) return Object.fromEntries(data.flatMap((value) => Object.entries(this.ToJson(value.split(';')[0]))));
    return {};
  }

  static ToString(data: object | string[]): string {
    const values = Array.isArray(data) ? this.ToJson(data) : data;
    return Object.entries(values).map(([name, value]) => `${name}=${value}`).join(';');
  }

  constructor(data?: string | string[] | cookies) {
    this.cookie = typeof data === 'string' || Array.isArray(data) ? Cookie.ToJson(data) : data || {};
  }

  parse(): cookies { return this.cookie; }
  stringify(): string { return Cookie.ToString(this.cookie); }
  browserify() {
    return Object.entries(this.cookie).map(([name, value]) => ({ name, value, domain: '.alienwarearena.com', path: '/' }));
  }
  update(data: string | string[] | cookies): this {
    this.cookie = { ...this.cookie, ...(typeof data === 'string' || Array.isArray(data) ? Cookie.ToJson(data) : data) };
    return this;
  }
  remove(name: string): this { delete this.cookie[name]; return this; }
  get(name: string): string | null { return Object.hasOwn(this.cookie, name) ? this.cookie[name] : null; }
}
