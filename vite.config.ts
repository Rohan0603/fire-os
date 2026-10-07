import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
    proxy: {
      '/api/assistant': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
});
