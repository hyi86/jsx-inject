import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'bin',
  format: ['esm'],
  external: ['fast-glob', 'ts-morph', 'typescript', 'commander'],
  splitting: false,
  clean: true,
  treeshake: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
});
