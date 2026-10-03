import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      testTimeout: 10_000,
      hookTimeout: 15_000,
    },
  }),
);
