// Import security rules
const securityConfig = require('./.eslintrc.security.cjs');

module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', '.eslintrc.security.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        // IMPORTANT: Lazy-loaded route components appear unused to ESLint but are used by React Router.
        // Variables assigned from lazy() imports should NOT be prefixed with underscore.
        // They are consumed by the router configuration, just not in a way TypeScript detects.
        // To fix: Add '// eslint-disable-next-line @typescript-eslint/no-unused-vars' above the lazy import
        // DO NOT prefix with underscore or the import path breaks.
      },
    ],
    // Include security rules
    ...securityConfig.rules,
  },
  overrides: [
    // Test files have relaxed rules
    {
      files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx', '**/test/**', '**/__tests__/**'],
      rules: {
        'no-console': 'off',
      },
    },
  ],
}
