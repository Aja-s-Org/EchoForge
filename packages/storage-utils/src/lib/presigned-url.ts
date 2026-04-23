import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl as getAwsSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Storage } from '@google-cloud/storage';

export async function getUniversalPresignedUrl(
  provider: 'aws' | 'gcp',
  bucket: string,
  key: string,
  operation: 'read' | 'write',
  expiresAt: Date | number, // Accepts a Date object or unix timestamp
  contentType?: string // Optional content type for write operations
) {
  // 1. Standardize the expiration timestamp
  const expiryDate = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  const now = new Date();

  if (expiryDate <= now) {
    throw new Error('EchoForge Error: expiresAt must be in the future.');
  }

  if (provider === 'aws') {
    const s3 = new S3Client({ region: process.env['AWS_REGION'] || 'us-east-1' });
    
    // Determine the correct AWS Command
    const command = operation === 'read' 
      ? new GetObjectCommand({ Bucket: bucket, Key: key })
      : new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });

    // AWS requires relative seconds from now
    const expiresInSeconds = Math.floor((expiryDate.getTime() - now.getTime()) / 1000);

    return getAwsSignedUrl(s3, command, { expiresIn: expiresInSeconds });
  }

  if (provider === 'gcp') {
    const storage = new Storage();
    
    // GCP uses 'action' strings matching your operation
    const [url] = await storage
      .bucket(bucket)
      .file(key)
      .getSignedUrl({
        version: 'v4',
        action: operation, // 'read' or 'write'
        expires: expiryDate, // GCP accepts Date objects directly
        contentType: contentType // Optional content type for write operations
      });
      
    return url;
  }

  throw new Error(`Cloud provider ${provider} not supported by EchoForge.`);
}