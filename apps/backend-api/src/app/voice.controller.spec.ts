import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VoiceController } from './voice.controller';
import { VoiceService } from '../services/voice.service';

describe('VoiceController', () => {
  let voiceController: VoiceController;
  let voiceService: VoiceService;

  beforeEach(() => {
    vi.clearAllMocks();
    voiceService = {
      cloneVoice: vi.fn(),
      getJobStatus: vi.fn(),
      downloadResult: vi.fn(),
    } as any;

    voiceController = new VoiceController(voiceService);
  });

  it('should be defined', () => {
    expect(voiceController).toBeDefined();
  });

  describe('cloneVoice', () => {
    it('should call voiceService.cloneVoice with correct parameters', async () => {
      const mockRequest = {
        voiceSampleFile: 'uploads/1234567890-audio.wav',
        transcription: 'Hello, this is a test.',
        language: 'en',
        speed: 1.0,
      };

      const mockResponse = {
        jobId: 'test-job-id',
        status: 'queued',
        estimatedTime: 30,
      };

      vi.mocked(voiceService.cloneVoice).mockResolvedValue(mockResponse);

      const req = {
        ip: '127.0.0.1',
        connection: { remoteAddress: '127.0.0.1' },
      } as any;

      const result = await voiceController.cloneVoice(mockRequest, req);

      expect(voiceService.cloneVoice).toHaveBeenCalledWith(
        {
          voiceSampleFile: 'uploads/1234567890-audio.wav',
          transcription: 'Hello, this is a test.',
          language: 'en',
          speed: 1.0,
        },
        '127.0.0.1',
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle rate limit errors', async () => {
      const mockRequest = {
        voiceSampleFile: 'uploads/1234567890-audio.wav',
        transcription: 'Hello, this is a test.',
        language: 'en',
        speed: 1.0,
      };

      vi.mocked(voiceService.cloneVoice).mockRejectedValue(
        new Error('Rate limit exceeded'),
      );

      const req = {
        ip: '127.0.0.1',
        connection: { remoteAddress: '127.0.0.1' },
      } as any;

      await expect(voiceController.cloneVoice(mockRequest, req)).rejects.toThrow(
        expect.objectContaining({
          status: 429,
        }),
      );
    });
  });

  describe('getJobStatus', () => {
    it('should call voiceService.getJobStatus with correct jobId', async () => {
      const mockJobId = 'test-job-id';
      const mockStatus = {
        jobId: 'test-job-id',
        status: 'completed',
        createdAt: new Date(),
        completedAt: new Date(),
      };

      vi.mocked(voiceService.getJobStatus).mockResolvedValue(mockStatus);

      const result = await voiceController.getJobStatus({ jobId: mockJobId });

      expect(voiceService.getJobStatus).toHaveBeenCalledWith('test-job-id');
      expect(result).toEqual(mockStatus);
    });

    it('should handle job not found errors', async () => {
      vi.mocked(voiceService.getJobStatus).mockRejectedValue(
        new Error('Job not found: test-job-id'),
      );

      await expect(
        voiceController.getJobStatus({ jobId: 'test-job-id' }),
      ).rejects.toThrow(
        expect.objectContaining({
          status: 404,
        }),
      );
    });
  });

  describe('downloadResult', () => {
    it('should call voiceService.downloadResult with correct jobId', async () => {
      const mockJobId = 'test-job-id';
      const mockBuffer = Buffer.from('audio data');

      vi.mocked(voiceService.downloadResult).mockResolvedValue(mockBuffer);

      const result = await voiceController.downloadResult({ jobId: mockJobId });

      expect(voiceService.downloadResult).toHaveBeenCalledWith('test-job-id');
      expect(result).toEqual(mockBuffer);
    });

    it('should handle job not completed errors', async () => {
      vi.mocked(voiceService.downloadResult).mockRejectedValue(
        new Error('Job not completed or no output available: test-job-id'),
      );

      await expect(
        voiceController.downloadResult({ jobId: 'test-job-id' }),
      ).rejects.toThrow(
        expect.objectContaining({
          status: 400,
        }),
      );
    });
  });
});