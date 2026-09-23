/**
 * @file rollup.config.mjs
 * @description 配置运行时代码打包、依赖处理与资源内联。
 */
import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';
import { importAsString } from 'rollup-plugin-string-import';
import terser from '@rollup/plugin-terser';

const application = {
  input: 'dist/index.js',
  // Undici 会按条件使用 Node 22.13 及以上版本内置的 SQLite 缓存存储。
  // 与其他 Node 内置模块一样，将其标记为外部依赖，避免打入包中。
  external: (id) => id.includes('node:sqlite'),
  output: {
    dir: 'output',
    format: 'cjs'
  },
  plugins: [
    terser({
      format: {
        comments: false
      }
    }),
    nodeResolve({
      preferBuiltins: true,
      exportConditions: ['node']
    }),
    commonjs(),
    json(),
    importAsString({
      include: ['**/*.html', '**/*.yml', '**/CHANGELOG.txt', '**/icon.ico']
    })]
};


export default [application, {
  input: 'dist/healthcheck.js',
  output: {
    file: 'output/healthcheck.js',
    format: 'cjs'
  },
  plugins: [nodeResolve({
    preferBuiltins: true,
    exportConditions: ['node']
  }), commonjs(), terser()]
}];
