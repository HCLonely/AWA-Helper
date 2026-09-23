/**
 * @file src/healthcheck.ts
 * @description 独立打包的健康探针，不导入 Manager，也不创建运行时文件。
 */
import { runHealthcheck } from './tools/process/healthcheck';

process.chdir(__dirname);
void runHealthcheck().then((healthy) => {
  process.exitCode = healthy ? 0 : 1;
});
