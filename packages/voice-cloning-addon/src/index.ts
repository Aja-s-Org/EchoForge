/**
 * Voice Cloning Addon - Main Entry Point
 * 
 * This package provides voice cloning functionality through a Node.js C++ addon
 * that integrates with the f5-tts library.
 */

export * from './types/voice-sample';
export * from './types/transcription';
export * from './types/output';

// Main voice cloning API will be implemented in subsequent tasks
export interface VoiceCloner {
  extractVoiceEmbedding(audioData: Buffer | string): Promise<number[]>;
  synthesizeSpeech(embedding: number[], text: string): Promise<Buffer>;
  cloneVoice(audioData: Buffer | string, text: string): Promise<Buffer>;
}