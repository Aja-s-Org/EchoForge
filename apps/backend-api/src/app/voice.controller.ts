import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpException,
  HttpStatus,
  UsePipes,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ErrorHandlerService } from '../services/error-handler.service';
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
  UploadAndCloneDto,
} from './dto/voice-cloning.schemas';
@Controller('voice')
export class VoiceController {
  constructor(
    private readonly voiceService: VoiceService,
    private readonly errorHandler: ErrorHandlerService,
  ) {}

  @Post('clone')
  @HttpCode(202)
  @UsePipes(new ZodValidationPipe(CloneVoiceSchema))
  async cloneVoice(@Body() body: CloneVoiceDto, @Req() req: Request): Promise<CloneVoiceResponse> {
    try {
      const request: CloneVoiceRequest = {
        voiceSampleFile: body.voiceSampleFile,
        transcription: body.transcription,
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
  async downloadResult(@Param() params: DownloadResultDto): Promise<Buffer> {
    try {
      return await this.voiceService.downloadResult(params.jobId);
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
  @UseInterceptors(FileInterceptor('voiceSample'))
  async cloneWithUpload(
    @UploadedFile() file: MulterFile,
    @Body() body: UploadAndCloneDto,
    @Req() req: Request,
  ): Promise<CloneVoiceResponse> {
    try {
      // Validate the uploaded file
      if (!file) {
        throw this.errorHandler.createHttpException(
          new Error('Voice sample file is required'),
          { endpoint: 'cloneWithUpload', validation: 'missing_file' }
        );
      }

      // Validate file type
      const allowedMimeTypes = ['audio/wav', 'audio/mpeg', 'audio/ogg', 'audio/x-wav'];
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

      // Validate file size (max 100MB)
      const maxSize = 100 * 1024 * 1024;
      if (file.size > maxSize) {
        throw this.errorHandler.createHttpException(
          new Error(`File too large. Maximum size is ${maxSize / (1024 * 1024)}MB`),
          { 
            endpoint: 'cloneWithUpload', 
            validation: 'file_too_large',
            fileSize: file.size,
            maxSize,
          }
        );
      }

      // Generate a unique filename
      const timestamp = Date.now();
      const sanitizedName = file.originalname
        .replace(/[^a-zA-Z0-9._ -]/g, '-')
        .replace(/[- ]+/g, '-')
        .slice(0, 100);
      const storedFileName = `uploads/${timestamp}-${sanitizedName}`;

      // In a real implementation, we would save the file to storage here
      // For now, we'll assume the file is saved and proceed with the clone request

      const request: CloneVoiceRequest = {
        voiceSampleFile: storedFileName,
        transcription: body.transcription,
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