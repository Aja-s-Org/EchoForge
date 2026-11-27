import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StreamableFile } from '@nestjs/common';
import { VoiceController } from './voice.controller';
import { VoiceService } from '../services/voice.service';
import { ErrorHandlerService } from '../services/error-handler.service';
import { DatabaseService } from '../services/database.service';
import { MetricsService } from '../services/metrics.service';
import { StorageService } from '../services/storage.service';
import { UploadAndCloneSchema } from './dto/voice-cloning.schemas';

describe('VoiceController', () => {
  let voiceController: VoiceController;
  let voiceService: VoiceService;
  let storageService: StorageService;

  beforeEach(() => {
    vi.clearAllMocks();
    voiceService = {
      cloneVoice: vi.fn(),
      getJobStatus: vi.fn(),
      downloadResult: vi.fn(),
    } as any;
    storageService = { uploadFile: vi.fn().mockResolvedValue(undefined) } as unknown as StorageService;

    // The real error handler maps errors to HTTP statuses; its database and
    // metrics services are in-memory.
    const databaseService = new DatabaseService();
    const errorHandler = new ErrorHandlerService(databaseService, new MetricsService(databaseService));

    voiceController = new VoiceController(voiceService, errorHandler, storageService);
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
      expect(result).toBeInstanceOf(StreamableFile);
      expect(result.getHeaders()).toEqual({
        type: 'audio/wav',
        disposition: 'attachment; filename="test-job-id.wav"',
        length: mockBuffer.length,
      });
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

  describe('cloneWithUpload', () => {
    const req = { ip: '127.0.0.1', connection: { remoteAddress: '127.0.0.1' } } as any;
    const file = (overrides: Record<string, unknown> = {}) => ({
      fieldname: 'voiceSample',
      originalname: 'my voice.wav',
      mimetype: 'audio/wav',
      size: 4,
      buffer: Buffer.from('RIFF'),
      ...overrides,
    });
    const body = UploadAndCloneSchema.parse({ transcription: 'Hello', sampleTranscript: 'My voice.', speed: '1.5' });

    it('stores the uploaded sample and queues a job for it', async () => {
      vi.mocked(voiceService.cloneVoice).mockResolvedValue({ jobId: 'a'.repeat(32), status: 'queued' });

      await voiceController.cloneWithUpload(file(), body, req);

      const [storedKey, data, contentType] = vi.mocked(storageService.uploadFile).mock.calls[0];
      expect(storedKey).toMatch(/^uploads\/\d+-my-voice\.wav$/);
      expect(data).toEqual(Buffer.from('RIFF'));
      expect(contentType).toBe('audio/wav');
      expect(voiceService.cloneVoice).toHaveBeenCalledWith(
        {
          voiceSampleFile: storedKey,
          transcription: 'Hello',
          sampleTranscript: 'My voice.',
          language: 'en',
          speed: 1.5,
        },
        '127.0.0.1',
      );
    });

    it('rejects a missing file', async () => {
      await expect(voiceController.cloneWithUpload(undefined as any, body, req)).rejects.toThrow(
        expect.objectContaining({ status: 400 }),
      );
      expect(storageService.uploadFile).not.toHaveBeenCalled();
    });

    it('rejects a file that is not audio', async () => {
      await expect(voiceController.cloneWithUpload(file({ mimetype: 'text/plain' }), body, req)).rejects.toThrow(
        expect.objectContaining({ status: 400 }),
      );
      expect(storageService.uploadFile).not.toHaveBeenCalled();
    });

    it('rejects a sample larger than the inference service accepts', async () => {
      await expect(
        voiceController.cloneWithUpload(file({ size: 10 * 1024 * 1024 + 1 }), body, req),
      ).rejects.toThrow(expect.objectContaining({ status: 413 }));
      expect(storageService.uploadFile).not.toHaveBeenCalled();
    });
  });
});