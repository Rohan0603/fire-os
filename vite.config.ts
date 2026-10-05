import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  root: 'src',
  publicDir: '../public',
  envDir: '../',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          // Loaded only when the Assistant tab opens; keep it out of the
          // initial vendor chunk.
          if (id.includes('deep-chat')) return undefined;
          if (id.includes('firebase/auth')) return 'firebase-auth';
          if (id.includes('firebase/firestore')) return 'firebase-firestore';
          if (id.includes('firebase/app')) return 'firebase-core';
          if (id.includes('firebase')) return 'firebase-shared';
          return 'vendor';
        },
      },
    },
  },
  server: {
    port: 5173,
    open: false,
    cors: true,
  },
});
