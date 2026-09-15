/** Standalone bundled probe: never imports Manager or creates runtime files. */
import { runHealthcheck } from './tools/process/healthcheck';

process.chdir(__dirname);
void runHealthcheck().then((healthy) => {
  process.exitCode = healthy ? 0 : 1;
});
