/**
 * Voice Cloning Interface Tests
 * 
 * This file demonstrates usage of the voice cloning interfaces
 * and verifies that they work together correctly.
 * 
 * **Validates: Requirements 6.1-6.6**
 */

import type {
  VoiceSampleInput,
  TranscriptionInput,
  VoiceCloningOutput,
  VoiceCloningJob,
  VoiceCloningBuildConfig,
  VoiceCloningRuntimeConfig,
  VoiceCloningEngineConfig,
  VoiceCloningErrorType,
  ValidationError,
  ProcessingError,
  IntegrationError,
  ResourceError,
  ConfigurationError,
  ModelError,
  AudioError,
  TimeoutError,
  ErrorResponse,
} from './index';

/**
 * Example usage of VoiceSampleInput interface
 */
const exampleVoiceSample: VoiceSampleInput = {
  audioData: Buffer.from('fake audio data'),
  audioFormat: 'wav',
  sampleRate: 22050,
  duration: 15.5,
  language: 'en',
};

/**
 * Example usage of TranscriptionInput interface
 */
const exampleTranscription: TranscriptionInput = {
  text: 'Hello, this is a test of the voice cloning system.',
  language: 'en',
  emphasis: [
    { word: 'Hello', strength: 0.8 },
    { word: 'test', strength: 0.6 },
  ],
};

/**
 * Example usage of VoiceCloningOutput interface
 */
const exampleOutput: VoiceCloningOutput = {
  audioData: Buffer.from('generated audio data'),
  audioFormat: 'wav',
  duration: 4.2,
  qualityScore: 0.85,
  processingTime: 12500,
  metadata: {
    voiceSimilarity: 0.78,
    intelligibility: 0.92,
    sampleRate: 22050,
    bitDepth: 16,
  },
};

/**
 * Example usage of VoiceCloningJob interface
 */
const exampleJob: VoiceCloningJob = {
  id: 'job-12345',
  voiceSample: exampleVoiceSample,
  transcription: exampleTranscription,
  status: 'completed',
  output: exampleOutput,
  createdAt: new Date('2024-01-15T10:30:00Z'),
  completedAt: new Date('2024-01-15T10:30:12Z'),
};

/**
 * Example usage of VoiceCloningBuildConfig interface
 */
const exampleBuildConfig: VoiceCloningBuildConfig = {
  f5ttsPath: './third_party/f5-tts',
  modelPath: './models/f5-tts',
  maxAudioDuration: 30,
  supportedFormats: ['wav', 'mp3'],
  defaultSampleRate: 22050,
  gpuEnabled: true,
  gpuDeviceId: 0,
  memoryLimitMB: 2048,
  embeddingCacheSize: 100,
};

/**
 * Example usage of VoiceCloningRuntimeConfig interface
 */
const exampleRuntimeConfig: VoiceCloningRuntimeConfig = {
  maxConcurrentJobs: 5,
  timeoutMs: 30000,
  qualityPreset: 'balanced',
  cacheEnabled: true,
  cacheTtlSeconds: 3600,
  logLevel: 'info',
  performanceMonitoring: true,
  maxMemoryPerJobMB: 512,
  autoCleanup: true,
  cleanupIntervalSeconds: 300,
};

/**
 * Example usage of VoiceCloningEngineConfig interface
 */
const exampleEngineConfig: VoiceCloningEngineConfig = {
  build: exampleBuildConfig,
  runtime: exampleRuntimeConfig,
  models: {
    encoderPath: './models/encoder.pth',
    synthesizerPath: './models/synthesizer.pth',
    vocoderPath: './models/vocoder.pth',
    quantization: 'fp32',
    cpuFallback: true,
  },
  audio: {
    targetSampleRate: 22050,
    targetChannels: 1,
    bitDepth: 16,
    normalize: true,
    normalizationThreshold: -3,
    noiseReduction: false,
  },
  performance: {
    batchSize: 4,
    inferenceThreads: 2,
    memoryPooling: true,
    poolSizeMB: 256,
  },
};

/**
 * Example usage of ValidationError interface
 */
const exampleValidationError: ValidationError = {
  code: 'VALIDATION_ERROR',
  message: 'Invalid audio format provided',
  timestamp: new Date(),
  fieldErrors: {
    audioFormat: ['Must be one of: wav, mp3, ogg'],
    sampleRate: ['Must be between 8000 and 48000 Hz'],
  },
  invalidInput: {
    audioFormat: 'avi',
    sampleRate: 10000,
  },
};

/**
 * Example usage of ProcessingError interface
 */
const exampleProcessingError: ProcessingError = {
  code: 'PROCESSING_ERROR',
  message: 'Failed to extract voice embedding',
  timestamp: new Date(),
  stage: 'voice_encoding',
  details: {
    libraryError: 'Model inference failed: tensor shape mismatch',
    resource: 'voice_encoder_model',
    suggestion: 'Check model version compatibility',
  },
};

/**
 * Example usage of ErrorResponse interface
 */
const exampleErrorResponse: ErrorResponse = {
  error: exampleProcessingError,
  requestId: 'req-67890',
  retryable: true,
  retryAfterMs: 5000,
  help: {
    documentationUrl: 'https://docs.echoforge.dev/voice-cloning/errors',
    supportContact: 'support@echoforge.dev',
    troubleshooting: [
      'Verify audio file format is supported',
      'Check that models are properly loaded',
      'Ensure sufficient system resources are available',
    ],
  },
};

/**
 * Type guard functions to demonstrate interface usage
 */

export function isVoiceCloningJob(job: unknown): job is VoiceCloningJob {
  const candidate = job as Partial<VoiceCloningJob>;
  return (
    typeof candidate?.id === 'string' &&
    candidate.voiceSample !== undefined &&
    candidate.transcription !== undefined &&
    ['pending', 'processing', 'completed', 'failed'].includes(candidate.status || '') &&
    candidate.createdAt instanceof Date
  );
}

export function isValidVoiceSample(sample: unknown): sample is VoiceSampleInput {
  const candidate = sample as Partial<VoiceSampleInput>;
  return (
    (candidate.audioData instanceof Buffer || typeof candidate.audioData === 'string') &&
    ['wav', 'mp3', 'ogg'].includes(candidate.audioFormat || '') &&
    typeof candidate.sampleRate === 'number' &&
    candidate.sampleRate >= 8000 &&
    candidate.sampleRate <= 48000 &&
    typeof candidate.duration === 'number' &&
    candidate.duration > 0 &&
    candidate.duration <= 30
  );
}

export function isValidationError(error: unknown): error is ValidationError {
  const candidate = error as Partial<ValidationError>;
  return (
    candidate.code === 'VALIDATION_ERROR' &&
    typeof candidate.message === 'string' &&
    candidate.timestamp instanceof Date &&
    typeof candidate.fieldErrors === 'object' &&
    candidate.fieldErrors !== null
  );
}

/**
 * Function to demonstrate comprehensive type usage
 */
export function createVoiceCloningPipeline(
  voiceSample: VoiceSampleInput,
  transcription: TranscriptionInput,
  config: VoiceCloningEngineConfig
): {
  job: VoiceCloningJob;
  config: VoiceCloningEngineConfig;
  isValid: boolean;
} {
  // Validate inputs
  const validationErrors: string[] = [];
  
  if (!isValidVoiceSample(voiceSample)) {
    validationErrors.push('Invalid voice sample');
  }
  
  if (typeof transcription.text !== 'string' || transcription.text.length === 0) {
    validationErrors.push('Invalid transcription text');
  }
  
  // Create job
  const job: VoiceCloningJob = {
    id: `job-${Date.now()}`,
    voiceSample,
    transcription,
    status: validationErrors.length === 0 ? 'pending' : 'failed',
    error: validationErrors.length > 0 ? validationErrors.join(', ') : undefined,
    createdAt: new Date(),
  };
  
  return {
    job,
    config,
    isValid: validationErrors.length === 0,
  };
}

/**
 * Export examples for testing
 */
export {
  exampleVoiceSample,
  exampleTranscription,
  exampleOutput,
  exampleJob,
  exampleBuildConfig,
  exampleRuntimeConfig,
  exampleEngineConfig,
  exampleValidationError,
  exampleProcessingError,
  exampleErrorResponse,
};