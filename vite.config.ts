import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5180 },
  // MapLibre 6 starts its web worker from a file next to its own module (new URL(..., import.meta.url)).
  // Pre-bundling moves the module into .vite/deps and breaks that path, so it is served as is.
  optimizeDeps: { exclude: ['maplibre-gl'] },
  build: {
    // MapLibre is large on its own and loads with the first map, not with the shell.
    chunkSizeWarningLimit: 1600,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
