const commonjs  = require('@rollup/plugin-commonjs');
const { nodeResolve } = require('@rollup/plugin-node-resolve');
const json = require('@rollup/plugin-json');
const { string } = require('rollup-plugin-string');
const terser = require('@rollup/plugin-terser');

module.exports = {
  input: 'dist/main.js',
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
    }), commonjs(), json(), string({
      include: ['**/*.html', '**/*.yml', '**/CHANGELOG.txt']
    })]
};
