import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import type { Connect, Plugin } from 'vite'

/**
 * Subresource Integrity (SRI) Validation Plugin
 *
 * This plugin validates that external resources in HTML files include
 * integrity attributes to protect against CDN compromise attacks.
 *
 * IMPORTANT: Graceful Books is designed to be fully self-contained with
 * no external resources. This plugin serves as a safety net to catch
 * any accidentally added external resources without SRI protection.
 *
 * External resources requiring SRI validation:
 * - <script src="https://...">
 * - <link href="https://...">
 *
 * Excluded from validation:
 * - Local resources (src="/..." or href="/...")
 * - Data URIs
 * - Same-origin resources
 */
function sriValidationPlugin(): Plugin {
  return {
    name: 'sri-validation',
    enforce: 'post',
    transformIndexHtml(html) {
      const warnings: string[] = []

      // Regex patterns to find external resources
      const externalScriptPattern = /<script[^>]+src=["'](https?:\/\/[^"']+)["'][^>]*>/gi
      const externalLinkPattern = /<link[^>]+href=["'](https?:\/\/[^"']+)["'][^>]*>/gi

      // Check for external scripts without integrity attribute
      let match
      while ((match = externalScriptPattern.exec(html)) !== null) {
        const fullTag = match[0]
        const url = match[1]

        if (!fullTag.includes('integrity=')) {
          warnings.push(
            `SECURITY WARNING: External script lacks SRI integrity attribute!\n` +
            `  URL: ${url}\n` +
            `  Fix: Add integrity="sha384-..." crossorigin="anonymous"\n` +
            `  Generate hash: node scripts/generate-sri.js "${url}"`
          )
        }
      }

      // Check for external stylesheets without integrity attribute
      while ((match = externalLinkPattern.exec(html)) !== null) {
        const fullTag = match[0]
        const url = match[1]

        // Only check stylesheet links
        if (fullTag.includes('rel="stylesheet"') || fullTag.includes("rel='stylesheet'")) {
          if (!fullTag.includes('integrity=')) {
            warnings.push(
              `SECURITY WARNING: External stylesheet lacks SRI integrity attribute!\n` +
              `  URL: ${url}\n` +
              `  Fix: Add integrity="sha384-..." crossorigin="anonymous"\n` +
              `  Generate hash: node scripts/generate-sri.js "${url}"`
            )
          }
        }
      }

      // Log warnings during build
      if (warnings.length > 0) {
        console.warn('\n' + '='.repeat(70))
        console.warn('SUBRESOURCE INTEGRITY (SRI) VALIDATION WARNINGS')
        console.warn('='.repeat(70))
        warnings.forEach(warning => {
          console.warn('\n' + warning)
        })
        console.warn('\n' + '='.repeat(70))
        console.warn('Graceful Books should be fully self-contained.')
        console.warn('Consider bundling these resources locally instead of using CDNs.')
        console.warn('='.repeat(70) + '\n')
      }

      return html
    }
  }
}

// Security headers for development server
// These headers protect against XSS, clickjacking, and other web vulnerabilities
const securityHeadersMiddleware: Connect.NextHandleFunction = (_req, res, next) => {
  // Content Security Policy - prevents XSS and data injection attacks
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'"
  )
  // X-Frame-Options - prevents clickjacking (legacy browser support)
  res.setHeader('X-Frame-Options', 'DENY')
  // X-Content-Type-Options - prevents MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff')
  // Referrer-Policy - protects user privacy
  res.setHeader('Referrer-Policy', 'no-referrer')
  // Permissions-Policy - restricts browser feature access
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  // Note: Strict-Transport-Security is typically not set in development
  // as it requires HTTPS and could cause issues with localhost
  next()
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'security-headers',
      configureServer(server) {
        server.middlewares.use(securityHeadersMiddleware)
      },
    },
    // SRI validation - warns about external resources without integrity attributes
    sriValidationPlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@lib': path.resolve(__dirname, './src/lib'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@types': path.resolve(__dirname, './src/types'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@services': path.resolve(__dirname, './src/services'),
      '@store': path.resolve(__dirname, './src/store'),
      // Mock brain.js to avoid native compilation requirements
      'brain.js': path.resolve(__dirname, './src/__mocks__/brain.js.ts'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'db-vendor': ['dexie', 'dexie-react-hooks'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    // Exclude E2E tests from unit test suite (run with Playwright instead)
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e/**', // E2E tests run with Playwright, not Vitest
      '**/*.spec.ts', // .spec.ts files are E2E tests
      '**/*.spec.tsx', // .spec.tsx files are E2E tests
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/*.spec.tsx',
        '**/types/',
        '**/*.d.ts',
        'vite.config.ts',
        'playwright.config.ts',
      ],
      all: true,
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
    },
  },
})
