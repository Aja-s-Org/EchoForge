import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl as getAwsSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Storage } from '@google-cloud/storage';

export async function getEchoForgeUrl(
  provider: 'aws' | 'gcp',
  bucket: string,
  key: string
) {
  if (provider === 'aws') {
    const s3 = new S3Client({ region: process.env['AWS_REGION'] });
    return getAwsSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: 300 }
    );
  }
  const [url] = await new Storage()
    .bucket(bucket)
    .file(key)
    .getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 300 * 1000,
    });
  return url;
}
