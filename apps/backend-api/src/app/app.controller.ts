import {
  Body,
  Controller,
  HttpCode,
  Post,
  UnprocessableEntityException,
  UsePipes,
} from '@nestjs/common';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js';
import { StorageService } from '../services/storage.service.js';
import {
  ProcessVoiceDto,
  ProcessVoiceSchema,
  RequestUploadDto,
  RequestUploadSchema,
} from './dto/voice.schemas.js';

@Controller('voice')
export class AppController {
  constructor(private readonly storageService: StorageService) {}

  @Post('request-upload')
  @UsePipes(new ZodValidationPipe(RequestUploadSchema))
  async requestUpload(@Body() body: RequestUploadDto) {
    return this.storageService.getUploadUrl(body.fileName, body.contentType);
  }

  @Post('process')
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(ProcessVoiceSchema))
  async processVoice(@Body() body: ProcessVoiceDto) {
    const exists = await this.storageService.fileExists(body.fileName);

    if (!exists) {
      throw new UnprocessableEntityException(
        `No file found at '${body.fileName}'. Make sure the upload completed before calling this endpoint.`,
      );
    }

    // TODO: wire up processing logic
    return { status: 'ok' };
  }
}
