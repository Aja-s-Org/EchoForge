import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getUniversalPresignedUrl } from '@echoforge/storage-utils';
import { Injectable } from '@nestjs/common';
import { Storage } from '@google-cloud/storage';

@Injectable()
export class StorageService {
  private get provider(): 'aws' | 'gcp' {
    const provider = process.env['CLOUD_PROVIDER'];
    if (provider === 'aws' || provider === 'gcp') return provider;
    return 'aws';
  }

  private get bucket(): string {
    return process.env['ECHOFORGE_SAMPLES_BUCKET'] ?? 'echoforge-samples';
  }

  async getUploadUrl(fileName: string, contentType: string) {
    const storedFileName = `uploads/${Date.now()}-${fileName}`;

    const url = await getUniversalPresignedUrl(
      this.provider,
      this.bucket,
      storedFileName,
      'write',
      Date.now() + 300 * 1000,
      contentType,
    );

    return { uploadUrl: url, fileName: storedFileName };
  }

  async fileExists(key: string): Promise<boolean> {
    if (this.provider === 'aws') {
      const s3 = new S3Client({
        region: process.env['AWS_REGION'] ?? 'us-east-1',
      });
      try {
        await s3.send(
          new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
        );
        return true;
      } catch (err: unknown) {
        const code = (err as { name?: string })?.name;
        if (code === 'NotFound' || code === 'NoSuchKey') {
          return false;
        }
        throw err;
      }
    }

    if (this.provider === 'gcp') {
      const storage = new Storage();
      const [exists] = await storage.bucket(this.bucket).file(key).exists();
      return exists;
    }

    throw new Error(`Cloud provider ${this.provider} not supported.`);
  }
}
