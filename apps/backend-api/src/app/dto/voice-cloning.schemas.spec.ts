import { describe, expect, it } from 'vitest';
import { CloneVoiceSchema, JobStatusSchema, UploadAndCloneSchema } from './voice-cloning.schemas';

const clone = { voiceSampleFile: 'uploads/1234567890-audio.wav', transcription: 'Hello' };

describe('CloneVoiceSchema', () => {
  it('accepts an optional sample transcript', () => {
    expect(CloneVoiceSchema.parse(clone).sampleTranscript).toBeUndefined();
    expect(CloneVoiceSchema.parse({ ...clone, sampleTranscript: 'My voice.' }).sampleTranscript).toBe('My voice.');
  });

  it('rejects a sample transcript over 1000 characters', () => {
    const result = CloneVoiceSchema.safeParse({ ...clone, sampleTranscript: 'a'.repeat(1001) });
    expect(result.success).toBe(false);
  });
});

describe('UploadAndCloneSchema', () => {
  it('coerces speed from a multipart string', () => {
    expect(UploadAndCloneSchema.parse({ transcription: 'Hello', speed: '1.5' }).speed).toBe(1.5);
  });

  it('rejects a speed outside 0.5 to 2.0', () => {
    expect(UploadAndCloneSchema.safeParse({ transcription: 'Hello', speed: '3' }).success).toBe(false);
  });

  it('accepts an optional sample transcript', () => {
    const body = UploadAndCloneSchema.parse({ transcription: 'Hello', sampleTranscript: 'My voice.' });
    expect(body.sampleTranscript).toBe('My voice.');
    expect(body.speed).toBe(1);
  });
});

describe('JobStatusSchema', () => {
  it('accepts the 32-character hex IDs the database generates', () => {
    expect(JobStatusSchema.safeParse({ jobId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90' }).success).toBe(true);
    expect(JobStatusSchema.safeParse({ jobId: 'mwyqf7sifwaad3b7i0m' }).success).toBe(false);
  });
});
