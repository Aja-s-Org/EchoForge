import { z } from 'zod';

export const CloneVoiceSchema = z.object({
  voiceSampleFile: z
    .string({ required_error: 'voiceSampleFile is required' })
    .min(1, 'voiceSampleFile must not be empty')
    .max(500, 'voiceSampleFile must be 500 characters or fewer')
    .regex(
      /^uploads\/\d+-[^/\0]+$/,
      'voiceSampleFile must be a valid upload key (e.g. uploads/1234567890-audio.wav)',
    ),

  transcription: z
    .string({ required_error: 'transcription is required' })
    .min(1, 'transcription must not be empty')
    .max(5000, 'transcription must be 5000 characters or fewer'),

  language: z
    .string()
    .optional()
    .default('en')
    .refine((lang) => !lang || /^[a-z]{2,3}$/.test(lang), {
      message: 'language must be a valid language code (2-3 letters)',
    }),

  speed: z
    .number()
    .optional()
    .default(1.0)
    .refine((speed) => !speed || (speed >= 0.5 && speed <= 2.0), {
      message: 'speed must be between 0.5 and 2.0',
    }),
});

export type CloneVoiceDto = z.infer<typeof CloneVoiceSchema>;

export const JobStatusSchema = z.object({
  jobId: z
    .string()
    .regex(
      /^[a-f0-9]{32}$/,
      'jobId must be a valid 32-character hexadecimal string',
    ),
});

export type JobStatusDto = z.infer<typeof JobStatusSchema>;

export const DownloadResultSchema = z.object({
  jobId: z
    .string()
    .regex(
      /^[a-f0-9]{32}$/,
      'jobId must be a valid 32-character hexadecimal string',
    ),
});

export type DownloadResultDto = z.infer<typeof DownloadResultSchema>;

// Validation for file upload
export const VoiceSampleFileSchema = z.object({
  fieldname: z.literal('voiceSample'),
  originalname: z
    .string()
    .min(1, 'originalname must not be empty')
    .max(255, 'originalname must be 255 characters or fewer'),
  mimetype: z
    .string()
    .regex(/^audio\//, 'mimetype must be an audio file type'),
  size: z
    .number()
    .int()
    .positive()
    .max(100 * 1024 * 1024, 'File size must be less than 100MB'),
});

export type VoiceSampleFileDto = z.infer<typeof VoiceSampleFileSchema>;

// Combined schema for file upload with transcription
export const UploadAndCloneSchema = z.object({
  transcription: z
    .string({ required_error: 'transcription is required' })
    .min(1, 'transcription must not be empty')
    .max(5000, 'transcription must be 5000 characters or fewer'),

  language: z
    .string()
    .optional()
    .default('en')
    .refine((lang) => !lang || /^[a-z]{2,3}$/.test(lang), {
      message: 'language must be a valid language code (2-3 letters)',
    }),

  speed: z
    .number()
    .optional()
    .default(1.0)
    .refine((speed) => !speed || (speed >= 0.5 && speed <= 2.0), {
      message: 'speed must be between 0.5 and 2.0',
    }),
});

export type UploadAndCloneDto = z.infer<typeof UploadAndCloneSchema>;