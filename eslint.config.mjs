import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import onlyWarn from 'eslint-plugin-only-warn';
import tseslint from 'typescript-eslint';

/**
 * A shared ESLint configuration for the repository.
 * @type {import("eslint").Linter.Config[]}
 * */
export const config = [
  {
    ignores: ['bin/**'],
  },
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
  {
    plugins: {
      onlyWarn,
    },
    rules: {
      'no-undef': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      quotes: ['error', 'single', { allowTemplateLiterals: false }],
    },
  },
];

export default config;
