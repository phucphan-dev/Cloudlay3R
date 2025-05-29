const esbuild = require('esbuild');

// Bundle main process (electron.ts)
esbuild.build({
  entryPoints: ['src/electron/**/*'],
  bundle: true,
  platform: 'node',
  outdir: 'public',
  external: ['electron', 'electron-store'],
  target: ['node20'],
}).catch(() => process.exit(1));

// Build preload script (preload.ts) thành file riêng, không bundle
esbuild.build({
  entryPoints: ['src/electron/preload.ts'],
  bundle: false, // Không bundle, chỉ transpile
  platform: 'node',
  outfile: 'public/preload.js',
  target: ['node20'],
}).catch(() => process.exit(1));