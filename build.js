const esbuild = require('esbuild');

// Bundle each JS file that needs to bridge
const entryPoints = [
  'src/shared.js',
  'src/attend.js',
  'src/host.js'
];

esbuild.buildSync({
  entryPoints,
  bundle: true,
  outdir: 'public/js',
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  minify: false,
  sourcemap: true,
});

console.log('Build complete');
