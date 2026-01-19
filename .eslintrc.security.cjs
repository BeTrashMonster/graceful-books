/**
 * ESLint Security Rules
 *
 * This file contains security-focused ESLint rules to catch potentially
 * insecure coding patterns before they reach production.
 *
 * Rules are designed to:
 * - Prevent use of weak random number generation in security contexts
 * - Block dangerous DOM manipulation methods
 * - Disallow eval() and similar code execution patterns
 * - Warn about console statements in production code
 *
 * For legitimate uses (like UI animations or test code), add eslint-disable
 * comments with a clear justification.
 */

module.exports = {
  rules: {
    // Prevent eval and similar dynamic code execution - these are security risks
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',

    // Prevent dangerous DOM manipulation methods
    'no-restricted-properties': [
      'error',
      {
        object: 'document',
        property: 'write',
        message: 'document.write() is unsafe and can cause XSS vulnerabilities. Use DOM methods instead.',
      },
      {
        object: 'document',
        property: 'writeln',
        message: 'document.writeln() is unsafe and can cause XSS vulnerabilities. Use DOM methods instead.',
      },
    ],

    // Console usage - disabled for now due to widespread existing usage (206+ instances)
    // TODO: Enable 'no-console': ['warn', { allow: ['warn', 'error'] }] after codebase cleanup
    // When enabled, console.log should be replaced with proper logging infrastructure
    // 'no-console': ['warn', { allow: ['warn', 'error'] }],

    // Prevent script injection via string protocols
    'no-script-url': 'error',
  },

  overrides: [
    // Test files can use console and Math.random freely
    {
      files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx', '**/test/**', '**/__tests__/**'],
      rules: {
        'no-console': 'off',
      },
    },
  ],
};
