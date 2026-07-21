import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { AppController } from './app.controller';
import { VoiceController } from './voice.controller';
import { VoiceAdminController } from './voice-admin.controller';
import { StorageService } from '../services/storage.service';
import { VoiceService } from '../services/voice.service';
import { DatabaseService } from '../services/database.service';
import { MetricsService } from '../services/metrics.service';
import { CleanupService } from '../services/cleanup.service';
import { ErrorHandlerService } from '../services/error-handler.service';
import { AuthMiddleware } from '../middleware/auth.middleware';

@Module({
  imports: [],
  controllers: [AppController, VoiceController, VoiceAdminController],
  providers: [
    StorageService,
    VoiceService,
    DatabaseService,
    MetricsService,
    CleanupService,
    ErrorHandlerService,
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply authentication middleware to all voice endpoints
    consumer
      .apply(AuthMiddleware)
      .forRoutes(
        { path: 'voice/clone', method: RequestMethod.POST },
        { path: 'voice/jobs/:jobId', method: RequestMethod.GET },
        { path: 'voice/results/:jobId', method: RequestMethod.GET },
        { path: 'voice/clone-with-upload', method: RequestMethod.POST },
        { path: 'voice/admin/*', method: RequestMethod.ALL }
      );
  }
}
