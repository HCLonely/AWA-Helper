/**
 * @file I18nService
 * @description Configures the process-wide i18n catalog shared by Manager jobs and WebUI rendering.
 */
import * as i18n from 'i18n';

const initializeI18n = (language: string, catalogs: Record<string, Record<string, string>>): void => {
  i18n.configure({
    locales: Object.keys(catalogs),
    staticCatalog: catalogs,
    defaultLocale: 'zh',
    register: globalThis
  });
  i18n.setLocale(language);
};

export { initializeI18n };
