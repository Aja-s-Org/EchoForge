import type { VoiceSampleInput } from './voice-sample';
import type { TranscriptionInput } from './transcription';

/**
 * Voice Cloning Output Interface
 * 
 * Represents generated audio with cloned voice
 */
export interface VoiceCloningOutput {
  /** Generated audio data */
  audioData: Buffer;
  
  /** Audio format: 'wav' or 'mp3' */
  audioFormat: 'wav' | 'mp3';
  
  /** Duration in seconds */
  duration: number;
  
  /** Quality score from 0.0 to 1.0 */
  qualityScore: number;
  
  /** Processing time in milliseconds */
  processingTime: number;
  
  /** Metadata about the generated audio */
  metadata: {
    /** Voice similarity score from 0.0 to 1.0 */
    voiceSimilarity: number;
    
    /** Intelligibility score from 0.0 to 1.0 */
    intelligibility: number;
    
    /** Sample rate in Hz */
    sampleRate: number;
    
    /** Bit depth */
    bitDepth: number;
  };
}

/**
 * Voice Cloning Job Status
 */
export interface VoiceCloningJob {
  id: string;
  voiceSample: VoiceSampleInput;
  transcription: TranscriptionInput;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  output?: VoiceCloningOutput;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}