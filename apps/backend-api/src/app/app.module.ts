import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
// Ensure this path matches where your StorageService actually lives
import { StorageService } from '../services/storage.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [StorageService],
})
export class AppModule {}
