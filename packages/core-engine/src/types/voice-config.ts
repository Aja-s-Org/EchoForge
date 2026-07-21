/**
 * Voice Cloning Configuration Types
 * 
 * Defines configuration interfaces for voice cloning addon
 */

/**
 * Build Configuration Interface
 * 
 * Represents the build-time configuration for the voice cloning addon
 * This is typically loaded from a configuration file or environment variables
 */
export interface VoiceCloningBuildConfig {
  /** Path to the f5-tts library */
  f5ttsPath: string;
  
  /** Path to the f5-tts model files */
  modelPath: string;
  
  /** Maximum audio duration in seconds */
  maxAudioDuration: number;
  
  /** Supported audio formats */
  supportedFormats: ('wav' | 'mp3' | 'ogg')[];
  
  /** Default sample rate for audio processing */
  defaultSampleRate: number;
  
  /** Whether GPU acceleration is enabled */
  gpuEnabled: boolean;
  
  /** Optional GPU device ID */
  gpuDeviceId?: number;
  
  /** Memory limit for processing in MB */
  memoryLimitMB?: number;
  
  /** Cache size for embeddings */
  embeddingCacheSize?: number;
}

/**
 * Runtime Configuration Interface
 * 
 * Represents the runtime configuration that can be adjusted dynamically
 */
export interface VoiceCloningRuntimeConfig {
  /** Maximum number of concurrent jobs */
  maxConcurrentJobs: number;
  
  /** Timeout for voice cloning operations in milliseconds */
  timeoutMs: number;
  
  /** Quality preset for voice cloning */
  qualityPreset: 'fast' | 'balanced' | 'high';
  
  /** Whether result caching is enabled */
  cacheEnabled: boolean;
  
  /** Cache time-to-live in seconds */
  cacheTtlSeconds: number;
  
  /** Verbosity level for logging */
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  
  /** Whether to enable performance monitoring */
  performanceMonitoring: boolean;
  
  /** Maximum memory usage per job in MB */
  maxMemoryPerJobMB?: number;
  
  /** Whether to enable automatic cleanup of temporary files */
  autoCleanup: boolean;
  
  /** Cleanup interval in seconds */
  cleanupIntervalSeconds?: number;
}

/**
 * Engine Configuration Interface
 * 
 * Complete configuration for the voice cloning engine
 */
export interface VoiceCloningEngineConfig {
  /** Build configuration */
  build: VoiceCloningBuildConfig;
  
  /** Runtime configuration */
  runtime: VoiceCloningRuntimeConfig;
  
  /** Model-specific configuration */
  models: {
    /** Voice encoder model path */
    encoderPath?: string;
    
    /** Synthesizer model path */
    synthesizerPath?: string;
    
    /** Vocoder model path */
    vocoderPath?: string;
    
    /** Model quantization level */
    quantization: 'int8' | 'fp16' | 'fp32';
    
    /** Whether to use CPU fallback if GPU fails */
    cpuFallback: boolean;
  };
  
  /** Audio processing configuration */
  audio: {
    /** Target sample rate for output */
    targetSampleRate: number;
    
    /** Number of audio channels (1=mono, 2=stereo) */
    targetChannels: 1 | 2;
    
    /** Bit depth for output */
    bitDepth: 16 | 24 | 32;
    
    /** Whether to normalize audio */
    normalize: boolean;
    
    /** Normalization threshold in dB */
    normalizationThreshold?: number;
    
    /** Whether to apply noise reduction */
    noiseReduction: boolean;
  };
  
  /** Advanced performance tuning */
  performance?: {
    /** Batch size for processing */
    batchSize: number;
    
    /** Number of inference threads */
    inferenceThreads: number;
    
    /** Whether to enable memory pooling */
    memoryPooling: boolean;
    
    /** Pool size in MB */
    poolSizeMB?: number;
  };
}
