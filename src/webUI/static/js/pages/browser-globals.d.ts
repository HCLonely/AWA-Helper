declare const axios: typeof import('axios').default;
declare const dayjs: typeof import('dayjs').default;
declare const jsyaml: typeof import('js-yaml');

declare const I18n: Record<string, Record<string, string> | undefined>;
declare const lang: string;
declare function __(text: string, ...values: string[]): string;

declare namespace bootstrap {
  class Modal {
    constructor(element: string | Element);
    show(): void;
    hide(): void;
  }

  class Tooltip {
    constructor(element: Element);
  }
}
