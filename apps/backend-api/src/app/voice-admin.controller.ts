import {
  Controller,
  Get,
  Post,
  Param,
  HttpCode,
  HttpException,
  HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';
import { VoiceService } from '../services/voice.service';
import { MetricsService } from '../services/metrics.service';
import { CleanupService } from '../services/cleanup.service';
import { DatabaseService } from '../services/database.service';
import { RequireRoles, RequirePermissions, AuthGuard, UseAuth } from '../middleware/auth.middleware';

export interface MetricsResponse {
  status: 'success';
  metrics: any;
  timestamp: Date;
}

export interface CleanupResponse {
  status: 'success' | 'error';
  message: string;
  stats?: any;
  timestamp: Date;
}

export interface JobsListResponse {
  status: 'success';
  jobs: any[];
  total: number;
  page: number;
  limit: number;
  timestamp: Date;
}

@Controller('voice/admin')
@UseAuth()
export class VoiceAdminController {
  constructor(
    private readonly voiceService: VoiceService,
    private readonly metricsService: MetricsService,
    private readonly cleanupService: CleanupService,
    private readonly databaseService: DatabaseService,
  ) {}

  @Get('metrics')
  @HttpCode(200)
  @RequireRoles('service', 'admin')
  @RequirePermissions('voice.monitor')
  async getMetrics(): Promise<MetricsResponse> {
    try {
      const metrics = await this.voiceService.getMetrics();
      
      return {
        status: 'success',
        metrics,
        timestamp: new Date(),
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: error instanceof Error ? error.message : 'Failed to get metrics',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('performance')
  @HttpCode(200)
  @RequireRoles('service', 'admin')
  @RequirePermissions('voice.monitor')
  async getPerformanceStats(): Promise<MetricsResponse> {
    try {
      const stats = await this.voiceService.getPerformanceStats();
      
      return {
        status: 'success',
        metrics: stats,
        timestamp: new Date(),
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: error instanceof Error ? error.message : 'Failed to get performance stats',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('queue-stats')
  @HttpCode(200)
  @RequireRoles('service', 'admin')
  @RequirePermissions('voice.monitor')
  async getQueueStats(): Promise<MetricsResponse> {
    try {
      const stats = await this.voiceService.getQueueStats();
      
      return {
        status: 'success',
        metrics: stats,
        timestamp: new Date(),
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: error instanceof Error ? error.message : 'Failed to get queue stats',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('cleanup-stats')
  @HttpCode(200)
  @RequireRoles('service', 'admin')
  @RequirePermissions('voice.cleanup')
  async getCleanupStats(): Promise<MetricsResponse> {
    try {
      const stats = await this.voiceService.getCleanupStats();
      
      return {
        status: 'success',
        metrics: stats,
        timestamp: new Date(),
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: error instanceof Error ? error.message : 'Failed to get cleanup stats',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('alerts')
  @HttpCode(200)
  @RequireRoles('service', 'admin')
  @RequirePermissions('voice.monitor')
  async getAlerts(): Promise<MetricsResponse> {
    try {
      const alerts = await this.metricsService.getAlertConditions();
      
      return {
        status: 'success',
        metrics: {
          alerts,
          timestamp: new Date(),
        },
        timestamp: new Date(),
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: error instanceof Error ? error.message : 'Failed to get alerts',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('jobs')
  @HttpCode(200)
  @RequireRoles('service', 'admin')
  @RequirePermissions('voice.list')
  async listJobs(
    @Query('status') status?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ): Promise<JobsListResponse> {
    try {
      const pageNum = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 20;
      const offset = (pageNum - 1) * limitNum;
      
      const options: any = {
        limit: limitNum,
        offset,
      };
      
      if (status) {
        options.status = status as any;
      }
      
      if (fromDate) {
        options.fromDate = new Date(fromDate);
      }
      
      if (toDate) {
        options.toDate = new Date(toDate);
      }
      
      const jobs = await this.databaseService.listJobs(options);
      const totalJobs = (await this.databaseService.listJobs()).length;
      
      return {
        status: 'success',
        jobs,
        total: totalJobs,
        page: pageNum,
        limit: limitNum,
        timestamp: new Date(),
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: error instanceof Error ? error.message : 'Failed to list jobs',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('cleanup/run')
  @HttpCode(200)
  @RequireRoles('admin')
  @RequirePermissions('voice.cleanup')
  async runCleanup(): Promise<CleanupResponse> {
    try {
      const stats = await this.cleanupService.runImmediateCleanup();
      
      return {
        status: 'success',
        message: `Cleanup completed: ${stats.jobsDeleted} jobs deleted, ${stats.filesDeleted} files deleted, ${stats.totalSpaceFreedMB}MB freed`,
        stats,
        timestamp: new Date(),
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: error instanceof Error ? error.message : 'Failed to run cleanup',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('cleanup/job/:jobId')
  @HttpCode(200)
  @RequireRoles('admin')
  @RequirePermissions('voice.cleanup')
  async cleanupJob(
    @Param('jobId') jobId: string,
    @Query('deleteFiles') deleteFiles: string = 'true',
  ): Promise<CleanupResponse> {
    try {
      const shouldDeleteFiles = deleteFiles.toLowerCase() === 'true';
      const success = await this.cleanupService.cleanupJob(jobId, shouldDeleteFiles);
      
      if (success) {
        return {
          status: 'success',
          message: `Job ${jobId} cleaned up successfully`,
          timestamp: new Date(),
        };
      } else {
        throw new HttpException(
          {
            status: 'error',
            message: `Failed to clean up job ${jobId}`,
          },
          HttpStatus.NOT_FOUND,
        );
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        {
          status: 'error',
          message: error instanceof Error ? error.message : 'Failed to clean up job',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('storage-usage')
  @HttpCode(200)
  @RequireRoles('service', 'admin')
  @RequirePermissions('voice.monitor')
  async getStorageUsage(): Promise<MetricsResponse> {
    try {
      const usage = await this.cleanupService.estimateStorageUsage();
      
      return {
        status: 'success',
        metrics: usage,
        timestamp: new Date(),
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: error instanceof Error ? error.message : 'Failed to get storage usage',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('config/cleanup')
  @HttpCode(200)
  @RequireRoles('admin')
  @RequirePermissions('voice.configure')
  async getCleanupConfig(): Promise<MetricsResponse> {
    try {
      const config = this.cleanupService.getConfig();
      
      return {
        status: 'success',
        metrics: config,
        timestamp: new Date(),
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: error instanceof Error ? error.message : 'Failed to get cleanup config',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}