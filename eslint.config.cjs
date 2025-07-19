const typescript = require('@typescript-eslint/eslint-plugin');
const parser = require('@typescript-eslint/parser');

/** @type {import('eslint').Linter.FlatConfig[]} */
module.exports = [
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/db-migration-scripts/**',
      '**/scripts/**',
      '**/config/**',
      '**/test-config/**',
      '**/tests/**',
      '**/.cleanup_backup/**',
      '**/cypress/**',
      '**/playwright-report/**',
      '**/logs/**',
      '**/migrations/**',
      '**/temp/**',
      '**/html/**',
      '**/audio-cache/**',
      '**/test-scripts/**',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
    },
    rules: {
      ...typescript.configs.recommended.rules,
      quotes: ['error', 'single'],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
    },
  },
  {
    files: ['**/*.js', '**/*.jsx'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      quotes: ['error', 'single'],
    },
  },
];
