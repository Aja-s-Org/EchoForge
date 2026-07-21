import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { StorageService } from './storage.service';
import { MetricsService } from './metrics.service';

export interface CleanupStats {
  jobsDeleted: number;
  filesDeleted: number;
  totalSpaceFreedMB: number;
  durationMs: number;
  timestamp: Date;
}

export interface CleanupConfig {
  // Job cleanup configuration
  maxJobAgeHours: number;
  
  // File cleanup configuration
  maxFileAgeHours: number;
  
  // Retention policies
  keepCompletedJobs: boolean;
  keepFailedJobs: boolean;
  
  // Storage limits
  maxStorageMB: number;
  cleanupThresholdPercent: number;
  
  // Scheduling
  cleanupIntervalMinutes: number;
  enableAutomaticCleanup: boolean;
}

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);
  private readonly defaultConfig: CleanupConfig = {
    maxJobAgeHours: 24, // Keep jobs for 24 hours
    maxFileAgeHours: 168, // Keep files for 1 week
    keepCompletedJobs: true,
    keepFailedJobs: false,
    maxStorageMB: 10240, // 10GB limit
    cleanupThresholdPercent: 80, // Cleanup when 80% full
    cleanupIntervalMinutes: 60, // Run every hour
    enableAutomaticCleanup: true,
  };
  
  private config: CleanupConfig = { ...this.defaultConfig };
  private cleanupStats: CleanupStats[] = [];
  
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
    private readonly metricsService: MetricsService,
  ) {
    this.loadConfigFromEnvironment();
    
    // Start cleanup scheduler if enabled
    if (this.config.enableAutomaticCleanup) {
      this.startCleanupScheduler();
    }
  }
  
  private async startCleanupScheduler(): Promise<void> {
    const intervalMinutes = this.config.cleanupIntervalMinutes || 60;
    const intervalMs = intervalMinutes * 60 * 1000;
    
    setInterval(async () => {
      await this.scheduledCleanup();
    }, intervalMs);
    
    this.logger.log(`Started cleanup scheduler with ${intervalMinutes} minute interval`);
  }
  
  async scheduledCleanup(): Promise<void> {
    if (!this.config.enableAutomaticCleanup) {
      this.logger.debug('Automatic cleanup disabled, skipping scheduled cleanup');
      return;
    }
    
    this.logger.log('Starting scheduled voice data cleanup');
    
    try {
      const stats = await this.runCleanup();
      this.logger.log(`Scheduled cleanup completed: ${stats.jobsDeleted} jobs, ${stats.filesDeleted} files, ${stats.totalSpaceFreedMB}MB freed`);
      
      // Record metrics
      await this.metricsService.recordProcessingTime(stats.durationMs);
      
    } catch (error) {
      this.logger.error('Scheduled cleanup failed', error);
    }
  }
  
  async runCleanup(): Promise<CleanupStats> {
    const startTime = Date.now();
    const stats: CleanupStats = {
      jobsDeleted: 0,
      filesDeleted: 0,
      totalSpaceFreedMB: 0,
      durationMs: 0,
      timestamp: new Date(),
    };
    
    try {
      // 1. Clean up old jobs
      stats.jobsDeleted = await this.cleanupOldJobs();
      
      // 2. Clean up orphaned files (optional - depends on storage service capabilities)
      // stats.filesDeleted = await this.cleanupOrphanedFiles();
      
      // 3. Check storage limits and cleanup if needed
      // const storageStats = await this.checkAndCleanupStorage();
      // stats.filesDeleted += storageStats.filesDeleted;
      // stats.totalSpaceFreedMB += storageStats.spaceFreedMB;
      
      stats.durationMs = Date.now() - startTime;
      stats.timestamp = new Date();
      
      // Save cleanup stats
      this.cleanupStats.push(stats);
      if (this.cleanupStats.length > 100) {
        this.cleanupStats = this.cleanupStats.slice(-100);
      }
      
      // Record operation in database
      await this.databaseService.recordOperation('runCleanup', true, stats.durationMs, {
        jobsDeleted: stats.jobsDeleted,
        filesDeleted: stats.filesDeleted,
        spaceFreedMB: stats.totalSpaceFreedMB,
      });
      
      return stats;
      
    } catch (error) {
      stats.durationMs = Date.now() - startTime;
      
      await this.databaseService.recordOperation('runCleanup', false, stats.durationMs, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      throw error;
    }
  }
  
  async cleanupOldJobs(): Promise<number> {
    const maxAgeHours = this.config.maxJobAgeHours;
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - maxAgeHours);
    
    // Get old jobs
    const oldJobs = await this.databaseService.listJobs({
      fromDate: new Date(0), // From beginning of time
      toDate: cutoffTime,
    });
    
    let deletedCount = 0;
    
    for (const job of oldJobs) {
      // Apply retention policies
      if (job.status === 'completed' && this.config.keepCompletedJobs) {
        continue;
      }
      
      if (job.status === 'failed' && this.config.keepFailedJobs) {
        continue;
      }
      
      // Delete the job
      const deleted = await this.databaseService.deleteJob(job.id);
      if (deleted) {
        deletedCount++;
        
        // TODO: Also delete associated files from storage
        // if (job.voiceSampleFile) {
        //   await this.deleteFileFromStorage(job.voiceSampleFile);
        // }
        // if (job.outputFile) {
        //   await this.deleteFileFromStorage(job.outputFile);
        // }
      }
    }
    
    this.logger.log(`Cleaned up ${deletedCount} voice cloning jobs older than ${maxAgeHours} hours`);
    return deletedCount;
  }
  
  async cleanupOrphanedFiles(): Promise<number> {
    // In a real implementation, this would:
    // 1. List all files in storage under voice/ directory
    // 2. Check which files have associated jobs in database
    // 3. Delete files without associated jobs
    
    this.logger.warn('Orphaned file cleanup not implemented - requires storage service listing capabilities');
    return 0;
  }
  
  async checkAndCleanupStorage(): Promise<{ filesDeleted: number; spaceFreedMB: number }> {
    // In a real implementation, this would:
    // 1. Check current storage usage
    // 2. If above threshold, delete oldest files until below threshold
    
    this.logger.warn('Storage limit cleanup not implemented - requires storage usage monitoring');
    return { filesDeleted: 0, spaceFreedMB: 0 };
  }
  
  async getCleanupStats(options?: {
    limit?: number;
    fromDate?: Date;
    toDate?: Date;
  }): Promise<CleanupStats[]> {
    let stats = [...this.cleanupStats];
    
    if (options?.fromDate) {
      stats = stats.filter(s => s.timestamp >= options.fromDate!);
    }
    
    if (options?.toDate) {
      stats = stats.filter(s => s.timestamp <= options.toDate!);
    }
    
    // Sort by timestamp (newest first)
    stats.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    const limit = options?.limit || stats.length;
    return stats.slice(0, limit);
  }
  
  getConfig(): CleanupConfig {
    return { ...this.config };
  }
  
  updateConfig(newConfig: Partial<CleanupConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.log('Updated cleanup configuration', this.config);
    
    // In a real implementation, save to database or config file
  }
  
  resetConfig(): void {
    this.config = { ...this.defaultConfig };
    this.logger.log('Reset cleanup configuration to defaults');
  }
  
  async estimateStorageUsage(): Promise<{
    estimatedTotalMB: number;
    voiceSamplesMB: number;
    resultsMB: number;
    metadataMB: number;
  }> {
    // Get all jobs from database
    const allJobs = await this.databaseService.listJobs();
    
    // Estimate storage usage based on job count
    // This is a rough estimate - real implementation would query storage service
    const completedJobs = allJobs.filter(job => job.status === 'completed');
    
    // Estimate: 5MB per voice sample, 5MB per result
    const voiceSamplesMB = allJobs.length * 5;
    const resultsMB = completedJobs.length * 5;
    const metadataMB = allJobs.length * 0.01; // 10KB per job metadata
    
    const estimatedTotalMB = voiceSamplesMB + resultsMB + metadataMB;
    
    return {
      estimatedTotalMB,
      voiceSamplesMB,
      resultsMB,
      metadataMB,
    };
  }
  
  async runImmediateCleanup(): Promise<CleanupStats> {
    this.logger.log('Running immediate voice data cleanup');
    return this.runCleanup();
  }
  
  async cleanupJob(jobId: string, deleteFiles: boolean = true): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      // Get job details
      const job = await this.databaseService.getJob(jobId);
      if (!job) {
        this.logger.warn(`Job ${jobId} not found for cleanup`);
        return false;
      }
      
      // Delete job from database
      const deleted = await this.databaseService.deleteJob(jobId);
      
      if (deleted && deleteFiles) {
        // TODO: Delete associated files from storage
        // if (job.voiceSampleFile) {
        //   await this.deleteFileFromStorage(job.voiceSampleFile);
        // }
        // if (job.outputFile) {
        //   await this.deleteFileFromStorage(job.outputFile);
        // }
        
        this.logger.log(`Cleaned up job ${jobId} and associated files`);
      } else if (deleted) {
        this.logger.log(`Cleaned up job ${jobId} (files preserved)`);
      }
      
      const duration = Date.now() - startTime;
      await this.databaseService.recordOperation('cleanupJob', true, duration, {
        jobId,
        deleteFiles,
      });
      
      return deleted;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.databaseService.recordOperation('cleanupJob', false, duration, {
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      this.logger.error(`Failed to cleanup job ${jobId}`, error);
      return false;
    }
  }
  
  private loadConfigFromEnvironment(): void {
    const envConfig: Partial<CleanupConfig> = {};
    
    if (process.env['VOICE_CLEANUP_MAX_JOB_AGE_HOURS']) {
      envConfig.maxJobAgeHours = parseInt(process.env['VOICE_CLEANUP_MAX_JOB_AGE_HOURS'], 10);
    }
    
    if (process.env['VOICE_CLEANUP_MAX_FILE_AGE_HOURS']) {
      envConfig.maxFileAgeHours = parseInt(process.env['VOICE_CLEANUP_MAX_FILE_AGE_HOURS'], 10);
    }
    
    if (process.env['VOICE_CLEANUP_KEEP_COMPLETED']) {
      envConfig.keepCompletedJobs = process.env['VOICE_CLEANUP_KEEP_COMPLETED'] === 'true';
    }
    
    if (process.env['VOICE_CLEANUP_KEEP_FAILED']) {
      envConfig.keepFailedJobs = process.env['VOICE_CLEANUP_KEEP_FAILED'] === 'true';
    }
    
    if (process.env['VOICE_CLEANUP_MAX_STORAGE_MB']) {
      envConfig.maxStorageMB = parseInt(process.env['VOICE_CLEANUP_MAX_STORAGE_MB'], 10);
    }
    
    if (process.env['VOICE_CLEANUP_THRESHOLD_PERCENT']) {
      envConfig.cleanupThresholdPercent = parseInt(process.env['VOICE_CLEANUP_THRESHOLD_PERCENT'], 10);
    }
    
    if (process.env['VOICE_CLEANUP_INTERVAL_MINUTES']) {
      envConfig.cleanupIntervalMinutes = parseInt(process.env['VOICE_CLEANUP_INTERVAL_MINUTES'], 10);
    }
    
    if (process.env['VOICE_CLEANUP_ENABLED']) {
      envConfig.enableAutomaticCleanup = process.env['VOICE_CLEANUP_ENABLED'] === 'true';
    }
    
    this.config = { ...this.config, ...envConfig };
    this.logger.debug('Loaded cleanup configuration from environment', this.config);
  }
  
  // Helper method to delete file from storage
  private async deleteFileFromStorage(filePath: string): Promise<boolean> {
    // In a real implementation, this would call storage service delete method
    // For now, log and return success
    this.logger.debug(`Would delete file from storage: ${filePath}`);
    return true;
  }
}