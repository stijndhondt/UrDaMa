// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

/** Browser globals that must never appear in `core` (ADR 0003, ADR 0005). */
const DOM_GLOBALS = [
  'document',
  'window',
  'navigator',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'requestAnimationFrame',
  'HTMLElement',
  'HTMLCanvasElement',
  'CanvasRenderingContext2D',
].map((name) => ({ name, message: '`core` has no DOM (ADR 0005).' }));

module.exports = defineConfig([
  {
    ignores: [
      'dist/**',
      'out-tsc/**',
      '.angular/**',
      'node_modules/**',
      '.scratch/**',
      '.claude/**',
      '.agents/**',
    ],
  },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'lk', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'lk', style: 'kebab-case' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {},
  },
  // `core`: no DOM, and Angular only through the reactive wrapper (ADR 0003).
  {
    files: ['projects/core/**/*.ts'],
    ignores: ['projects/core/src/lib/reactive.ts'],
    rules: {
      'no-restricted-globals': ['error', ...DOM_GLOBALS],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@angular/*', '@angular/**'],
              message: '`core` may use Angular only through lib/reactive.ts (ADR 0003).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['projects/core/src/lib/reactive.ts'],
    rules: {
      'no-restricted-globals': ['error', ...DOM_GLOBALS],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@angular/core',
              allowImportNames: ['signal', 'computed', 'Signal', 'WritableSignal'],
              message: 'Only signal / computed may be used in `core` (ADR 0003).',
            },
          ],
          patterns: [
            {
              group: ['@angular/*', '!@angular/core'],
              message: 'Only @angular/core signals (ADR 0003).',
            },
          ],
        },
      ],
    },
  },
]);
