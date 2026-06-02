import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: false,
    minify: 'terser',
  },
  server: {
    port: 5173,
    open: true,
    cors: true,
  },
});
