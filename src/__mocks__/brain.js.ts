/**
 * Mock implementation of brain.js for testing
 *
 * Provides a simple mock neural network without requiring native compilation.
 * This allows tests to run without installing the actual brain.js package
 * which requires Python and node-gyp.
 */

export interface NeuralNetworkOptions {
  hiddenLayers?: number[]
  activation?: 'sigmoid' | 'relu' | 'leaky-relu' | 'tanh'
  learningRate?: number
}

export interface TrainingOptions {
  iterations?: number
  errorThresh?: number
  log?: boolean | ((stats: any) => void)
  logPeriod?: number
  learningRate?: number
  momentum?: number
  callback?: (stats: any) => void
  callbackPeriod?: number
  timeout?: number
}

export interface TrainingData {
  input: number[] | Record<string, number>
  output: number[] | Record<string, number>
}

export class NeuralNetwork {
  private model: any = null

  constructor(_options?: NeuralNetworkOptions) {
    this.model = {}
  }

  train(data: TrainingData[], options?: TrainingOptions) {
    // Store training data in mock model
    this.model = { trained: true, dataCount: data.length, options }
    return { error: 0.001, iterations: options?.iterations || 100 }
  }

  async trainAsync(data: TrainingData[], options?: TrainingOptions) {
    return this.train(data, options)
  }

  run(input: number[] | Record<string, number>): number[] | Record<string, number> {
    // Return mock predictions with highest confidence for first category
    if (Array.isArray(input)) {
      return [0.85, 0.10, 0.05]
    }

    // For object input, return predictions for each output key
    const keys = Object.keys(input)
    const result: Record<string, number> = {}
    keys.forEach((key, index) => {
      result[key] = index === 0 ? 0.85 : 0.10 / (keys.length - 1 || 1)
    })
    return result
  }

  toJSON() {
    return this.model
  }

  fromJSON(json: any) {
    this.model = json
  }
}

export default {
  NeuralNetwork,
}
