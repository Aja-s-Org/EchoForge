import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getUniversalPresignedUrl } from './presigned-url';

// Mock AWS SDK
vi.mock('@aws-sdk/client-s3', () => {
  const GetObjectCommand = vi.fn();
  const PutObjectCommand = vi.fn();
  const S3Client = vi.fn(() => ({
    send: vi.fn(),
  }));
  return { GetObjectCommand, PutObjectCommand, S3Client };
});

// Mock AWS presigner
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(),
}));

// Mock GCP Storage
vi.mock('@google-cloud/storage', () => {
  const getSignedUrl = vi.fn();
  const file = vi.fn(() => ({ getSignedUrl }));
  const bucket = vi.fn(() => ({ file }));
  const Storage = vi.fn(() => ({ bucket }));
  return { Storage };
});

import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl as getAwsSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Storage } from '@google-cloud/storage';

describe('getUniversalPresignedUrl', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('AWS provider', () => {
    beforeEach(() => {
      process.env['AWS_REGION'] = 'us-west-2';
      vi.mocked(getAwsSignedUrl).mockResolvedValue('https://s3.aws.presigned.url');
    });

    it('should generate presigned URL for read operation', async () => {
      const now = Date.now();
      const expiresAt = now + 600_000; // 10 minutes

      const url = await getUniversalPresignedUrl(
        'aws',
        'test-bucket',
        'uploads/file.wav',
        'read',
        expiresAt,
      );

      expect(url).toBe('https://s3.aws.presigned.url');
      expect(S3Client).toHaveBeenCalledWith({ region: 'us-west-2' });
      expect(GetObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'uploads/file.wav',
      });
      expect(getAwsSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          expiresIn: expect.any(Number),
        }),
      );
    });

    it('should generate presigned URL for write operation with contentType', async () => {
      const now = Date.now();
      const expiresAt = now + 300_000; // 5 minutes

      const url = await getUniversalPresignedUrl(
        'aws',
        'test-bucket',
        'uploads/audio.mp3',
        'write',
        expiresAt,
        'audio/mpeg',
      );

      expect(url).toBe('https://s3.aws.presigned.url');
      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'uploads/audio.mp3',
        ContentType: 'audio/mpeg',
      });
    });

    it('should accept Date object for expiresAt', async () => {
      const expiresAt = new Date(Date.now() + 600_000);

      const url = await getUniversalPresignedUrl(
        'aws',
        'test-bucket',
        'file.txt',
        'read',
        expiresAt,
      );

      expect(url).toBe('https://s3.aws.presigned.url');
      expect(getAwsSignedUrl).toHaveBeenCalled();
    });

    it('should use default region if AWS_REGION not set', async () => {
      delete process.env['AWS_REGION'];

      await getUniversalPresignedUrl(
        'aws',
        'test-bucket',
        'file.txt',
        'read',
        Date.now() + 300_000,
      );

      expect(S3Client).toHaveBeenCalledWith({ region: 'us-east-1' });
    });

    it('should throw error if expiresAt is in the past', async () => {
      const pastTimestamp = Date.now() - 10_000;

      await expect(
        getUniversalPresignedUrl('aws', 'test-bucket', 'file.txt', 'read', pastTimestamp),
      ).rejects.toThrow('EchoForge Error: expiresAt must be in the future.');
    });

    it('should throw error if expiresAt is exactly now', async () => {
      const now = new Date();
      vi.useFakeTimers();
      vi.setSystemTime(now);

      await expect(
        getUniversalPresignedUrl('aws', 'test-bucket', 'file.txt', 'read', now),
      ).rejects.toThrow('EchoForge Error: expiresAt must be in the future.');

      vi.useRealTimers();
    });
  });

  describe('GCP provider', () => {
    let mockGetSignedUrl: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockGetSignedUrl = vi.fn().mockResolvedValue(['https://gcs.presigned.url']);
      vi.mocked(Storage).mockImplementation(
        () =>
          ({
            bucket: vi.fn(() => ({
              file: vi.fn(() => ({
                getSignedUrl: mockGetSignedUrl,
              })),
            })),
          }) as any,
      );
    });

    it('should generate presigned URL for read operation', async () => {
      const expiresAt = new Date(Date.now() + 600_000);

      const url = await getUniversalPresignedUrl(
        'gcp',
        'gcp-bucket',
        'uploads/recording.wav',
        'read',
        expiresAt,
      );

      expect(url).toBe('https://gcs.presigned.url');
      expect(Storage).toHaveBeenCalled();
      expect(mockGetSignedUrl).toHaveBeenCalledWith({
        version: 'v4',
        action: 'read',
        expires: expiresAt,
        contentType: undefined,
      });
    });

    it('should generate presigned URL for write operation with contentType', async () => {
      const expiresAt = new Date(Date.now() + 300_000);

      const url = await getUniversalPresignedUrl(
        'gcp',
        'gcp-bucket',
        'uploads/video.mp4',
        'write',
        expiresAt,
        'video/mp4',
      );

      expect(url).toBe('https://gcs.presigned.url');
      expect(mockGetSignedUrl).toHaveBeenCalledWith({
        version: 'v4',
        action: 'write',
        expires: expiresAt,
        contentType: 'video/mp4',
      });
    });

    it('should convert timestamp to Date for GCP', async () => {
      const timestamp = Date.now() + 300_000;

      await getUniversalPresignedUrl('gcp', 'gcp-bucket', 'file.txt', 'read', timestamp);

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          expires: expect.any(Date),
        }),
      );
    });

    it('should throw error if expiresAt is in the past', async () => {
      const pastDate = new Date(Date.now() - 10_000);

      await expect(
        getUniversalPresignedUrl('gcp', 'gcp-bucket', 'file.txt', 'read', pastDate),
      ).rejects.toThrow('EchoForge Error: expiresAt must be in the future.');
    });
  });

  describe('Unsupported provider', () => {
    it('should throw error for unknown provider', async () => {
      await expect(
        getUniversalPresignedUrl(
          'azure' as any,
          'test-bucket',
          'file.txt',
          'read',
          Date.now() + 300_000,
        ),
      ).rejects.toThrow('Cloud provider azure not supported by EchoForge.');
    });
  });

  describe('Edge cases', () => {
    beforeEach(() => {
      vi.mocked(getAwsSignedUrl).mockResolvedValue('https://aws.url');
    });

    it('should handle keys with special characters', async () => {
      const specialKey = 'uploads/file with spaces & symbols!@#.wav';

      await getUniversalPresignedUrl(
        'aws',
        'test-bucket',
        specialKey,
        'read',
        Date.now() + 300_000,
      );

      expect(GetObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: specialKey,
      });
    });

    it('should handle very long expiration times', async () => {
      const farFuture = Date.now() + 86_400_000 * 7; // 7 days

      const url = await getUniversalPresignedUrl(
        'aws',
        'test-bucket',
        'file.txt',
        'read',
        farFuture,
      );

      expect(url).toBe('https://aws.url');
    });

    it('should handle minimal valid expiration (1ms in future)', async () => {
      const justFuture = Date.now() + 1;

      const url = await getUniversalPresignedUrl(
        'aws',
        'test-bucket',
        'file.txt',
        'read',
        justFuture,
      );

      expect(url).toBe('https://aws.url');
    });
  });
});
