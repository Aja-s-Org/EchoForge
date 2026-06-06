import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StorageService } from './storage.service';

// Mock AWS SDK
vi.mock('@aws-sdk/client-s3', () => {
  const HeadObjectCommand = vi.fn();
  const send = vi.fn();
  const S3Client = vi.fn(() => ({ send }));
  return { HeadObjectCommand, S3Client };
});

// Mock GCP Storage
vi.mock('@google-cloud/storage', () => {
  const exists = vi.fn();
  const file = vi.fn(() => ({ exists }));
  const bucket = vi.fn(() => ({ file }));
  const Storage = vi.fn(() => ({ bucket }));
  return { Storage };
});

// Mock storage-utils
vi.mock('@echoforge/storage-utils', () => ({
  getUniversalPresignedUrl: vi.fn(),
}));

import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import { Storage } from '@google-cloud/storage';
import { getUniversalPresignedUrl } from '@echoforge/storage-utils';

describe('StorageService', () => {
  let service: StorageService;
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    service = new StorageService();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getUploadUrl', () => {
    beforeEach(() => {
      vi.mocked(getUniversalPresignedUrl).mockResolvedValue(
        'https://presigned.url/upload',
      );
    });

    it('should generate upload URL with timestamped file name', async () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      const result = await service.getUploadUrl('audio.wav', 'audio/wav');

      expect(result.uploadUrl).toBe('https://presigned.url/upload');
      expect(result.fileName).toBe(`uploads/${now}-audio.wav`);
      expect(getUniversalPresignedUrl).toHaveBeenCalledWith(
        'aws',
        'echoforge-samples',
        `uploads/${now}-audio.wav`,
        'write',
        expect.any(Number),
        'audio/wav',
      );
    });

    it('should use AWS provider by default', async () => {
      await service.getUploadUrl('file.txt', 'text/plain');

      expect(getUniversalPresignedUrl).toHaveBeenCalledWith(
        'aws',
        expect.any(String),
        expect.any(String),
        'write',
        expect.any(Number),
        'text/plain',
      );
    });

    it('should use GCP provider when CLOUD_PROVIDER is gcp', async () => {
      process.env['CLOUD_PROVIDER'] = 'gcp';
      service = new StorageService();

      await service.getUploadUrl('file.txt', 'text/plain');

      expect(getUniversalPresignedUrl).toHaveBeenCalledWith(
        'gcp',
        expect.any(String),
        expect.any(String),
        'write',
        expect.any(Number),
        'text/plain',
      );
    });

    it('should use custom bucket when ECHOFORGE_SAMPLES_BUCKET is set', async () => {
      process.env['ECHOFORGE_SAMPLES_BUCKET'] = 'custom-bucket';
      service = new StorageService();

      await service.getUploadUrl('file.txt', 'text/plain');

      expect(getUniversalPresignedUrl).toHaveBeenCalledWith(
        expect.any(String),
        'custom-bucket',
        expect.any(String),
        'write',
        expect.any(Number),
        'text/plain',
      );
    });

    it('should set expiration to 5 minutes in the future', async () => {
      const now = 1234567890000;
      vi.spyOn(Date, 'now').mockReturnValue(now);

      await service.getUploadUrl('file.txt', 'text/plain');

      expect(getUniversalPresignedUrl).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        'write',
        now + 300_000,
        'text/plain',
      );
    });

    it('should handle file names with special characters', async () => {
      const fileName = 'my audio file (v2).wav';
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      const result = await service.getUploadUrl(fileName, 'audio/wav');

      expect(result.fileName).toBe(`uploads/${now}-${fileName}`);
    });

    it('should propagate errors from getUniversalPresignedUrl', async () => {
      vi.mocked(getUniversalPresignedUrl).mockRejectedValue(
        new Error('Cloud provider error'),
      );

      await expect(service.getUploadUrl('file.txt', 'text/plain')).rejects.toThrow(
        'Cloud provider error',
      );
    });
  });

  describe('fileExists - AWS', () => {
    let mockSend: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      process.env['CLOUD_PROVIDER'] = 'aws';
      process.env['AWS_REGION'] = 'us-west-2';
      service = new StorageService();
      mockSend = vi.fn();
      vi.mocked(S3Client).mockImplementation(() => ({ send: mockSend }) as any);
    });

    it('should return true when file exists', async () => {
      mockSend.mockResolvedValue({});

      const result = await service.fileExists('uploads/1234567890-audio.wav');

      expect(result).toBe(true);
      expect(S3Client).toHaveBeenCalledWith({ region: 'us-west-2' });
      expect(HeadObjectCommand).toHaveBeenCalledWith({
        Bucket: 'echoforge-samples',
        Key: 'uploads/1234567890-audio.wav',
      });
    });

    it('should return false when file does not exist (NotFound)', async () => {
      mockSend.mockRejectedValue({ name: 'NotFound' });

      const result = await service.fileExists('uploads/nonexistent.wav');

      expect(result).toBe(false);
    });

    it('should return false when file does not exist (NoSuchKey)', async () => {
      mockSend.mockRejectedValue({ name: 'NoSuchKey' });

      const result = await service.fileExists('uploads/missing.wav');

      expect(result).toBe(false);
    });

    it('should throw error for other AWS errors', async () => {
      mockSend.mockRejectedValue({ name: 'AccessDenied', message: 'Access denied' });

      await expect(service.fileExists('uploads/file.wav')).rejects.toMatchObject({
        name: 'AccessDenied',
      });
    });

    it('should use default region if AWS_REGION not set', async () => {
      delete process.env['AWS_REGION'];
      service = new StorageService();
      mockSend.mockResolvedValue({});

      await service.fileExists('uploads/file.wav');

      expect(S3Client).toHaveBeenCalledWith({ region: 'us-east-1' });
    });

    it('should use custom bucket when configured', async () => {
      process.env['ECHOFORGE_SAMPLES_BUCKET'] = 'my-custom-bucket';
      service = new StorageService();
      mockSend.mockResolvedValue({});

      await service.fileExists('uploads/file.wav');

      expect(HeadObjectCommand).toHaveBeenCalledWith({
        Bucket: 'my-custom-bucket',
        Key: 'uploads/file.wav',
      });
    });
  });

  describe('fileExists - GCP', () => {
    let mockExists: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      process.env['CLOUD_PROVIDER'] = 'gcp';
      service = new StorageService();
      mockExists = vi.fn();
      vi.mocked(Storage).mockImplementation(
        () =>
          ({
            bucket: vi.fn(() => ({
              file: vi.fn(() => ({
                exists: mockExists,
              })),
            })),
          }) as any,
      );
    });

    it('should return true when file exists', async () => {
      mockExists.mockResolvedValue([true]);

      const result = await service.fileExists('uploads/1234567890-audio.wav');

      expect(result).toBe(true);
      expect(Storage).toHaveBeenCalled();
    });

    it('should return false when file does not exist', async () => {
      mockExists.mockResolvedValue([false]);

      const result = await service.fileExists('uploads/nonexistent.wav');

      expect(result).toBe(false);
    });

    it('should use configured bucket', async () => {
      process.env['ECHOFORGE_SAMPLES_BUCKET'] = 'gcp-bucket';
      service = new StorageService();
      const bucketMock = vi.fn(() => ({
        file: vi.fn(() => ({ exists: mockExists })),
      }));
      vi.mocked(Storage).mockImplementation(() => ({ bucket: bucketMock }) as any);
      mockExists.mockResolvedValue([true]);

      await service.fileExists('uploads/file.wav');

      expect(bucketMock).toHaveBeenCalledWith('gcp-bucket');
    });

    it('should propagate GCP errors', async () => {
      mockExists.mockRejectedValue(new Error('GCP permission error'));

      await expect(service.fileExists('uploads/file.wav')).rejects.toThrow(
        'GCP permission error',
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle concurrent getUploadUrl calls with different timestamps', async () => {
      vi.mocked(getUniversalPresignedUrl).mockResolvedValue('https://url');
      let timestamp = 1000000;
      vi.spyOn(Date, 'now').mockImplementation(() => timestamp++);

      const [result1, result2] = await Promise.all([
        service.getUploadUrl('file1.wav', 'audio/wav'),
        service.getUploadUrl('file2.wav', 'audio/wav'),
      ]);

      expect(result1.fileName).not.toBe(result2.fileName);
    });

    it('should handle very long file names', async () => {
      vi.mocked(getUniversalPresignedUrl).mockResolvedValue('https://url');
      const longName = 'a'.repeat(200) + '.wav';

      const result = await service.getUploadUrl(longName, 'audio/wav');

      expect(result.fileName).toContain(longName);
    });
  });
});
