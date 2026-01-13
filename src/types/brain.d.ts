/**
 * Type declarations for brain.js
 */

declare module 'brain.js' {
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
    constructor(options?: NeuralNetworkOptions)

    train(data: TrainingData[], options?: TrainingOptions): any
    trainAsync(data: TrainingData[], options?: TrainingOptions): Promise<any>
    run(input: number[] | Record<string, number>): number[] | Record<string, number>
    toJSON(): any
    fromJSON(json: any): void
  }
}
