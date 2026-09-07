/** Small native DOM facade shared by the WebUI pages. */
(() => {
  type DomInput = string | Element | Document | Window | EventTarget | null | undefined;
  type Listener = EventListenerOrEventListenerObject;
  const listeners = new WeakMap<EventTarget, Map<string, Listener[]>>();
  const storedData = new WeakMap<Element, Map<string, unknown>>();

  const boundLogArea = (element: Element): void => {
    const area = element.closest('#log-area');
    if (!area) {
      return;
    }
    let size = Array.from(area.children).reduce((total, child) => total + child.innerHTML.length, 0);
    while (area.firstElementChild && (area.childElementCount > 1000 || size > 256 * 1024)) {
      size -= area.firstElementChild.innerHTML.length;
      area.firstElementChild.remove();
    }
  };

  const parseHtml = (html: string): Element[] => {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return Array.from(template.content.children);
  };

  class NativeDom {
    [index: number]: Element;
    readonly elements: Element[];

    constructor(input: DomInput | Element[]) {
      if (Array.isArray(input)) {
        this.elements = input;
      } else if (typeof input === 'string') {
        const selector = input.replace(/:last(?![-\w(])/g, ':last-child').replace(/:first(?![-\w(])/g, ':first-child');
        this.elements = input.trim().startsWith('<') ? parseHtml(input) : Array.from(document.querySelectorAll(selector));
      } else if (input instanceof Element) {
        this.elements = [input];
      } else {
        this.elements = [];
      }
      this.elements.forEach((element, index) => {
        this[index] = element;
      });
    }

    get length(): number {
      return this.elements.length;
    }
    ready(callback: () => void): this {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback, { once: true });
      } else {
        callback();
      }
      return this;
    }
    each(callback: (index: number, element: Element) => void): this {
      this.elements.forEach((element, index) => callback(index, element));
      return this;
    }
    map(callback: (index: number, element: Element) => unknown): unknown[] {
      return this.elements.map((element, index) => callback(index, element));
    }
    find(selector: string): NativeDom {
      const visible = selector.endsWith(':visible');
      const normalized = visible ? selector.slice(0, -8) : selector;
      const found = this.elements.flatMap((element) => Array.from(element.querySelectorAll(normalized)));
      return new NativeDom(visible ? found.filter((element) => !element.hasAttribute('hidden') && getComputedStyle(element).display !== 'none') : found);
    }
    eq(index: number): NativeDom {
      return new NativeDom(this.elements[index] ? [this.elements[index]] : []);
    }
    parent(): NativeDom {
      return new NativeDom(this.elements.map((element) => element.parentElement).filter((element): element is HTMLElement => !!element));
    }
    children(selector?: string): NativeDom {
      const children = this.elements.flatMap((element) => Array.from(element.children));
      return new NativeDom(selector ? children.filter((element) => element.matches(selector)) : children);
    }
    prev(): NativeDom {
      return new NativeDom(this.elements.map((element) => element.previousElementSibling).filter((element): element is Element => !!element));
    }
    attr(name: string): string | undefined;
    attr(name: string, value: string | number): this;
    attr(attributes: Record<string, string>): this;
    attr(name: string | Record<string, string>, value?: string | number): string | undefined | this {
      if (typeof name === 'string' && value === undefined) {
        return this.elements[0]?.getAttribute(name) ?? undefined;
      }
      return this.each((_index, element) => {
        if (typeof name === 'string') {
          element.setAttribute(name, String(value));
        } else {
          Object.entries(name).forEach(([key, item]) => element.setAttribute(key, item));
        }
      });
    }
    removeAttr(name: string): this {
      return this.each((_index, element) => element.removeAttribute(name));
    }
    prop(name: string): unknown;
    prop(name: string, value: unknown): this;
    prop(name: string, value?: unknown): unknown | this {
      if (arguments.length === 1) {
        return this.elements[0] ? (this.elements[0] as unknown as Record<string, unknown>)[name] : undefined;
      }
      return this.each((_index, element) => {
        (element as unknown as Record<string, unknown>)[name] = value;
      });
    }
    val(): string | string[] | number | undefined;
    val(value: unknown): this;
    val(value?: unknown): string | string[] | number | undefined | this {
      const first = this.elements[0] as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | undefined;
      if (arguments.length === 0) {
        if (first instanceof HTMLSelectElement && first.multiple) {
          return Array.from(first.selectedOptions).map((option) => option.value);
        }
        return first?.value;
      }
      return this.each((_index, element) => {
        (element as HTMLInputElement).value = String(value ?? '');
      });
    }
    text(): string;
    text(value: unknown): this;
    text(value?: unknown): string | this {
      if (arguments.length === 0) {
        return this.elements.map((element) => element.textContent ?? '').join('');
      }
      return this.each((_index, element) => {
        element.textContent = String(value ?? '');
      });
    }
    html(): string;
    html(value: unknown): this;
    html(value?: unknown): string | this {
      if (arguments.length === 0) {
        return this.elements[0]?.innerHTML ?? '';
      }
      return this.each((_index, element) => {
        element.innerHTML = String(value ?? '');
        boundLogArea(element);
      });
    }
    append(content: string | Element | NativeDom): this {
      return this.each((parentIndex, element) => {
        if (typeof content === 'string') {
          element.insertAdjacentHTML('beforeend', content);
        } else {
          const nodes = content instanceof NativeDom ? content.elements : [content];
          nodes.forEach((node) => element.append(parentIndex === 0 ? node : node.cloneNode(true)));
        }
        boundLogArea(element);
      });
    }
    empty(): this {
      return this.html('');
    }
    show(): this {
      return this.each((_index, element) => {
        (element as HTMLElement).style.display = ''; element.removeAttribute('hidden');
      });
    }
    hide(): this {
      return this.each((_index, element) => {
        (element as HTMLElement).style.display = 'none';
      });
    }
    fadeIn(): this {
      return this.show();
    }
    fadeOut(): this {
      return this.hide();
    }
    css(name: string, value: string): this {
      return this.each((_index, element) => {
        (element as HTMLElement).style.setProperty(name, value);
      });
    }
    addClass(...names: string[]): this {
      return this.each((_index, element) => element.classList.add(...names));
    }
    removeClass(...names: string[]): this {
      return this.each((_index, element) => element.classList.remove(...names));
    }
    toggleClass(name: string, force?: boolean): this {
      return this.each((_index, element) => element.classList.toggle(name, force));
    }
    hasClass(name: string): boolean {
      return this.elements[0]?.classList.contains(name) ?? false;
    }
    remove(): this {
      return this.each((_index, element) => element.remove());
    }
    clone(): NativeDom {
      return new NativeDom(this.elements.map((element) => element.cloneNode(true) as Element));
    }
    before(content: Element | NativeDom): this {
      return this.insertAdjacent(content, 'beforebegin');
    }
    after(content: string | Element | NativeDom): this {
      if (typeof content === 'string') {
        return this.each((_index, element) => element.insertAdjacentHTML('afterend', content));
      }
      return this.insertAdjacent(content, 'afterend');
    }
    private insertAdjacent(content: Element | NativeDom, position: InsertPosition): this {
      const nodes = content instanceof NativeDom ? content.elements : [content];
      return this.each((index, element) => nodes.forEach((node) => element.insertAdjacentElement(position, (index === 0 ? node : node.cloneNode(true)) as Element)));
    }
    data(name: string): unknown;
    data(name: string, value: unknown): this;
    data(name: string, value?: unknown): unknown | this {
      const [first] = this.elements;
      if (arguments.length === 1) {
        return first ? storedData.get(first)?.get(name) : undefined;
      }
      return this.each((_index, element) => {
        const map = storedData.get(element) ?? new Map<string, unknown>();
        map.set(name, value);
        storedData.set(element, map);
      });
    }
    scrollTop(): number {
      return this.elements[0]?.scrollTop ?? window.scrollY;
    }
    on(event: string, handler: EventListener): this {
      return this.each((_index, element) => {
        element.addEventListener(event, handler);
        const map = listeners.get(element) ?? new Map<string, Listener[]>();
        map.set(event, [...(map.get(event) ?? []), handler]);
        listeners.set(element, map);
      });
    }
    off(event: string, _handler?: EventListener): this {
      return this.each((_index, element) => {
        const map = listeners.get(element);
        map?.get(event)?.forEach((handler) => element.removeEventListener(event, handler));
        map?.delete(event);
      });
    }
    click(handler: (this: Element, event: MouseEvent) => unknown): this {
      return this.on('click', handler as EventListener);
    }
    change(handler: (this: Element, event: Event) => unknown): this {
      return this.on('change', handler as EventListener);
    }
    submit(handler: (this: Element, event: SubmitEvent) => unknown): this {
      return this.on('submit', handler as EventListener);
    }
  }

  const dom = (input: DomInput | Element[]): NativeDom => new NativeDom(input);
  document.addEventListener('click', (event) => {
    const target = (event.target as Element | null)?.closest<HTMLElement>('[data-ui-toggle], [data-ui-dismiss]');
    if (!target) {
      return;
    }
    const toggle = target.dataset.uiToggle;
    if (toggle === 'dropdown') {
      target.parentElement?.querySelector('.dropdown-menu')?.classList.toggle('open');
    }
    if (toggle === 'collapse') {
      event.preventDefault();
      const selector = target.getAttribute('href') || target.dataset.uiTarget;
      if (selector) {
        document.querySelector(selector)?.classList.toggle('show');
      }
    }
    if (toggle === 'modal') {
      const selector = target.dataset.uiTarget;
      if (selector) {
        document.querySelector(selector)?.classList.add('open');
      }
    }
    if (target.dataset.uiDismiss) {
      target.closest('.modal')?.classList.remove('open');
    }
  });
  Object.assign(globalThis, { dom });
})();
