import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    base: env.VITE_BASE_PATH || '/',
    root: 'src',
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
            if (id.includes('chart.js')) return 'charts';
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
  };
});
