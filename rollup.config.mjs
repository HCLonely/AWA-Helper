/*
 * @Author       : HCLonely
 * @Date         : 2024-09-11 15:27:10
 * @LastEditTime : 2025-08-28 10:43:47
 * @LastEditors  : HCLonely
 * @FilePath     : /AWA-Helper/rollup.config.js
 * @Description  : 打包配置
 */

import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';
import { importAsString } from 'rollup-plugin-string-import';
import terser from '@rollup/plugin-terser';

export default {
  input: 'dist/main.js',
  // Undici conditionally uses the Node 22.13+ built-in SQLite cache store.
  // Keep it external like the other Node built-ins instead of bundling it.
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
