import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/gateway/server.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
});
