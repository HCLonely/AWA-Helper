/** Uses the same server-injected locale catalog as the other WebUI pages. */
const SettingsI18n = (() => {
  function t(message: string, ...values: string[]): string {
    const locale = typeof lang === 'string' ? lang : 'en';
    const catalogs = typeof I18n === 'object' ? I18n : {};
    const translated = catalogs[locale]?.[`settings.${message}`] ?? catalogs.en?.[`settings.${message}`] ?? message;
    let index = 0;
    return translated.replace(/%s/g, () => values[index++] ?? '%s');
  }
  function localize(): void {
    document.documentElement.lang = typeof lang === 'string' && lang === 'zh' ? 'zh' : 'en';
    document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((item) => {
      item.textContent = t(item.dataset.i18n!);
    });
    for (const attribute of ['title', 'aria-label', 'placeholder']) {
      document.querySelectorAll(`[data-i18n-${attribute}]`).forEach((item) => {
        item.setAttribute(attribute, t(item.getAttribute(`data-i18n-${attribute}`)!));
      });
    }
  }
  return { t, localize };
})();
Object.assign(globalThis, { SettingsI18n });
