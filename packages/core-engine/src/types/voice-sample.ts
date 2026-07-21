/**
 * Voice Sample Input Interface
 * 
 * Represents audio data used for voice cloning
 */
export interface VoiceSampleInput {
  /** Audio data as Buffer or base64 encoded string */
  audioData: Buffer | string;
  
  /** Audio format: 'wav', 'mp3', or 'ogg' */
  audioFormat: 'wav' | 'mp3' | 'ogg';
  
  /** Sample rate in Hz */
  sampleRate: number;
  
  /** Duration in seconds */
  duration: number;
  
  /** Optional language hint for better processing */
  language?: string;
}

/**
 * Voice Sample Validation Result
 */
export interface VoiceSampleValidationResult {
  isValid: boolean;
  errors?: string[];
  warnings?: string[];
  sampleRate?: number;
  duration?: number;
  channelCount?: number;
}