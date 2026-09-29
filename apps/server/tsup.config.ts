import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['index.ts'],
  format: ['esm'],
  clean: true,
  noExternal: ['@platform/sdk-core'],
});
