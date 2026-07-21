import { HeadObjectCommand, S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getUniversalPresignedUrl } from '@echoforge/storage-utils';
import { Injectable, Logger } from '@nestjs/common';
import { Storage } from '@google-cloud/storage';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  
  private sanitizeFileName(fileName: string): string {
    const normalizedFileName = fileName
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .replace(/[\\/]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[^a-zA-Z0-9._ -]/g, '-')
      .replace(/[- ]+/g, '-')
      .replace(/^[.-]+|[.-]+$/g, '')
      .slice(0, 100);
    return normalizedFileName || 'file';
  }

  private get provider(): 'aws' | 'gcp' {
    const provider = process.env['CLOUD_PROVIDER'];
    if (provider === 'aws' || provider === 'gcp') return provider;
    return 'aws';
  }

  private get bucket(): string {
    return process.env['ECHOFORGE_SAMPLES_BUCKET'] ?? 'echoforge-samples';
  }

  async getUploadUrl(fileName: string, contentType: string) {
    const storedFileName = `uploads/${Date.now()}-${this.sanitizeFileName(fileName)}`;

    const url = await getUniversalPresignedUrl(
      this.provider,
      this.bucket,
      storedFileName,
      'write',
      Date.now() + 300 * 1000,
      contentType
    );

    return { uploadUrl: url, fileName: storedFileName };
  }

  async fileExists(key: string): Promise<boolean> {
    if (this.provider === 'aws') {
      const s3 = new S3Client({
        region: process.env['AWS_REGION'] ?? 'us-east-1',
      });
      try {
        await s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
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

  async uploadFile(key: string, data: Buffer, contentType?: string): Promise<void> {
    try {
      if (this.provider === 'aws') {
        const s3 = new S3Client({
          region: process.env['AWS_REGION'] ?? 'us-east-1',
        });

        await s3.send(new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: data,
          ContentType: contentType || 'application/octet-stream',
        }));

        this.logger.log(`Uploaded file to S3: ${key} (${data.length} bytes)`);
      } else if (this.provider === 'gcp') {
        const storage = new Storage();
        const file = storage.bucket(this.bucket).file(key);
        
        await file.save(data, {
          contentType: contentType || 'application/octet-stream',
        });

        this.logger.log(`Uploaded file to GCS: ${key} (${data.length} bytes)`);
      } else {
        throw new Error(`Cloud provider ${this.provider} not supported.`);
      }
    } catch (error) {
      this.logger.error(`Failed to upload file ${key}`, error);
      throw error;
    }
  }

  async downloadFile(key: string): Promise<Buffer> {
    try {
      if (this.provider === 'aws') {
        const s3 = new S3Client({
          region: process.env['AWS_REGION'] ?? 'us-east-1',
        });

        const response = await s3.send(new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }));

        const chunks: Buffer[] = [];
        for await (const chunk of response.Body as any) {
          chunks.push(chunk);
        }

        const data = Buffer.concat(chunks);
        this.logger.log(`Downloaded file from S3: ${key} (${data.length} bytes)`);
        return data;
      } else if (this.provider === 'gcp') {
        const storage = new Storage();
        const file = storage.bucket(this.bucket).file(key);
        
        const [data] = await file.download();
        
        this.logger.log(`Downloaded file from GCS: ${key} (${data.length} bytes)`);
        return data;
      } else {
        throw new Error(`Cloud provider ${this.provider} not supported.`);
      }
    } catch (error) {
      this.logger.error(`Failed to download file ${key}`, error);
      throw error;
    }
  }

  async deleteFile(key: string): Promise<void> {
    try {
      if (this.provider === 'aws') {
        const s3 = new S3Client({
          region: process.env['AWS_REGION'] ?? 'us-east-1',
        });

        await s3.send(new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }));

        this.logger.log(`Deleted file from S3: ${key}`);
      } else if (this.provider === 'gcp') {
        const storage = new Storage();
        const file = storage.bucket(this.bucket).file(key);
        
        await file.delete();
        
        this.logger.log(`Deleted file from GCS: ${key}`);
      } else {
        throw new Error(`Cloud provider ${this.provider} not supported.`);
      }
    } catch (error) {
      this.logger.error(`Failed to delete file ${key}`, error);
      throw error;
    }
  }

  async getFileSize(key: string): Promise<number> {
    try {
      if (this.provider === 'aws') {
        const s3 = new S3Client({
          region: process.env['AWS_REGION'] ?? 'us-east-1',
        });

        const response = await s3.send(new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }));

        return response.ContentLength || 0;
      } else if (this.provider === 'gcp') {
        const storage = new Storage();
        const file = storage.bucket(this.bucket).file(key);
        
        const [metadata] = await file.getMetadata();
        
        return parseInt(metadata.size || '0', 10);
      } else {
        throw new Error(`Cloud provider ${this.provider} not supported.`);
      }
    } catch (error) {
      this.logger.error(`Failed to get file size for ${key}`, error);
      return 0;
    }
  }

  async generateVoiceResultFileName(jobId: string, format: string = 'wav'): Promise<string> {
    const timestamp = Date.now();
    return `voice_results/${jobId}-${timestamp}.${format}`;
  }

  async generateVoiceSampleFileName(originalName: string): Promise<string> {
    const timestamp = Date.now();
    const sanitizedName = this.sanitizeFileName(originalName);
    return `voice_samples/${timestamp}-${sanitizedName}`;
  }
}
