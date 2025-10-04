import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['./src/extension.ts'],
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  platform: 'node',
  target: 'node20',
  format: ['esm'],
  bundle: true,
  external: ['vscode'],
  noExternal: ['@rutan/mnsc'],
});
