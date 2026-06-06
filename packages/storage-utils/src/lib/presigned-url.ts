import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl as getAwsSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Storage } from '@google-cloud/storage';

export async function getUniversalPresignedUrl(
  provider: 'aws' | 'gcp',
  bucket: string,
  key: string,
  operation: 'read' | 'write',
  expiresAt: Date | number,
  contentType?: string
) {
  const expiryDate = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  const now = new Date();

  if (expiryDate <= now) {
    throw new Error('EchoForge Error: expiresAt must be in the future.');
  }

  if (provider === 'aws') {
    const s3 = new S3Client({ region: process.env['AWS_REGION'] || 'us-east-1' });
    
    const command = operation === 'read' 
      ? new GetObjectCommand({ Bucket: bucket, Key: key })
      : new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });

    const expiresInSeconds = Math.floor((expiryDate.getTime() - now.getTime()) / 1000);

    return getAwsSignedUrl(s3, command, { expiresIn: expiresInSeconds });
  }

  if (provider === 'gcp') {
    const storage = new Storage();
    
    const [url] = await storage
      .bucket(bucket)
      .file(key)
      .getSignedUrl({
        version: 'v4',
        action: operation,
        expires: expiryDate,
        contentType: contentType
      });
      
    return url;
  }

  throw new Error(`Cloud provider ${provider} not supported by EchoForge.`);
}
