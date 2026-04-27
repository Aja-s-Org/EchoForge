import { getUniversalPresignedUrl } from '@echoforge/storage-utils';
import { Injectable } from '@nestjs/common';

@Injectable()
export class StorageService {
  async getUploadUrl(fileName: string, contentType: string) {
    const provider = (process.env['CLOUD_PROVIDER'] as 'aws' | 'gcp') ?? 'aws';
    const bucket =
      process.env['ECHOFORGE_SAMPLES_BUCKET'] ?? 'echoforge-samples';

    const url = await getUniversalPresignedUrl(
      provider,
      bucket,
      `uploads/${Date.now()}-${fileName}`,
      'write',
      Date.now() + 300 * 1000, // 5 minute window,
      contentType
    );

    return { uploadUrl: url };
  }
}
