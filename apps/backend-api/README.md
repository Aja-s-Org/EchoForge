# Backend API

NestJS-based backend API for EchoForge voice processing.

## Features

- **Voice Upload**: Generate presigned URLs for secure file uploads to cloud storage (AWS S3 / GCP Cloud Storage)
- **Voice Processing**: Accept transcript and uploaded file references for processing
- **Input Validation**: Zod-based runtime type safety with comprehensive security checks
- **Cloud Provider Abstraction**: Universal interface supporting both AWS and GCP

## API Endpoints

### POST `/api/voice/request-upload`

Request a presigned URL for uploading an audio file.

**Request Body:**
```json
{
  "fileName": "audio-recording.wav",
  "contentType": "audio/wav"
}
```

**Response:**
```json
{
  "uploadUrl": "https://presigned-upload-url...",
  "fileName": "uploads/1234567890-audio-recording.wav"
}
```

**Validation:**
- `fileName`: 1-255 characters, no path traversal (`..`), no null bytes
- `contentType`: Valid MIME type format (e.g., `audio/wav`, `video/mp4`)

### POST `/api/voice/process`

Process an uploaded voice file with its transcript.

**Request Body:**
```json
{
  "transcript": "This is the transcribed audio content...",
  "fileName": "uploads/1234567890-audio-recording.wav"
}
```

**Response:**
```json
{
  "status": "ok"
}
```

**Validation:**
- `transcript`: 1-100,000 characters
- `fileName`: Must match pattern `uploads/{timestamp}-{name}` (prevents arbitrary bucket access)

**Error Responses:**
- `400 Bad Request`: Validation failure (invalid input format)
- `422 Unprocessable Entity`: File not found in storage (upload incomplete or failed)

## Security Features

### Input Sanitization
- **Path Traversal Prevention**: Rejects `..` sequences in file names
- **Null Byte Protection**: Blocks null bytes in file paths
- **MIME Type Validation**: Ensures valid content-type format
- **Upload Path Enforcement**: Only accepts files in `uploads/` prefix with valid timestamp pattern

### File Existence Verification
Before processing, the API verifies that the referenced file exists in cloud storage, preventing:
- Race conditions (process called before upload completes)
- Invalid file reference attacks
- Storage inconsistencies

## Development

### Local Testing

Run tests:
```bash
npm test
```

Run tests with coverage:
```bash
npm run test:coverage
```

### Environment Variables

- `CLOUD_PROVIDER`: `aws` (default) or `gcp`
- `ECHOFORGE_SAMPLES_BUCKET`: Storage bucket name (default: `echoforge-samples`)
- `AWS_REGION`: AWS region (default: `us-east-1`, only used for AWS)
- `PORT`: Server port (default: `3000`)

### Running the Server

Development:
```bash
npx nx serve backend-api
```

Production build:
```bash
npx nx build backend-api
node dist/apps/backend-api/main.js
```

## Architecture

### Directory Structure

```
src/
├── app/
│   ├── dto/
│   │   └── voice.schemas.ts      # Zod validation schemas
│   ├── app.controller.ts         # API endpoints
│   └── app.module.ts             # NestJS module config
├── pipes/
│   └── zod-validation.pipe.ts    # Reusable Zod validation pipe
├── services/
│   └── storage.service.ts        # Cloud storage abstraction
└── main.ts                       # Application entry point
```

### Testing

- **76 unit tests** with 84%+ code coverage
- Comprehensive validation schema tests (30 tests)
- Controller integration tests (17 tests)
- Service mocking for AWS/GCP SDKs
- Edge case coverage (unicode, special chars, timeouts)

### CI/CD Integration

Coverage reports are automatically generated in `coverage/apps/backend-api/` with:
- `coverage-summary.json` - Compatible with `dkhunt27/action-nx-code-coverage@v3`
- `coverage-final.json` - Full coverage data
- `index.html` - Human-readable coverage report

## Dependencies

- `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`: NestJS framework
- `zod`: Runtime type validation
- `@echoforge/storage-utils`: Cloud storage abstraction layer
- `@aws-sdk/client-s3`: AWS S3 SDK (peer dependency)
- `@google-cloud/storage`: GCP Storage SDK (peer dependency)

## Future Enhancements

- [ ] Actual voice processing logic (currently returns `{ status: 'ok' }`)
- [ ] Rate limiting per IP/user
- [ ] Webhook notifications for async processing
- [ ] Support for batch uploads
- [ ] Audio format conversion
- [ ] Transcript validation against audio duration
