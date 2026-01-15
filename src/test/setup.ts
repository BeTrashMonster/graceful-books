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
