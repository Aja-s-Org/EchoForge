/**
 * Transcription Input Interface
 * 
 * Represents text to be synthesized with cloned voice
 */
export interface TranscriptionInput {
  /** Text to be synthesized */
  text: string;
  
  /** Language code (e.g., 'en', 'es', 'fr') */
  language: string;
  
  /** Optional phoneme sequence for precise pronunciation */
  phonemes?: string;
  
  /** Optional word emphasis controls */
  emphasis?: Array<{
    word: string;
    strength: number; // 0.0 to 1.0
  }>;
}

/**
 * Transcription Validation Result
 */
export interface TranscriptionValidationResult {
  isValid: boolean;
  errors?: string[];
  warnings?: string[];
  characterCount?: number;
  wordCount?: number;
}