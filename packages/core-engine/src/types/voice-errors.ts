/**
 * Voice Cloning Error Types
 * 
 * Defines error types and interfaces for voice cloning operations
 */

/**
 * Base Error Interface
 * 
 * Common properties for all voice cloning errors
 */
export interface VoiceCloningError {
  /** Error code for programmatic handling */
  code: string;
  
  /** Human-readable error message */
  message: string;
  
  /** Timestamp when error occurred */
  timestamp: Date;
  
  /** Optional stack trace */
  stack?: string;
  
  /** Additional error context */
  context?: Record<string, unknown>;
}

/**
 * Validation Error
 * 
 * Error that occurs when input validation fails
 */
export interface ValidationError extends VoiceCloningError {
  code: 'VALIDATION_ERROR';
  
  /** Validation errors by field */
  fieldErrors: Record<string, string[]>;
  
  /** Input that caused validation failure */
  invalidInput?: unknown;
}

/**
 * Processing Error
 * 
 * Error that occurs during voice cloning processing
 */
export interface ProcessingError extends VoiceCloningError {
  code: 'PROCESSING_ERROR';
  
  /** Processing stage where error occurred */
  stage: 'audio_loading' | 'voice_encoding' | 'text_processing' | 'speech_synthesis' | 'audio_output';
  
  /** Detailed error information */
  details: {
    /** Error from underlying library */
    libraryError?: string;
    
    /** Resource that caused the error */
    resource?: string;
    
    /** Suggested fix or workaround */
    suggestion?: string;
  };
}

/**
 * Integration Error
 * 
 * Error that occurs with f5-tts library integration
 */
export interface IntegrationError extends VoiceCloningError {
  code: 'INTEGRATION_ERROR';
  
  /** Integration component that failed */
  component: 'f5-tts' | 'audio_library' | 'model_loader';
  
  /** Original error from the component */
  originalError?: string;
  
  /** Whether the error is recoverable */
  recoverable: boolean;
}

/**
 * Resource Error
 * 
 * Error that occurs due to resource constraints
 */
export interface ResourceError extends VoiceCloningError {
  code: 'RESOURCE_ERROR';
  
  /** Type of resource that caused the error */
  resourceType: 'memory' | 'gpu' | 'cpu' | 'disk' | 'network';
  
  /** Current usage */
  currentUsage: number;
  
  /** Maximum allowed usage */
  maxAllowed: number;
  
  /** Suggested action to resolve */
  suggestedAction?: 'retry' | 'reduce_load' | 'increase_resources' | 'wait';
}

/**
 * Configuration Error
 * 
 * Error that occurs due to invalid configuration
 */
export interface ConfigurationError extends VoiceCloningError {
  code: 'CONFIGURATION_ERROR';
  
  /** Configuration key that is invalid */
  configKey: string;
  
  /** Expected value type or format */
  expected?: string;
  
  /** Actual value provided */
  actual?: unknown;
}

/**
 * Model Error
 * 
 * Error that occurs with model loading or inference
 */
export interface ModelError extends VoiceCloningError {
  code: 'MODEL_ERROR';
  
  /** Model that caused the error */
  modelName: string;
  
  /** Model file path */
  modelPath: string;
  
  /** Error from model framework */
  frameworkError?: string;
  
  /** Whether model files are missing or corrupted */
  missingFiles?: string[];
}

/**
 * Audio Error
 * 
 * Error that occurs during audio processing
 */
export interface AudioError extends VoiceCloningError {
  code: 'AUDIO_ERROR';
  
  /** Audio operation that failed */
  operation: 'loading' | 'conversion' | 'normalization' | 'resampling' | 'encoding' | 'decoding';
  
  /** Audio format involved */
  format?: string;
  
  /** Audio file details */
  fileInfo?: {
    path?: string;
    size?: number;
    duration?: number;
    sampleRate?: number;
  };
}

/**
 * Timeout Error
 * 
 * Error that occurs when operation times out
 */
export interface TimeoutError extends VoiceCloningError {
  code: 'TIMEOUT_ERROR';
  
  /** Operation that timed out */
  operation: string;
  
  /** Timeout duration in milliseconds */
  timeoutMs: number;
  
  /** Progress made before timeout */
  progress?: number;
}

/**
 * Error Factory Interface
 * 
 * Helper for creating typed error objects
 */
export interface VoiceCloningErrorFactory {
  createValidationError(message: string, fieldErrors: Record<string, string[]>): ValidationError;
  createProcessingError(message: string, stage: ProcessingError['stage'], details: ProcessingError['details']): ProcessingError;
  createIntegrationError(message: string, component: IntegrationError['component'], recoverable: boolean): IntegrationError;
  createResourceError(message: string, resourceType: ResourceError['resourceType'], currentUsage: number, maxAllowed: number): ResourceError;
  createConfigurationError(message: string, configKey: string, expected?: string, actual?: unknown): ConfigurationError;
  createModelError(message: string, modelName: string, modelPath: string): ModelError;
  createAudioError(message: string, operation: AudioError['operation'], format?: string, fileInfo?: AudioError['fileInfo']): AudioError;
  createTimeoutError(message: string, operation: string, timeoutMs: number): TimeoutError;
}

/**
 * Union type of all possible voice cloning errors
 */
export type VoiceCloningErrorType = 
  | ValidationError
  | ProcessingError
  | IntegrationError
  | ResourceError
  | ConfigurationError
  | ModelError
  | AudioError
  | TimeoutError;

/**
 * Error Response Interface
 * 
 * Standardized error response for API endpoints
 */
export interface ErrorResponse {
  /** Error information */
  error: VoiceCloningErrorType;
  
  /** Request ID for tracking */
  requestId: string;
  
  /** Whether operation can be retried */
  retryable: boolean;
  
  /** Suggested retry delay in milliseconds */
  retryAfterMs?: number;
  
  /** Additional help information */
  help?: {
    /** Documentation URL */
    documentationUrl?: string;
    
    /** Support contact */
    supportContact?: string;
    
    /** Troubleshooting steps */
    troubleshooting?: string[];
  };
}

/**
 * Error Severity Levels
 */
export enum ErrorSeverity {
  /** Informational - operation completed with minor issues */
  INFO = 'info',
  
  /** Warning - operation completed but with potential issues */
  WARNING = 'warning',
  
  /** Error - operation failed but may be recoverable */
  ERROR = 'error',
  
  /** Critical - operation failed and system may be unstable */
  CRITICAL = 'critical'
}

/**
 * Error with Severity
 */
export interface SeverityError extends VoiceCloningError {
  /** Error severity level */
  severity: ErrorSeverity;
  
  /** Whether error should trigger alerts */
  shouldAlert: boolean;
  
  /** Alert threshold for this error type */
  alertThreshold?: number;
}
