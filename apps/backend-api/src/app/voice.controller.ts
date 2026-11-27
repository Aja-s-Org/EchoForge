import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpException,
  HttpStatus,
  PayloadTooLargeException,
  UsePipes,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ErrorHandlerService } from '../services/error-handler.service';
import { StorageService } from '../services/storage.service';
// Note: In a real implementation, we would install @types/express
// For now, we'll declare the minimal types we need
interface Request {
  ip?: string;
  connection: {
    remoteAddress?: string;
  };
}

interface MulterFile {
  fieldname: string;
  originalname: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
  destination?: string;
  filename?: string;
  path?: string;
}
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';
import { VoiceService, CloneVoiceRequest, CloneVoiceResponse, JobStatusResponse } from '../services/voice.service';
import {
  CloneVoiceSchema,
  CloneVoiceDto,
  JobStatusSchema,
  JobStatusDto,
  DownloadResultSchema,
  DownloadResultDto,
  UploadAndCloneSchema,
  UploadAndCloneDto,
} from './dto/voice-cloning.schemas';
/** Largest voice sample accepted; matches the inference service's MAX_SAMPLE_BYTES. */
const MAX_VOICE_SAMPLE_BYTES = 10 * 1024 * 1024;

@Controller('voice')
export class VoiceController {
  constructor(
    private readonly voiceService: VoiceService,
    private readonly errorHandler: ErrorHandlerService,
    private readonly storageService: StorageService,
  ) {}

  @Post('clone')
  @HttpCode(202)
  @UsePipes(new ZodValidationPipe(CloneVoiceSchema))
  async cloneVoice(@Body() body: CloneVoiceDto, @Req() req: Request): Promise<CloneVoiceResponse> {
    try {
      const request: CloneVoiceRequest = {
        voiceSampleFile: body.voiceSampleFile,
        transcription: body.transcription,
        sampleTranscript: body.sampleTranscript,
        language: body.language,
        speed: body.speed,
      };

      // Get client IP for rate limiting
      const clientIp = req.ip || req.connection.remoteAddress;

      return await this.voiceService.cloneVoice(request, clientIp);
    } catch (error) {
      // Use error handler service for consistent error handling
      throw this.errorHandler.createHttpException(error, {
        endpoint: 'clone',
        clientIp: req.ip || req.connection.remoteAddress,
        requestBody: body,
      });
    }
  }

  @Get('jobs/:jobId')
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(JobStatusSchema))
  async getJobStatus(@Param() params: JobStatusDto): Promise<JobStatusResponse> {
    try {
      return await this.voiceService.getJobStatus(params.jobId);
    } catch (error) {
      // Use error handler service for consistent error handling
      throw this.errorHandler.createHttpException(error, {
        endpoint: 'getJobStatus',
        jobId: params.jobId,
      });
    }
  }

  @Get('results/:jobId')
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(DownloadResultSchema))
  async downloadResult(@Param() params: DownloadResultDto): Promise<StreamableFile> {
    try {
      const audio = await this.voiceService.downloadResult(params.jobId);
      return new StreamableFile(audio, {
        type: 'audio/wav',
        disposition: `attachment; filename="${params.jobId}.wav"`,
        length: audio.length,
      });
    } catch (error) {
      // Use error handler service for consistent error handling
      throw this.errorHandler.createHttpException(error, {
        endpoint: 'downloadResult',
        jobId: params.jobId,
      });
    }
  }

  @Post('clone-with-upload')
  @HttpCode(202)
  // Multer rejects larger uploads before buffering them all in memory.
  @UseInterceptors(FileInterceptor('voiceSample', { limits: { fileSize: MAX_VOICE_SAMPLE_BYTES, files: 1 } }))
  async cloneWithUpload(
    @UploadedFile() file: MulterFile,
    @Body(new ZodValidationPipe(UploadAndCloneSchema)) body: UploadAndCloneDto,
    @Req() req: Request,
  ): Promise<CloneVoiceResponse> {
    try {
      // Validate the uploaded file
      if (!file || !file.buffer) {
        throw this.errorHandler.createHttpException(
          new Error('Voice sample file is required'),
          { endpoint: 'cloneWithUpload', validation: 'missing_file' }
        );
      }

      // Validate file type (formats the inference service can decode)
      const allowedMimeTypes = ['audio/wav', 'audio/x-wav', 'audio/flac', 'audio/x-flac', 'audio/mpeg', 'audio/ogg'];
      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw this.errorHandler.createHttpException(
          new Error(`Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`),
          { 
            endpoint: 'cloneWithUpload', 
            validation: 'invalid_file_type',
            fileMimeType: file.mimetype,
            allowedTypes: allowedMimeTypes,
          }
        );
      }

      // Validate file size (the inference service accepts samples up to 10MB)
      const maxSize = MAX_VOICE_SAMPLE_BYTES;
      if (file.size > maxSize) {
        // Multer's fileSize limit normally rejects these first, with the same status.
        throw new PayloadTooLargeException(`File too large. Maximum size is ${maxSize / (1024 * 1024)}MB`);
      }

      // Generate a unique filename
      const timestamp = Date.now();
      const sanitizedName = file.originalname
        .replace(/[^a-zA-Z0-9._ -]/g, '-')
        .replace(/[- ]+/g, '-')
        .slice(0, 100);
      const storedFileName = `uploads/${timestamp}-${sanitizedName}`;
      await this.storageService.uploadFile(storedFileName, file.buffer, file.mimetype);

      const request: CloneVoiceRequest = {
        voiceSampleFile: storedFileName,
        transcription: body.transcription,
        sampleTranscript: body.sampleTranscript,
        language: body.language,
        speed: body.speed,
      };

      // Get client IP for rate limiting
      const clientIp = req.ip || req.connection.remoteAddress;

      return await this.voiceService.cloneVoice(request, clientIp);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      // Use error handler service for consistent error handling
      throw this.errorHandler.createHttpException(error, {
        endpoint: 'cloneWithUpload',
        clientIp: req.ip || req.connection.remoteAddress,
        fileInfo: file ? {
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
        } : undefined,
      });
    }
  }
}