# Voice Cloning API Documentation

## Overview

This API provides voice cloning functionality using the f5-tts library integrated into EchoForge's core engine.

## Endpoints

### 1. Clone Voice (with existing uploaded file)

**POST** `/voice/clone`

Clone voice from an already uploaded voice sample file.

#### Request Body
```json
{
  "voiceSampleFile": "uploads/1234567890-audio.wav",
  "transcription": "Hello, this is a test message.",
  "language": "en",
  "speed": 1.0
}
```

#### Parameters
- `voiceSampleFile` (required): Path to uploaded voice sample file (must match pattern: `uploads/\d+-[^/\0]+$`)
- `transcription` (required): Text to synthesize (max 5000 characters)
- `language` (optional): Language code (2-3 letters, default: "en")
- `speed` (optional): Speech speed multiplier (0.5 to 2.0, default: 1.0)

#### Response (202 Accepted)
```json
{
  "jobId": "414620dcabed6c687c360e54940dd1f4",
  "status": "queued",
  "estimatedTime": 30
}
```

### 2. Clone Voice with File Upload

**POST** `/voice/clone-with-upload`

Upload voice sample file and clone voice in one request.

#### Request Format
`multipart/form-data`

#### Form Fields
- `voiceSample` (required): Audio file (max 100MB, supported types: audio/wav, audio/mpeg, audio/ogg, audio/x-wav)
- `transcription` (required): Text to synthesize (max 5000 characters)
- `language` (optional): Language code (default: "en")
- `speed` (optional): Speech speed multiplier (0.5 to 2.0, default: 1.0)

#### Response (202 Accepted)
```json
{
  "jobId": "414620dcabed6c687c360e54940dd1f4",
  "status": "queued",
  "estimatedTime": 30
}
```

### 3. Get Job Status

**GET** `/voice/jobs/{jobId}`

Check the status of a voice cloning job.

#### Path Parameters
- `jobId` (required): 32-character hexadecimal job ID

#### Response (200 OK)
```json
{
  "jobId": "414620dcabed6c687c360e54940dd1f4",
  "status": "processing",
  "progress": 50,
  "outputFile": "voice_results/414620dcabed6c687c360e54940dd1f4.wav",
  "createdAt": "2026-07-21T11:35:55.000Z",
  "startedAt": "2026-07-21T11:35:56.000Z",
  "completedAt": null
}
```

#### Status Values
- `pending`: Job is waiting in queue
- `processing`: Job is being processed
- `completed`: Job completed successfully
- `failed`: Job failed (check error field)

### 4. Download Result

**GET** `/voice/results/{jobId}`

Download the generated audio file.

#### Path Parameters
- `jobId` (required): 32-character hexadecimal job ID

#### Response (200 OK)
Binary audio file with appropriate content-type header.

### 5. Request File Upload URL

**POST** `/voice/request-upload` (Existing endpoint)

Get a pre-signed URL for uploading voice sample files.

#### Request Body
```json
{
  "fileName": "audio.wav",
  "contentType": "audio/wav"
}
```

## Error Responses

### 400 Bad Request
Invalid input parameters or validation errors.

### 404 Not Found
Job not found.

### 429 Too Many Requests
Rate limit exceeded (10 requests per minute per IP).

### 500 Internal Server Error
Server error processing request.

## Rate Limiting

- 10 requests per minute per IP address
- Applies to all voice cloning endpoints
- Separate limits for file upload requests

## File Requirements

### Supported Formats
- WAV (.wav)
- MP3 (.mp3) 
- OGG (.ogg)

### Size Limits
- Maximum file size: 100MB
- Recommended duration: 5-30 seconds

### Audio Quality
- Sample rate: 16kHz or higher recommended
- Channels: Mono or stereo
- Bit depth: 16-bit or higher

## Job Processing

### Typical Processing Time
- Small files (<10MB): 10-20 seconds
- Medium files (10-50MB): 20-40 seconds  
- Large files (50-100MB): 40-60 seconds

### Job Lifecycle
1. User uploads voice sample (or provides existing file)
2. Job created with `pending` status
3. Job moves to `processing` when worker available
4. Job completes with `completed` status and output file
5. Job may fail with `failed` status and error message

### Job Cleanup
- Jobs older than 24 hours are automatically cleaned up
- Output files may have different retention policies

## Integration with Existing API

### File Upload Flow
1. Call `/voice/request-upload` to get upload URL
2. Upload file directly to cloud storage
3. Use returned file path with `/voice/clone` endpoint

### Direct Upload Flow
1. Use `/voice/clone-with-upload` for simple workflows
2. File uploaded directly to API server
3. File automatically stored and processed

## Testing

### Unit Tests
Run voice service and controller tests:
```bash
npm test -- voice.service.spec voice.controller.spec
```

### Integration Tests
Test full workflow with sample audio files.

## Configuration

### Environment Variables
```bash
# Voice cloning configuration
VOICE_CLONING_MAX_HEAP_MB=2048
VOICE_CLONING_USE_GPU=false
F5TTS_MODEL_PATH=./models/f5-tts

# Storage configuration  
CLOUD_PROVIDER=aws  # or gcp
ECHOFORGE_SAMPLES_BUCKET=echoforge-samples
AWS_REGION=us-east-1  # if using AWS
```

### Rate Limiting Configuration
- Default: 10 requests per minute per IP
- Configurable in `VoiceService.applyRateLimit()`

## Security Considerations

### Input Validation
- File type validation
- File size limits
- Path traversal prevention
- Transcription length limits

### Rate Limiting
- Prevents abuse of voice cloning service
- Protects against DDoS attacks

### Data Privacy
- Voice samples processed ephemerally
- Output files stored temporarily
- No long-term storage of voice data without consent

## Troubleshooting

### Common Issues

1. **File upload fails**
   - Check file size limit (100MB)
   - Verify supported file formats
   - Ensure proper content-type header

2. **Job stays in pending status**
   - Check worker service status
   - Verify core engine initialization
   - Check system resource availability

3. **Rate limit errors**
   - Wait 60 seconds before retrying
   - Consider batching requests
   - Contact admin for rate limit adjustments

4. **Audio quality issues**
   - Use higher quality source audio
   - Ensure proper sample rate (16kHz+)
   - Use mono audio for best results

## Performance Tips

1. **Optimize source audio**
   - Use 16kHz mono WAV files
   - Keep duration under 30 seconds
   - Normalize audio levels

2. **Batch processing**
   - Queue multiple jobs
   - Use async/await for status checking
   - Implement client-side polling

3. **Error handling**
   - Implement retry logic for transient failures
   - Use exponential backoff for rate limits
   - Log errors for debugging