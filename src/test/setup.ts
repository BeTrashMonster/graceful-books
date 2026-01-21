import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import 'fake-indexeddb/auto'

// Cleanup after each test
afterEach(() => {
  cleanup()
  vi.clearAllMocks() // Clear all mock function calls between tests
})

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {}, // deprecated
    removeListener: () => {}, // deprecated
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  }),
})

// Mock rate limiter to always allow requests in tests
vi.mock('../utils/rateLimiter', () => ({
  rateLimiter: {
    async check() {
      return {
        allowed: true,
        waitTimeMs: 0,
      }
    },
  },
  CRYPTO_RATE_LIMITS: {
    keyDerivation: { maxRequests: 5, windowMs: 60000 },
    encryption: { maxRequests: 100, windowMs: 60000 },
    decryption: { maxRequests: 100, windowMs: 60000 },
  },
}))

// Mock argon2-browser for crypto tests
// Provides a working argon2 implementation in the test environment
if (typeof window !== 'undefined') {
  (window as any).argon2 = {
    ArgonType: {
      Argon2d: 0,
      Argon2i: 1,
      Argon2id: 2,
    },
    async hash(options: {
      pass: string
      salt: Uint8Array
      time: number
      mem: number
      parallelism: number
      hashLen: number
      type: number
    }) {
      // Use Web Crypto API to simulate argon2
      const encoder = new TextEncoder()
      const passBuffer = encoder.encode(options.pass)

      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        passBuffer,
        'PBKDF2',
        false,
        ['deriveBits']
      )

      const derivedBits = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: options.salt,
          iterations: options.time * 100000,
          hash: 'SHA-256',
        },
        keyMaterial,
        options.hashLen * 8
      )

      return {
        hash: new Uint8Array(derivedBits),
        hashHex: Array.from(new Uint8Array(derivedBits))
          .map(b => b.toString(16).padStart(2, '0'))
          .join(''),
      }
    },
  }
}

// Mock brain.js (neural network library)
// This allows tests to run without native compilation dependencies
vi.mock('brain.js', () => {
  class MockNeuralNetwork {
    private model: any = null

    constructor(_options?: any) {
      this.model = {}
    }

    train(data: any[], _options?: any) {
      // Store training data in mock model
      this.model = { trained: true, dataCount: data.length }
      return { error: 0.001, iterations: 100 }
    }

    async trainAsync(data: any[], _options?: any) {
      return this.train(data, _options)
    }

    run(input: any) {
      // Return mock predictions
      if (Array.isArray(input)) {
        return [0.8, 0.1, 0.1]
      }
      return { category1: 0.8, category2: 0.1, category3: 0.1 }
    }

    toJSON() {
      return this.model
    }

    fromJSON(json: any) {
      this.model = json
    }
  }

  return {
    NeuralNetwork: MockNeuralNetwork,
    default: {
      NeuralNetwork: MockNeuralNetwork,
    },
  }
})
