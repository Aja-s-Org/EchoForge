/**
 * EchoForge Core Engine - Main Entry Point
 * 
 * This package provides the core engine functionality including:
 * - Voice cloning through f5-tts integration
 * - Audio processing utilities
 * - Memory management
 * - Python service integration
 * - Node.js N-API bindings for C++ functionality
 */

export * from './lib/core-engine';

// Voice Cloning Types and Interfaces
export * from './types';

// N-API Bindings for C++ functionality
export * from './lib/napi-binding';

/**
 * Core Engine Configuration
 */
export interface CoreEngineConfig {
  // Memory configuration
  maxHeapMB?: number;
  audioPoolSizeMB?: number;
  cleanupThresholdPercent?: number;
  
  // Voice cloning configuration
  f5ttsModelPath?: string;
  f5ttsVocoderPath?: string;
  useGPU?: boolean;
  pythonServicePath?: string;
  
  // Audio processing configuration
  targetSampleRate?: number;
  targetChannels?: number;
  normalizationThreshold?: number;
}

/**
 * Voice Cloning Interface
 */
export interface VoiceCloner {
  // Initialization
  initialize(config?: CoreEngineConfig): Promise<boolean>;
  isInitialized(): boolean;
  
  // Voice processing
  extractVoiceEmbedding(audioData: Buffer | string): Promise<number[]>;
  synthesizeSpeech(embedding: number[], text: string, language?: string, speed?: number): Promise<Buffer>;
  cloneVoice(audioData: Buffer | string, text: string, language?: string, speed?: number): Promise<Buffer>;
  
  // Model management
  loadModel(modelPath: string): Promise<boolean>;
  loadVocoder(vocoderPath: string): Promise<boolean>;
  
  // Memory management
  getMemoryUsage(): Promise<number>;
  clearCache(): Promise<void>;
  
  // Utility methods
  getVersion(): string;
}

/**
 * Audio Processor Interface
 */
export interface AudioProcessor {
  loadAudio(filePath: string): Promise<AudioData>;
  saveAudio(audioData: AudioData, filePath: string): Promise<boolean>;
  convertToMono(audioData: AudioData): AudioData;
  normalize(audioData: AudioData, targetLevel?: number): AudioData;
  resample(audioData: AudioData, targetSampleRate: number): AudioData;
  getAudioInfo(filePath: string): Promise<AudioInfo>;
}

/**
 * Audio Data Structure
 */
export interface AudioData {
  samples: number[];
  sampleRate: number;
  channels: number;
  duration?: number;
}

/**
 * Audio Information
 */
export interface AudioInfo {
  sampleRate: number;
  channels: number;
  duration: number;
  format: string;
  bitDepth: number;
}

/**
 * Core Engine Factory Interface
 * 
 * Defines the factory methods for creating engine components
 * Implementation is provided by the C++ addon
 */
export interface CoreEngineFactory {
  /**
   * Create a new voice cloner instance
   */
  createVoiceCloner(config?: CoreEngineConfig): Promise<VoiceCloner>;
  
  /**
   * Create a new audio processor instance
   */
  createAudioProcessor(): Promise<AudioProcessor>;
  
  /**
   * Get engine version
   */
  getVersion(): string;
  
  /**
   * Initialize core engine with configuration
   */
  initialize(config: CoreEngineConfig): Promise<boolean>;
  
  /**
   * Shutdown core engine and cleanup resources
   */
  shutdown(): Promise<void>;
  
  /**
   * Get memory usage statistics
   */
  getMemoryStatistics(): Promise<MemoryStatistics>;
}

/**
 * Memory Statistics
 */
export interface MemoryStatistics {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  peakBytes: number;
  allocationCount: number;
  deallocationCount: number;
  hitRate: number;
  componentStats: Record<string, ComponentMemoryStats>;
}

/**
 * Component Memory Statistics
 */
export interface ComponentMemoryStats {
  component: string;
  currentBytes: number;
  peakBytes: number;
  allocationCount: number;
  deallocationCount: number;
  averageAllocationSize: number;
}

// Export the core engine function from the original module
export { coreEngine } from './lib/core-engine';