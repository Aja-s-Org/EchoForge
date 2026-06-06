import { describe, it, expect } from 'vitest';
import { RequestUploadSchema, ProcessVoiceSchema } from './voice.schemas';

describe('Voice Schemas', () => {
  describe('RequestUploadSchema', () => {
    describe('fileName validation', () => {
      it('should accept valid file names', () => {
        const validData = {
          fileName: 'audio-recording.wav',
          contentType: 'audio/wav',
        };

        const result = RequestUploadSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should reject empty fileName', () => {
        const data = { fileName: '', contentType: 'audio/wav' };
        const result = RequestUploadSchema.safeParse(data);
        expect(result.success).toBe(false);
      });

      it('should reject missing fileName', () => {
        const data = { contentType: 'audio/wav' };
        const result = RequestUploadSchema.safeParse(data);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toContain('fileName is required');
        }
      });

      it('should reject fileName with path traversal attempts', () => {
        const data = { fileName: '../etc/passwd', contentType: 'text/plain' };
        const result = RequestUploadSchema.safeParse(data);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toContain('must not contain ..');
        }
      });

      it('should reject fileName with null bytes', () => {
        const data = { fileName: 'file\0.txt', contentType: 'text/plain' };
        const result = RequestUploadSchema.safeParse(data);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toContain('must not contain null bytes');
        }
      });

      it('should reject fileName exceeding 255 characters', () => {
        const data = {
          fileName: 'a'.repeat(256) + '.txt',
          contentType: 'text/plain',
        };
        const result = RequestUploadSchema.safeParse(data);
        expect(result.success).toBe(false);
      });

      it('should accept fileName with special characters', () => {
        const data = {
          fileName: 'my-audio_file (v2).wav',
          contentType: 'audio/wav',
        };
        const result = RequestUploadSchema.safeParse(data);
        expect(result.success).toBe(true);
      });

      it('should accept fileName at max length (255 chars)', () => {
        const data = {
          fileName: 'a'.repeat(255),
          contentType: 'audio/wav',
        };
        const result = RequestUploadSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });

    describe('contentType validation', () => {
      it('should accept valid MIME types', () => {
        const validTypes = [
          'audio/wav',
          'audio/mpeg',
          'audio/mp3',
          'video/mp4',
          'application/json',
          'text/plain',
          'image/png',
        ];

        for (const contentType of validTypes) {
          const result = RequestUploadSchema.safeParse({
            fileName: 'file.txt',
            contentType,
          });
          expect(result.success).toBe(true);
        }
      });

      it('should accept MIME types with parameters', () => {
        const data = {
          fileName: 'file.txt',
          contentType: 'text/plain; charset=utf-8',
        };
        const result = RequestUploadSchema.safeParse(data);
        expect(result.success).toBe(true);
      });

      it('should reject empty contentType', () => {
        const data = { fileName: 'file.wav', contentType: '' };
        const result = RequestUploadSchema.safeParse(data);
        expect(result.success).toBe(false);
      });

      it('should reject missing contentType', () => {
        const data = { fileName: 'file.wav' };
        const result = RequestUploadSchema.safeParse(data);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toContain('contentType is required');
        }
      });

      it('should reject invalid MIME type format', () => {
        const invalidTypes = ['not-a-mime', 'audio', '/wav', 'audio/', 'audio//wav'];

        for (const contentType of invalidTypes) {
          const result = RequestUploadSchema.safeParse({
            fileName: 'file.txt',
            contentType,
          });
          expect(result.success).toBe(false);
        }
      });

      it('should accept vendor-specific MIME types', () => {
        const data = {
          fileName: 'document.docx',
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        };
        const result = RequestUploadSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('ProcessVoiceSchema', () => {
    describe('transcript validation', () => {
      it('should accept valid transcript', () => {
        const validData = {
          transcript: 'This is a test transcript.',
          fileName: 'uploads/1234567890-audio.wav',
        };

        const result = ProcessVoiceSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should reject empty transcript', () => {
        const data = {
          transcript: '',
          fileName: 'uploads/1234567890-audio.wav',
        };
        const result = ProcessVoiceSchema.safeParse(data);
        expect(result.success).toBe(false);
      });

      it('should reject missing transcript', () => {
        const data = { fileName: 'uploads/1234567890-audio.wav' };
        const result = ProcessVoiceSchema.safeParse(data);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toContain('transcript is required');
        }
      });

      it('should accept transcript at max length (100,000 chars)', () => {
        const data = {
          transcript: 'a'.repeat(100_000),
          fileName: 'uploads/1234567890-audio.wav',
        };
        const result = ProcessVoiceSchema.safeParse(data);
        expect(result.success).toBe(true);
      });

      it('should reject transcript exceeding 100,000 characters', () => {
        const data = {
          transcript: 'a'.repeat(100_001),
          fileName: 'uploads/1234567890-audio.wav',
        };
        const result = ProcessVoiceSchema.safeParse(data);
        expect(result.success).toBe(false);
      });

      it('should accept transcript with special characters and unicode', () => {
        const data = {
          transcript: 'Hello 世界! This is a test with émojis 🎉 and symbols: @#$%',
          fileName: 'uploads/1234567890-audio.wav',
        };
        const result = ProcessVoiceSchema.safeParse(data);
        expect(result.success).toBe(true);
      });

      it('should accept transcript with newlines and whitespace', () => {
        const data = {
          transcript: 'Line 1\nLine 2\n\tIndented line',
          fileName: 'uploads/1234567890-audio.wav',
        };
        const result = ProcessVoiceSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });

    describe('fileName validation', () => {
      it('should accept valid upload fileName', () => {
        const validFileNames = [
          'uploads/1234567890-audio.wav',
          'uploads/9999999999-recording.mp3',
          'uploads/1234567890-file_with-special.chars.wav',
        ];

        for (const fileName of validFileNames) {
          const result = ProcessVoiceSchema.safeParse({
            transcript: 'Test',
            fileName,
          });
          expect(result.success).toBe(true);
        }
      });

      it('should reject fileName not starting with uploads/', () => {
        const data = {
          transcript: 'Test',
          fileName: 'other/1234567890-audio.wav',
        };
        const result = ProcessVoiceSchema.safeParse(data);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toContain('valid upload key');
        }
      });

      it('should reject fileName without timestamp', () => {
        const data = {
          transcript: 'Test',
          fileName: 'uploads/audio.wav',
        };
        const result = ProcessVoiceSchema.safeParse(data);
        expect(result.success).toBe(false);
      });

      it('should reject fileName with path traversal', () => {
        const data = {
          transcript: 'Test',
          fileName: 'uploads/1234567890-../../etc/passwd',
        };
        const result = ProcessVoiceSchema.safeParse(data);
        expect(result.success).toBe(false);
      });

      it('should reject fileName with subdirectories', () => {
        const data = {
          transcript: 'Test',
          fileName: 'uploads/1234567890-subdir/file.wav',
        };
        const result = ProcessVoiceSchema.safeParse(data);
        expect(result.success).toBe(false);
      });

      it('should reject fileName with null bytes', () => {
        const data = {
          transcript: 'Test',
          fileName: 'uploads/1234567890-file\0.wav',
        };
        const result = ProcessVoiceSchema.safeParse(data);
        expect(result.success).toBe(false);
      });

      it('should reject empty fileName', () => {
        const data = { transcript: 'Test', fileName: '' };
        const result = ProcessVoiceSchema.safeParse(data);
        expect(result.success).toBe(false);
      });

      it('should reject missing fileName', () => {
        const data = { transcript: 'Test' };
        const result = ProcessVoiceSchema.safeParse(data);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toContain('fileName is required');
        }
      });

      it('should reject arbitrary bucket paths', () => {
        const invalidPaths = [
          'secrets/config.json',
          'private/data.txt',
          '/etc/passwd',
          'uploads/',
          'uploads/1234567890-',
        ];

        for (const fileName of invalidPaths) {
          const result = ProcessVoiceSchema.safeParse({
            transcript: 'Test',
            fileName,
          });
          expect(result.success).toBe(false);
        }
      });
    });
  });
});
