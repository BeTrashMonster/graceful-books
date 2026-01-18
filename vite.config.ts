import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import type { Connect } from 'vite'

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
