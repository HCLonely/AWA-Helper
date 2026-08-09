/**
 * @file src/tools/i18n/I18nService.ts
 * @description 初始化进程级 i18n 目录，并为 Manager 作业与 WebUI 提供翻译函数。
 */
import * as i18n from 'i18n';

/**
 * 初始化 initialize I18n 相关数据。
 * @param language - 需要加载的本地化语言代码，类型为 `string`。
 * @param catalogs - 需要遍历或处理的数据集合，类型为 `Record<string, Record<string, string>>`。
 * @returns `void`，该函数仅执行副作用，不返回值。
 */
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
