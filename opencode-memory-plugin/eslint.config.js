// ESLint 配置 - OpenCode Memory Plugin
// ESLint v10 新格式

import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    rules: {
      // 🚨 错误级别 (Error)
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'no-undef': 'error',
      'no-console': 'off',
      'no-debugger': 'error',
      'no-var': 'error',
      'prefer-const': 'error',

      // ⚠️ 警告级别 (Warning)
      'no-unused-expressions': 'warn',
      'no-shadow': 'warn',
      'prefer-arrow-callback': 'warn',
      'object-shorthand': 'warn',

      // 💡 建议级别 (Suggestion)
      'no-multiple-empty-lines': ['warn', { max: 2 }],
      'no-trailing-spaces': 'warn',
      'eol-last': 'warn',
    },
  },
  {
    files: ['bin/*.cjs'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    ignores: ['node_modules/', 'dist/', 'build/', 'coverage/', '*.min.js', '.opencode/'],
  },
];
