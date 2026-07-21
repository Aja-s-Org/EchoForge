/**
 * Node.js N-API Bindings for Voice Cloning Addon
 * 
 * This file provides the TypeScript bindings for the native C++ addon.
 * It loads the compiled .node binary and exposes a clean API.
 */

import { join } from 'path';
import { existsSync } from 'fs';
import { CoreEngineConfig, VoiceCloner, AudioProcessor, AudioData, AudioInfo, CoreEngineFactory, MemoryStatistics, ComponentMemoryStats } from '../types';

// Native addon interface - these match the C++ exports
interface NativeAddon {
  // Module functions
  getVersion(): string;
  checkSystemRequirements(): {
    libsndfile_available: boolean;
    portaudio_available: boolean;
    supported_formats: string[];
    platform: string;
    node_version: string;
  };
  loadAudioFile(filepath: string): AudioData;
  
  // VoiceCloner class constructor and methods
  VoiceCloner: {
    new(): VoiceClonerInstance;
  };
}

// Native VoiceCloner instance interface
interface VoiceClonerInstance {
  initialize(): boolean;
  isInitialized(): boolean;
  loadModel(modelPath: string): boolean;
  loadVocoder(vocoderPath: string): boolean;
  extractVoiceEmbedding(
    audio: Buffer | string | { samples: Buffer; sampleRate: number; channels: number },
    sampleRate?: number,
    channels?: number
  ): { embedding: number[]; dimension: number };
  synthesizeSpeech(
    embedding: number[] | { embedding: number[]; dimension: number },
    text: string,
    language?: string,
    speed?: number
  ): AudioData;
  cloneVoice(
    audio: Buffer | string | { samples: Buffer; sampleRate: number; channels: number },
    text: string,
    language?: string,
    speed?: number,
    sampleRate?: number,
    channels?: number
  ): {
    success: boolean;
    similarityScore: number;
    processingTimeMs: number;
    errorMessage: string;
    audio?: AudioData;
    embedding?: { embedding: number[]; dimension: number };
  };
  cloneVoiceAsync(
    audio: Buffer | string | { samples: Buffer; sampleRate: number; channels: number },
    text: string,
    callback: (error: Error | null, result: any) => void,
    language?: string,
    speed?: number,
    sampleRate?: number,
    channels?: number
  ): void;
  getMemoryUsage(): number;
  clearCache(): void;
  getVersion(): string;
}

// Try to load the native addon
let nativeAddon: NativeAddon;
let addonLoaded = false;
let loadError: string | null = null;

try {
  // Try multiple possible locations for the native addon
  const possiblePaths = [
    // Production build path
    join(__dirname, '../../../build/Release/voice_cloning_addon.node'),
    // Debug build path
    join(__dirname, '../../../build/Debug/voice_cloning_addon.node'),
    // CMake build path
    join(__dirname, '../../../../build/core-engine/lib/echoforge_core.node'),
    // Direct from project root
    join(__dirname, '../../../../../build/lib/echoforge_core.node'),
  ];

  let loadedPath: string | null = null;
  for (const path of possiblePaths) {
    if (existsSync(path)) {
      // Use require for .node files
      nativeAddon = require(path);
      loadedPath = path;
      addonLoaded = true;
      break;
    }
  }

  if (!addonLoaded) {
    // Try to require directly (might be in node_modules/.cache or similar)
    try {
      nativeAddon = require('voice_cloning_addon');
      addonLoaded = true;
    } catch (e) {
      loadError = `Native addon not found in any of the expected locations: ${possiblePaths.join(', ')}. Error: ${e instanceof Error ? e.message : String(e)}`;
    }
  } else {
    console.log(`Native addon loaded from: ${loadedPath}`);
  }
} catch (error) {
  loadError = `Failed to load native addon: ${error instanceof Error ? error.message : String(error)}`;
  addonLoaded = false;
}

/**
 * Check if the native addon is loaded
 */
export function isNativeAddonLoaded(): boolean {
  return addonLoaded;
}

/**
 * Get the load error if any
 */
export function getLoadError(): string | null {
  return loadError;
}

/**
 * Get addon version
 */
export function getVersion(): string {
  if (!addonLoaded) {
    throw new Error('Native addon not loaded: ' + (loadError || 'Unknown error'));
  }
  return nativeAddon.getVersion();
}

/**
 * Check system requirements
 */
export function checkSystemRequirements() {
  if (!addonLoaded) {
    throw new Error('Native addon not loaded: ' + (loadError || 'Unknown error'));
  }
  return nativeAddon.checkSystemRequirements();
}

/**
 * Load audio file
 */
export function loadAudioFile(filepath: string): AudioData {
  if (!addonLoaded) {
    throw new Error('Native addon not loaded: ' + (loadError || 'Unknown error'));
  }
  return nativeAddon.loadAudioFile(filepath);
}

/**
 * Voice Cloner Implementation
 */
export class NativeVoiceCloner implements VoiceCloner {
  private nativeInstance: VoiceClonerInstance;
  private config?: CoreEngineConfig;

  constructor(config?: CoreEngineConfig) {
    if (!addonLoaded) {
      throw new Error('Native addon not loaded: ' + (loadError || 'Unknown error'));
    }
    this.nativeInstance = new nativeAddon.VoiceCloner();
    this.config = config;
  }

  async initialize(config?: CoreEngineConfig): Promise<boolean> {
    if (config) {
      this.config = config;
    }
    return this.nativeInstance.initialize();
  }

  isInitialized(): boolean {
    return this.nativeInstance.isInitialized();
  }

  async extractVoiceEmbedding(audioData: Buffer | string): Promise<number[]> {
    if (!this.nativeInstance.isInitialized()) {
      throw new Error('VoiceCloner not initialized. Call initialize() first.');
    }

    if (typeof audioData === 'string') {
      // File path
      const result = this.nativeInstance.extractVoiceEmbedding(audioData);
      return result.embedding;
    } else if (Buffer.isBuffer(audioData)) {
      // Buffer - need sample rate and channels from config
      const sampleRate = this.config?.targetSampleRate || 22050;
      const channels = this.config?.targetChannels || 1;
      const result = this.nativeInstance.extractVoiceEmbedding(audioData, sampleRate, channels);
      return result.embedding;
    } else {
      throw new Error('Invalid audio data type. Expected Buffer or string file path.');
    }
  }

  async synthesizeSpeech(
    embedding: number[], 
    text: string, 
    language?: string, 
    speed?: number
  ): Promise<Buffer> {
    if (!this.nativeInstance.isInitialized()) {
      throw new Error('VoiceCloner not initialized. Call initialize() first.');
    }

    const audioData = this.nativeInstance.synthesizeSpeech(embedding, text, language, speed);
    return Buffer.from(audioData.samples);
  }

  async cloneVoice(
    audioData: Buffer | string, 
    text: string, 
    language?: string, 
    speed?: number
  ): Promise<Buffer> {
    if (!this.nativeInstance.isInitialized()) {
      throw new Error('VoiceCloner not initialized. Call initialize() first.');
    }

    let result;
    if (typeof audioData === 'string') {
      // File path
      result = this.nativeInstance.cloneVoice(audioData, text, language, speed);
    } else if (Buffer.isBuffer(audioData)) {
      // Buffer - need sample rate and channels from config
      const sampleRate = this.config?.targetSampleRate || 22050;
      const channels = this.config?.targetChannels || 1;
      result = this.nativeInstance.cloneVoice(audioData, text, language, speed, sampleRate, channels);
    } else {
      throw new Error('Invalid audio data type. Expected Buffer or string file path.');
    }

    if (!result.success) {
      throw new Error(`Voice cloning failed: ${result.errorMessage}`);
    }

    if (!result.audio) {
      throw new Error('Voice cloning succeeded but no audio data returned');
    }

    return Buffer.from(result.audio.samples);
  }

  async loadModel(modelPath: string): Promise<boolean> {
    return this.nativeInstance.loadModel(modelPath);
  }

  async loadVocoder(vocoderPath: string): Promise<boolean> {
    return this.nativeInstance.loadVocoder(vocoderPath);
  }

  async getMemoryUsage(): Promise<number> {
    return this.nativeInstance.getMemoryUsage();
  }

  async clearCache(): Promise<void> {
    this.nativeInstance.clearCache();
  }

  getVersion(): string {
    return this.nativeInstance.getVersion();
  }

  /**
   * Async version of cloneVoice that returns a Promise
   */
  async cloneVoiceAsync(
    audioData: Buffer | string, 
    text: string, 
    language?: string, 
    speed?: number
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      if (!this.nativeInstance.isInitialized()) {
        reject(new Error('VoiceCloner not initialized. Call initialize() first.'));
        return;
      }

      const callback = (error: Error | null, result: any) => {
        if (error) {
          reject(error);
        } else if (!result.success) {
          reject(new Error(`Voice cloning failed: ${result.errorMessage}`));
        } else if (!result.audio) {
          reject(new Error('Voice cloning succeeded but no audio data returned'));
        } else {
          resolve(Buffer.from(result.audio.samples));
        }
      };

      if (typeof audioData === 'string') {
        // File path
        this.nativeInstance.cloneVoiceAsync(audioData, text, callback, language, speed);
      } else if (Buffer.isBuffer(audioData)) {
        // Buffer - need sample rate and channels from config
        const sampleRate = this.config?.targetSampleRate || 22050;
        const channels = this.config?.targetChannels || 1;
        this.nativeInstance.cloneVoiceAsync(audioData, text, callback, language, speed, sampleRate, channels);
      } else {
        reject(new Error('Invalid audio data type. Expected Buffer or string file path.'));
      }
    });
  }
}

/**
 * Audio Processor Implementation
 */
export class NativeAudioProcessor implements AudioProcessor {
  async loadAudio(filePath: string): Promise<AudioData> {
    if (!addonLoaded) {
      throw new Error('Native addon not loaded: ' + (loadError || 'Unknown error'));
    }
    return loadAudioFile(filePath);
  }

  async saveAudio(audioData: AudioData, filePath: string): Promise<boolean> {
    // TODO: Implement saveAudio in C++ addon
    throw new Error('saveAudio not yet implemented in native addon');
  }

  convertToMono(audioData: AudioData): AudioData {
    // TODO: Implement in C++ or TypeScript
    if (audioData.channels === 1) {
      return { ...audioData };
    }
    
    // Simple downmix to mono (average channels)
    const samplesPerChannel = audioData.samples.length / audioData.channels;
    const mono: AudioData = {
      samples: new Array(samplesPerChannel),
      sampleRate: audioData.sampleRate,
      channels: 1,
      duration: audioData.duration
    };
    
    for (let i = 0; i < samplesPerChannel; i++) {
      let sum = 0;
      for (let c = 0; c < audioData.channels; c++) {
        sum += audioData.samples[i * audioData.channels + c];
      }
      mono.samples[i] = sum / audioData.channels;
    }
    
    return mono;
  }

  normalize(audioData: AudioData, targetLevel: number = 0.9): AudioData {
    // TODO: Implement in C++ or TypeScript
    // Find peak amplitude
    let maxAmplitude = 0;
    for (const sample of audioData.samples) {
      const absSample = Math.abs(sample);
      if (absSample > maxAmplitude) {
        maxAmplitude = absSample;
      }
    }
    
    if (maxAmplitude === 0) {
      return { ...audioData };
    }
    
    // Calculate scaling factor
    const scale = targetLevel / maxAmplitude;
    
    // Apply normalization
    const normalized: AudioData = {
      samples: audioData.samples.map(sample => sample * scale),
      sampleRate: audioData.sampleRate,
      channels: audioData.channels,
      duration: audioData.duration
    };
    
    return normalized;
  }

  resample(audioData: AudioData, targetSampleRate: number): AudioData {
    // TODO: Implement proper resampling in C++ addon
    // Simple linear interpolation for now
    if (audioData.sampleRate === targetSampleRate) {
      return { ...audioData };
    }
    
    const ratio = audioData.sampleRate / targetSampleRate;
    const newLength = Math.floor(audioData.samples.length / ratio);
    const resampled: AudioData = {
      samples: new Array(newLength),
      sampleRate: targetSampleRate,
      channels: audioData.channels,
      duration: audioData.duration ? (audioData.duration * ratio) : undefined
    };
    
    for (let i = 0; i < newLength; i++) {
      const srcIndex = i * ratio;
      const index1 = Math.floor(srcIndex);
      const index2 = Math.min(Math.ceil(srcIndex), audioData.samples.length - 1);
      
      if (index1 === index2) {
        resampled.samples[i] = audioData.samples[index1];
      } else {
        const fraction = srcIndex - index1;
        resampled.samples[i] = audioData.samples[index1] * (1 - fraction) + audioData.samples[index2] * fraction;
      }
    }
    
    return resampled;
  }

  async getAudioInfo(filePath: string): Promise<AudioInfo> {
    const audioData = await this.loadAudio(filePath);
    return {
      sampleRate: audioData.sampleRate,
      channels: audioData.channels,
      duration: audioData.duration || 0,
      format: 'unknown', // TODO: Parse from file extension
      bitDepth: 32 // Assuming float32
    };
  }
}

/**
 * Core Engine Factory Implementation
 */
export class NativeCoreEngineFactory implements CoreEngineFactory {
  private config?: CoreEngineConfig;
  private voiceCloners = new Map<string, NativeVoiceCloner>();
  private audioProcessors = new Map<string, NativeAudioProcessor>();

  async initialize(config: CoreEngineConfig): Promise<boolean> {
    this.config = config;
    // Check system requirements
    const requirements = checkSystemRequirements();
    
    // Check for required audio libraries
    if (!requirements.libsndfile_available) {
      console.warn('Warning: libsndfile not available. Audio file I/O may not work.');
    }
    
    if (!requirements.portaudio_available) {
      console.warn('Warning: PortAudio not available. Audio playback may not work.');
    }
    
    return true;
  }

  async createVoiceCloner(config?: CoreEngineConfig): Promise<VoiceCloner> {
    const clonerConfig = config || this.config;
    const cloner = new NativeVoiceCloner(clonerConfig);
    const id = Math.random().toString(36).substring(7);
    this.voiceCloners.set(id, cloner);
    return cloner;
  }

  async createAudioProcessor(): Promise<AudioProcessor> {
    const processor = new NativeAudioProcessor();
    const id = Math.random().toString(36).substring(7);
    this.audioProcessors.set(id, processor);
    return processor;
  }

  getVersion(): string {
    return getVersion();
  }

  async shutdown(): Promise<void> {
    // Clean up resources
    this.voiceCloners.clear();
    this.audioProcessors.clear();
    // TODO: Add native cleanup if needed
  }

  async getMemoryStatistics(): Promise<MemoryStatistics> {
    // TODO: Implement memory statistics in C++ addon
    return {
      totalBytes: 0,
      usedBytes: 0,
      freeBytes: 0,
      peakBytes: 0,
      allocationCount: 0,
      deallocationCount: 0,
      hitRate: 0,
      componentStats: {}
    };
  }
}

// Export factory function
export function createCoreEngineFactory(): CoreEngineFactory {
  return new NativeCoreEngineFactory();
}

// Default export
export default {
  isNativeAddonLoaded,
  getLoadError,
  getVersion,
  checkSystemRequirements,
  loadAudioFile,
  NativeVoiceCloner,
  NativeAudioProcessor,
  NativeCoreEngineFactory,
  createCoreEngineFactory
};