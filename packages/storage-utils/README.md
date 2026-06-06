# @echoforge/storage-utils

Universal cloud storage utility library providing a consistent interface for AWS S3 and Google Cloud Storage operations.

## Features

- **Unified API**: Single function interface for both AWS and GCP
- **Presigned URLs**: Generate time-limited upload/download URLs
- **Type Safety**: Full TypeScript support
- **Flexible Expiration**: Accepts both Date objects and Unix timestamps
- **Environment-Aware**: Configurable via environment variables

## Installation

This is a workspace-internal package. Import it in other workspace projects:

```typescript
import { getUniversalPresignedUrl } from '@echoforge/storage-utils';
```

## Usage

### Generate Presigned URL

```typescript
import { getUniversalPresignedUrl } from '@echoforge/storage-utils';

// AWS S3 - Upload URL
const uploadUrl = await getUniversalPresignedUrl(
  'aws',                              // provider
  'my-bucket',                        // bucket name
  'uploads/audio.wav',                // object key
  'write',                            // operation: 'read' | 'write'
  Date.now() + 300_000,               // expires in 5 minutes
  'audio/wav'                         // content type (optional, for writes)
);

// GCP Cloud Storage - Download URL
const downloadUrl = await getUniversalPresignedUrl(
  'gcp',                              // provider
  'my-gcs-bucket',                    // bucket name
  'uploads/audio.wav',                // object key
  'read',                             // operation
  new Date(Date.now() + 3600_000)     // expires in 1 hour (Date object)
);
```

### Parameters

```typescript
getUniversalPresignedUrl(
  provider: 'aws' | 'gcp',
  bucket: string,
  key: string,
  operation: 'read' | 'write',
  expiresAt: Date | number,          // Date object or Unix timestamp (ms)
  contentType?: string               // Required for write operations
): Promise<string>
```

### Environment Variables

**AWS:**
- `AWS_REGION`: AWS region (default: `us-east-1`)
- AWS credentials are loaded from the standard credential chain (env vars, IAM roles, etc.)

**GCP:**
- `GOOGLE_APPLICATION_CREDENTIALS`: Path to service account JSON key file
- Or use Application Default Credentials (ADC) in GCP environments

## Examples

### Upload Flow

```typescript
// 1. Backend: Generate presigned upload URL
const { uploadUrl, fileName } = await storageService.getUploadUrl(
  'audio.wav',
  'audio/wav'
);

// 2. Client: Upload file directly to cloud storage
await fetch(uploadUrl, {
  method: 'PUT',
  headers: { 'Content-Type': 'audio/wav' },
  body: audioFile
});

// 3. Client: Notify backend that upload is complete
await fetch('/api/voice/process', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ transcript, fileName })
});
```

### Download Flow

```typescript
// Generate download URL
const downloadUrl = await getUniversalPresignedUrl(
  'gcp',
  'storage-bucket',
  'processed/result.mp3',
  'read',
  Date.now() + 3600_000  // 1 hour expiration
);

// Client can now download directly from cloud storage
window.location.href = downloadUrl;
```

## Error Handling

### Expired Timestamp
```typescript
try {
  await getUniversalPresignedUrl(
    'aws',
    'bucket',
    'file.txt',
    'read',
    Date.now() - 1000  // Past timestamp
  );
} catch (error) {
  // Error: EchoForge Error: expiresAt must be in the future.
}
```

## Testing

The package includes 14 comprehensive unit tests covering:
- AWS S3 presigned URL generation (read/write)
- GCP Cloud Storage presigned URL generation (read/write)
- Expiration validation (past timestamps, Date vs number)
- Region handling (default vs custom)
- Error cases (unsupported providers, invalid inputs)
- Edge cases (special characters, long expirations)

Run tests:
```bash
npm test
```

Run with coverage:
```bash
npm run test:coverage
```

Coverage: **97.5%** (40/41 lines)

## Implementation Details

### AWS S3
- Uses `@aws-sdk/client-s3` with `GetObjectCommand` (read) or `PutObjectCommand` (write)
- Uses `@aws-sdk/s3-request-presigner` for URL signing
- Expiration is calculated as seconds from now
- Region defaults to `us-east-1` if not specified

### GCP Cloud Storage
- Uses `@google-cloud/storage` SDK
- Supports v4 signing
- Accepts Date objects directly for expiration
- Action parameter: `'read'` or `'write'`

## Design Decisions

### Why a Single Unified Function?

Instead of separate provider-specific functions, we provide a single interface because:
1. **Simplifies consumption**: Callers don't need provider-specific logic
2. **Easy provider switching**: Change provider via config, not code
3. **Consistent behavior**: Same validation and error handling across providers
4. **Testable**: Mock the entire storage layer with one function

### Why Support Both Date and Timestamp?

Different parts of the system may work with different time representations:
- Timestamps (numbers) are common in APIs and calculations
- Date objects are easier to work with in some contexts
- The function normalizes both to provider-specific formats internally

## Future Enhancements

- [ ] Add `deleteObject` operation
- [ ] Add `listObjects` with pagination
- [ ] Support for multipart uploads
- [ ] Add Azure Blob Storage support
- [ ] Streaming upload/download helpers
- [ ] Automatic retry logic with exponential backoff
- [ ] Metadata/tagging support
