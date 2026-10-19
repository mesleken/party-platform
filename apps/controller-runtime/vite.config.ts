import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/play/' : '/',
  plugins: [preact()],
  server: {
    port: 5174,
    strictPort: true,
  },
}));
