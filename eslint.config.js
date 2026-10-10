import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'public/pdfjs/**',
      // Installed agent tooling (ui-ux-pro-max), vendored by `uipro init`.
      // Not project source; ESLint does not read .gitignore.
      '.opencode/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-useless-assignment': 'off',
      'prefer-const': 'off',
      'preserve-caught-error': 'off',
    },
  },
);
