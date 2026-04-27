import { Body, Controller, Post } from '@nestjs/common';
import { StorageService } from '../services/storage.service.js';

@Controller('voice')
export class AppController {
  constructor(private readonly storageService: StorageService) {}

  @Post('request-upload')
  async requestUpload(@Body() body: { fileName: string; contentType: string }) {
    if (!body.fileName) {
      return { error: 'fileName is required' };
    }
    if (!body.contentType) {
      return { error: 'contentType is required' };
    }

    return this.storageService.getUploadUrl(body.fileName, body.contentType);
  }
}
