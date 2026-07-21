import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VoiceService } from './voice.service';
import { StorageService } from './storage.service';

// Mock core-engine
vi.mock('@echoforge/core-engine', () => {
  const mockVoiceCloner = {
    initialize: vi.fn().mockResolvedValue(true),
    cloneVoice: vi.fn().mockResolvedValue(Buffer.from('audio data')),
  };

  const mockCoreEngine = {
    initialize: vi.fn().mockResolvedValue(true),
    createVoiceCloner: vi.fn().mockResolvedValue(mockVoiceCloner),
  };

  return {
    coreEngine: vi.fn().mockResolvedValue(mockCoreEngine),
  };
});

describe('VoiceService', () => {
  let voiceService: VoiceService;
  let storageService: StorageService;

  beforeEach(() => {
    vi.clearAllMocks();
    storageService = {
      fileExists: vi.fn().mockResolvedValue(true),
    } as any;

    voiceService = new VoiceService(storageService);
  });

  it('should be defined', () => {
    expect(voiceService).toBeDefined();
  });

  describe('cloneVoice', () => {
    it('should create a new voice cloning job', async () => {
      const request = {
        voiceSampleFile: 'uploads/1234567890-audio.wav',
        transcription: 'Hello, this is a test.',
        language: 'en',
        speed: 1.0,
      };

      const result = await voiceService.cloneVoice(request);

      expect(result).toHaveProperty('jobId');
      expect(result.status).toBe('queued');
      expect(result.estimatedTime).toBe(30);
    });

    it('should throw error if voice sample file does not exist', async () => {
      vi.mocked(storageService.fileExists).mockResolvedValue(false);

      const request = {
        voiceSampleFile: 'uploads/nonexistent.wav',
        transcription: 'Hello, this is a test.',
        language: 'en',
        speed: 1.0,
      };

      await expect(voiceService.cloneVoice(request)).rejects.toThrow(
        'Voice sample file not found',
      );
    });

    it('should validate transcription length', async () => {
      const longTranscription = 'a'.repeat(6000);
      const request = {
        voiceSampleFile: 'uploads/1234567890-audio.wav',
        transcription: longTranscription,
        language: 'en',
        speed: 1.0,
      };

      await expect(voiceService.cloneVoice(request)).rejects.toThrow(
        'Transcription too long',
      );
    });
  });

  describe('getJobStatus', () => {
    it('should return job status for existing job', async () => {
      // First create a job
      const request = {
        voiceSampleFile: 'uploads/1234567890-audio.wav',
        transcription: 'Hello, this is a test.',
        language: 'en',
        speed: 1.0,
      };

      const createResult = await voiceService.cloneVoice(request);
      const jobId = createResult.jobId;

      // Then get status - note: job might be processing already
      const status = await voiceService.getJobStatus(jobId);

      expect(status.jobId).toBe(jobId);
      expect(['pending', 'processing', 'completed', 'failed']).toContain(status.status);
      expect(status.createdAt).toBeInstanceOf(Date);
    });

    it('should throw error for non-existent job', async () => {
      await expect(voiceService.getJobStatus('nonexistent')).rejects.toThrow(
        'Job not found',
      );
    });
  });

  describe('rate limiting', () => {
    it('should allow requests within rate limit', async () => {
      const clientIp = '127.0.0.1';
      const request = {
        voiceSampleFile: 'uploads/1234567890-audio.wav',
        transcription: 'Test',
        language: 'en',
        speed: 1.0,
      };

      // Make 10 requests (should succeed)
      for (let i = 0; i < 10; i++) {
        await expect(
          voiceService.cloneVoice(request, clientIp),
        ).resolves.toBeDefined();
      }
    });

    it('should throw error when rate limit exceeded', async () => {
      const clientIp = '127.0.0.1';
      const request = {
        voiceSampleFile: 'uploads/1234567890-audio.wav',
        transcription: 'Test',
        language: 'en',
        speed: 1.0,
      };

      // Make 11 requests (should fail on 11th)
      for (let i = 0; i < 10; i++) {
        await voiceService.cloneVoice(request, clientIp);
      }

      await expect(voiceService.cloneVoice(request, clientIp)).rejects.toThrow(
        'Rate limit exceeded',
      );
    });
  });

  describe('queue stats', () => {
    it('should return accurate queue statistics', async () => {
      const stats = voiceService.getQueueStats();

      expect(stats).toHaveProperty('totalJobs');
      expect(stats).toHaveProperty('pendingJobs');
      expect(stats).toHaveProperty('processingJobs');
      expect(stats).toHaveProperty('completedJobs');
      expect(stats).toHaveProperty('failedJobs');
      expect(stats).toHaveProperty('queueLength');
    });
  });
});