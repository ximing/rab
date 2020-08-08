import json from 'rollup-plugin-json';
import resolve from 'rollup-plugin-node-resolve';
import babel from 'rollup-plugin-babel';
import commonjs from 'rollup-plugin-commonjs';

export default {
  input: 'packages/greenjs-mp-transform/view/index.js',
  output: {
    file: 'bundle.js',
    format: 'cjs'
  },
  plugins: [
    json(),
    commonjs({
      include: ['packages/greenjs-mp-transform/view.js', 'node_modules/**'], // Default: undefined
      ignoreGlobal: false, // Default: false
      sourceMap: false // Default: true
    }),
    resolve({
      jsnext: true,
      main: false
    }),
    babel({ exclude: 'node_modules/**' })
  ]
};
