/**
 * ESLint 配置 - OpenCode Memory Plugin
 */

module.exports = {
  root: true,

  env: {
    node: true,
    es2022: true,
  },

  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },

  extends: ['eslint:recommended'],

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

  ignorePatterns: ['node_modules/', 'dist/', 'build/', 'coverage/', '*.min.js', '.opencode/'],

  overrides: [
    {
      files: ['bin/*.cjs'],
      rules: {
        'no-console': 'off',
      },
    },
  ],
};
