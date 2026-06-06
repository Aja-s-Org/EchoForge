import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { StorageService } from '../services/storage.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [StorageService],
})
export class AppModule {}
