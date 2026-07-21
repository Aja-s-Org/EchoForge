/**
 * Voice Cloning Types Index
 * 
 * Central export point for all voice cloning type definitions
 */

export * from './voice-sample';
export * from './transcription';
export * from './output';
export * from './voice-config';
export * from './voice-errors';

/**
 * Re-export common types for convenience
 */
export type {
  VoiceSampleInput,
  VoiceSampleValidationResult,
} from './voice-sample';

export type {
  TranscriptionInput,
  TranscriptionValidationResult,
} from './transcription';

export type {
  VoiceCloningOutput,
  VoiceCloningJob,
} from './output';

export type {
  VoiceCloningBuildConfig,
  VoiceCloningRuntimeConfig,
  VoiceCloningEngineConfig,
} from './voice-config';

export type {
  VoiceCloningError,
  ValidationError,
  ProcessingError,
  IntegrationError,
  ResourceError,
  ConfigurationError,
  ModelError,
  AudioError,
  TimeoutError,
  VoiceCloningErrorType,
  ErrorResponse,
  ErrorSeverity,
  SeverityError,
} from './voice-errors';