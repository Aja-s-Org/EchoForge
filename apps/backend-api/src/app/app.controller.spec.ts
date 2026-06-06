import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnprocessableEntityException } from '@nestjs/common';
import { AppController } from './app.controller';
import { StorageService } from '../services/storage.service';
import type { ProcessVoiceDto, RequestUploadDto } from './dto/voice.schemas';

describe('AppController', () => {
  let controller: AppController;
  let storageService: StorageService;

  beforeEach(() => {
    storageService = {
      getUploadUrl: vi.fn(),
      fileExists: vi.fn(),
    } as any;

    controller = new AppController(storageService);
  });

  describe('requestUpload', () => {
    it('should return upload URL and fileName', async () => {
      const mockResponse = {
        uploadUrl: 'https://s3.amazonaws.com/presigned',
        fileName: 'uploads/1234567890-audio.wav',
      };
      vi.mocked(storageService.getUploadUrl).mockResolvedValue(mockResponse);

      const dto: RequestUploadDto = {
        fileName: 'audio.wav',
        contentType: 'audio/wav',
      };

      const result = await controller.requestUpload(dto);

      expect(result).toEqual(mockResponse);
      expect(storageService.getUploadUrl).toHaveBeenCalledWith('audio.wav', 'audio/wav');
      expect(storageService.getUploadUrl).toHaveBeenCalledTimes(1);
    });

    it('should handle different content types', async () => {
      vi.mocked(storageService.getUploadUrl).mockResolvedValue({
        uploadUrl: 'https://url',
        fileName: 'uploads/123-video.mp4',
      });

      const dto: RequestUploadDto = {
        fileName: 'video.mp4',
        contentType: 'video/mp4',
      };

      await controller.requestUpload(dto);

      expect(storageService.getUploadUrl).toHaveBeenCalledWith('video.mp4', 'video/mp4');
    });

    it('should handle file names with special characters', async () => {
      vi.mocked(storageService.getUploadUrl).mockResolvedValue({
        uploadUrl: 'https://url',
        fileName: 'uploads/123-my file (v2).wav',
      });

      const dto: RequestUploadDto = {
        fileName: 'my file (v2).wav',
        contentType: 'audio/wav',
      };

      await controller.requestUpload(dto);

      expect(storageService.getUploadUrl).toHaveBeenCalledWith(
        'my file (v2).wav',
        'audio/wav',
      );
    });

    it('should propagate storage service errors', async () => {
      vi.mocked(storageService.getUploadUrl).mockRejectedValue(
        new Error('Storage unavailable'),
      );

      const dto: RequestUploadDto = {
        fileName: 'audio.wav',
        contentType: 'audio/wav',
      };

      await expect(controller.requestUpload(dto)).rejects.toThrow('Storage unavailable');
    });
  });

  describe('processVoice', () => {
    const validDto: ProcessVoiceDto = {
      transcript: 'This is a test transcript.',
      fileName: 'uploads/1234567890-audio.wav',
    };

    it('should return success when file exists', async () => {
      vi.mocked(storageService.fileExists).mockResolvedValue(true);

      const result = await controller.processVoice(validDto);

      expect(result).toEqual({ status: 'ok' });
      expect(storageService.fileExists).toHaveBeenCalledWith(
        'uploads/1234567890-audio.wav',
      );
      expect(storageService.fileExists).toHaveBeenCalledTimes(1);
    });

    it('should throw UnprocessableEntityException when file does not exist', async () => {
      vi.mocked(storageService.fileExists).mockResolvedValue(false);

      await expect(controller.processVoice(validDto)).rejects.toThrow(
        UnprocessableEntityException,
      );

      try {
        await controller.processVoice(validDto);
      } catch (error: any) {
        expect(error).toBeInstanceOf(UnprocessableEntityException);
        expect(error.message).toContain('No file found');
        expect(error.message).toContain('uploads/1234567890-audio.wav');
        expect(error.message).toContain('Make sure the upload completed');
      }
    });

    it('should handle long transcripts', async () => {
      vi.mocked(storageService.fileExists).mockResolvedValue(true);

      const longDto: ProcessVoiceDto = {
        transcript: 'word '.repeat(10_000),
        fileName: 'uploads/1234567890-audio.wav',
      };

      const result = await controller.processVoice(longDto);

      expect(result).toEqual({ status: 'ok' });
    });

    it('should handle transcripts with special characters', async () => {
      vi.mocked(storageService.fileExists).mockResolvedValue(true);

      const specialDto: ProcessVoiceDto = {
        transcript: 'Hello 世界! Émojis: 🎉🎊 Symbols: @#$%^&*()',
        fileName: 'uploads/1234567890-audio.wav',
      };

      const result = await controller.processVoice(specialDto);

      expect(result).toEqual({ status: 'ok' });
    });

    it('should handle transcripts with newlines and tabs', async () => {
      vi.mocked(storageService.fileExists).mockResolvedValue(true);

      const multilineDto: ProcessVoiceDto = {
        transcript: 'Line 1\nLine 2\n\tIndented',
        fileName: 'uploads/1234567890-audio.wav',
      };

      const result = await controller.processVoice(multilineDto);

      expect(result).toEqual({ status: 'ok' });
    });

    it('should propagate storage service errors', async () => {
      vi.mocked(storageService.fileExists).mockRejectedValue(
        new Error('Storage connection failed'),
      );

      await expect(controller.processVoice(validDto)).rejects.toThrow(
        'Storage connection failed',
      );
    });

    it('should check file existence before returning success', async () => {
      const fileExistsSpy = vi
        .mocked(storageService.fileExists)
        .mockResolvedValue(true);

      await controller.processVoice(validDto);

      // Verify it was called
      expect(fileExistsSpy).toHaveBeenCalledWith('uploads/1234567890-audio.wav');
      expect(fileExistsSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle different file name patterns', async () => {
      vi.mocked(storageService.fileExists).mockResolvedValue(true);

      const fileNames = [
        'uploads/1234567890-audio.wav',
        'uploads/9999999999-recording.mp3',
        'uploads/1111111111-file_with-special.chars.ogg',
      ];

      for (const fileName of fileNames) {
        const dto: ProcessVoiceDto = {
          transcript: 'Test',
          fileName,
        };

        const result = await controller.processVoice(dto);
        expect(result).toEqual({ status: 'ok' });
      }

      expect(storageService.fileExists).toHaveBeenCalledTimes(fileNames.length);
    });

    it('should provide helpful error message with fileName', async () => {
      vi.mocked(storageService.fileExists).mockResolvedValue(false);

      const dto: ProcessVoiceDto = {
        transcript: 'Test',
        fileName: 'uploads/1234567890-missing.wav',
      };

      try {
        await controller.processVoice(dto);
        expect.fail('Should have thrown UnprocessableEntityException');
      } catch (error: any) {
        expect(error.message).toContain('uploads/1234567890-missing.wav');
      }
    });
  });

  describe('Integration scenarios', () => {
    it('should handle full upload-process flow', async () => {
      // Step 1: Request upload
      vi.mocked(storageService.getUploadUrl).mockResolvedValue({
        uploadUrl: 'https://presigned.url',
        fileName: 'uploads/1234567890-audio.wav',
      });

      const uploadDto: RequestUploadDto = {
        fileName: 'audio.wav',
        contentType: 'audio/wav',
      };

      const uploadResult = await controller.requestUpload(uploadDto);

      // Step 2: Process with returned fileName
      vi.mocked(storageService.fileExists).mockResolvedValue(true);

      const processDto: ProcessVoiceDto = {
        transcript: 'This is the transcribed audio.',
        fileName: uploadResult.fileName,
      };

      const processResult = await controller.processVoice(processDto);

      expect(processResult).toEqual({ status: 'ok' });
      expect(storageService.fileExists).toHaveBeenCalledWith(uploadResult.fileName);
    });

    it('should fail process if file was not uploaded', async () => {
      // Step 1: Get upload URL
      vi.mocked(storageService.getUploadUrl).mockResolvedValue({
        uploadUrl: 'https://presigned.url',
        fileName: 'uploads/1234567890-audio.wav',
      });

      const uploadResult = await controller.requestUpload({
        fileName: 'audio.wav',
        contentType: 'audio/wav',
      });

      // Step 2: Try to process without uploading (file doesn't exist)
      vi.mocked(storageService.fileExists).mockResolvedValue(false);

      const processDto: ProcessVoiceDto = {
        transcript: 'Test transcript',
        fileName: uploadResult.fileName,
      };

      await expect(controller.processVoice(processDto)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });

  describe('Error handling', () => {
    it('should handle undefined returned from storage service', async () => {
      vi.mocked(storageService.getUploadUrl).mockResolvedValue(undefined as any);

      const dto: RequestUploadDto = {
        fileName: 'file.wav',
        contentType: 'audio/wav',
      };

      const result = await controller.requestUpload(dto);
      expect(result).toBeUndefined();
    });

    it('should handle network timeout errors', async () => {
      vi.mocked(storageService.fileExists).mockRejectedValue(
        new Error('ETIMEDOUT: Connection timeout'),
      );

      const dto: ProcessVoiceDto = {
        transcript: 'Test',
        fileName: 'uploads/1234567890-audio.wav',
      };

      await expect(controller.processVoice(dto)).rejects.toThrow('ETIMEDOUT');
    });
  });
});
