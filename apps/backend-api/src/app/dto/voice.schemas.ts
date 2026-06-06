import { z } from 'zod';

export const RequestUploadSchema = z.object({
  fileName: z
    .string({ required_error: 'fileName is required' })
    .min(1, 'fileName must not be empty')
    .max(255, 'fileName must be 255 characters or fewer')
    // Prevent path traversal and null bytes
    .refine((v) => !v.includes('..'), 'fileName must not contain ..')
    .refine((v) => !v.includes('\0'), 'fileName must not contain null bytes'),

  contentType: z
    .string({ required_error: 'contentType is required' })
    .min(1, 'contentType must not be empty')
    // Basic MIME type shape: type/subtype with optional parameters
    .regex(
      /^[\w-]+\/[\w\-+.]+(\s*;.*)?$/,
      'contentType must be a valid MIME type (e.g. audio/wav)',
    ),
});

export type RequestUploadDto = z.infer<typeof RequestUploadSchema>;

export const ProcessVoiceSchema = z.object({
  transcript: z
    .string({ required_error: 'transcript is required' })
    .min(1, 'transcript must not be empty')
    .max(100_000, 'transcript must be 100,000 characters or fewer'),

  fileName: z
    .string({ required_error: 'fileName is required' })
    .min(1, 'fileName must not be empty')
    // Must be one of the keys we actually generate — guards against probing
    .regex(
      /^uploads\/\d+-[^/\0]+$/,
      'fileName must be a valid upload key (e.g. uploads/1234567890-audio.wav)',
    ),
});

export type ProcessVoiceDto = z.infer<typeof ProcessVoiceSchema>;
