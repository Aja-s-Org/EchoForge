import { describe, it, expect } from 'vitest';
import type { VoiceSampleInput } from './voice-sample';

describe('VoiceSampleInput Interface', () => {
  it('should allow valid voice sample input', () => {
    const sample: VoiceSampleInput = {
      audioData: Buffer.from('test'),
      audioFormat: 'wav',
      sampleRate: 22050,
      duration: 5.0,
      language: 'en'
    };
    
    expect(sample).toBeDefined();
    expect(sample.audioFormat).toBe('wav');
    expect(sample.sampleRate).toBe(22050);
    expect(sample.duration).toBe(5.0);
    expect(sample.language).toBe('en');
  });

  it('should allow optional language field', () => {
    const sample: VoiceSampleInput = {
      audioData: Buffer.from('test'),
      audioFormat: 'mp3',
      sampleRate: 44100,
      duration: 10.0
    };
    
    expect(sample).toBeDefined();
    expect(sample.language).toBeUndefined();
  });

  it('should enforce valid audio formats', () => {
    // This is a TypeScript compile-time check
    // Valid formats should be 'wav', 'mp3', or 'ogg'
    const validFormats: Array<VoiceSampleInput['audioFormat']> = ['wav', 'mp3', 'ogg'];
    
    expect(validFormats).toHaveLength(3);
    expect(validFormats).toContain('wav');
    expect(validFormats).toContain('mp3');
    expect(validFormats).toContain('ogg');
  });
});