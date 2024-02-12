const commonjs  = require('@rollup/plugin-commonjs');
const { nodeResolve } = require('@rollup/plugin-node-resolve');
const json = require('@rollup/plugin-json');

module.exports = {
  input: 'dist/main.js',
  output: {
    dir: 'output',
    format: 'cjs'
  },
  plugins: [nodeResolve({
    preferBuiltins: true,
    exportConditions: ['node']
  }), commonjs(), json()]
};
