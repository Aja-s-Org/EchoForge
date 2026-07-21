import { Injectable, Logger } from '@nestjs/common';

export interface DatabaseVoiceCloningJob {
  id: string;
  voiceSampleFile: string;
  transcription: string;
  language?: string;
  speed?: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  outputFile?: string;
  error?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  updatedAt: Date;
}

export interface VoiceCloningJobMetrics {
  jobId: string;
  processingTimeMs?: number;
  memoryUsageMB?: number;
  audioDurationSeconds?: number;
  qualityScore?: number;
  voiceSimilarity?: number;
  createdAt: Date;
}

export interface VoiceCloningOperationMetrics {
  operation: string;
  success: boolean;
  durationMs: number;
  timestamp: Date;
  details?: Record<string, any>;
}

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);
  
  // In-memory database for now - in a real implementation, this would connect to
  // PostgreSQL, MySQL, MongoDB, etc.
  private jobs: Map<string, DatabaseVoiceCloningJob> = new Map();
  private jobMetrics: Map<string, VoiceCloningJobMetrics[]> = new Map();
  private operationMetrics: VoiceCloningOperationMetrics[] = [];

  async createJob(job: Omit<DatabaseVoiceCloningJob, 'id' | 'createdAt' | 'updatedAt'>): Promise<DatabaseVoiceCloningJob> {
    const id = this.generateId();
    const now = new Date();
    
    const fullJob: DatabaseVoiceCloningJob = {
      ...job,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.jobs.set(id, fullJob);
    this.logger.log(`Created voice cloning job ${id}`);
    
    this.recordOperation('createJob', true, 0, { jobId: id, status: job.status });
    
    return fullJob;
  }

  async getJob(jobId: string): Promise<DatabaseVoiceCloningJob | null> {
    const job = this.jobs.get(jobId);
    this.recordOperation('getJob', !!job, 0, { jobId });
    return job || null;
  }

  async updateJob(jobId: string, updates: Partial<DatabaseVoiceCloningJob>): Promise<DatabaseVoiceCloningJob | null> {
    const startTime = Date.now();
    const job = this.jobs.get(jobId);
    
    if (!job) {
      this.recordOperation('updateJob', false, Date.now() - startTime, { jobId, error: 'Job not found' });
      return null;
    }

    const updatedJob: DatabaseVoiceCloningJob = {
      ...job,
      ...updates,
      updatedAt: new Date(),
    };

    this.jobs.set(jobId, updatedJob);
    
    const duration = Date.now() - startTime;
    this.recordOperation('updateJob', true, duration, { jobId, status: updates.status });
    
    return updatedJob;
  }

  async deleteJob(jobId: string): Promise<boolean> {
    const startTime = Date.now();
    const deleted = this.jobs.delete(jobId);
    
    const duration = Date.now() - startTime;
    this.recordOperation('deleteJob', deleted, duration, { jobId });
    
    return deleted;
  }

  async listJobs(options?: {
    status?: DatabaseVoiceCloningJob['status'];
    limit?: number;
    offset?: number;
    fromDate?: Date;
    toDate?: Date;
  }): Promise<DatabaseVoiceCloningJob[]> {
    const startTime = Date.now();
    let jobs = Array.from(this.jobs.values());
    
    // Apply filters
    if (options?.status) {
      jobs = jobs.filter(job => job.status === options.status);
    }
    
    if (options?.fromDate) {
      jobs = jobs.filter(job => job.createdAt >= options.fromDate!);
    }
    
    if (options?.toDate) {
      jobs = jobs.filter(job => job.createdAt <= options.toDate!);
    }
    
    // Sort by creation date (newest first)
    jobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    // Apply pagination
    const offset = options?.offset || 0;
    const limit = options?.limit || jobs.length;
    const paginatedJobs = jobs.slice(offset, offset + limit);
    
    const duration = Date.now() - startTime;
    this.recordOperation('listJobs', true, duration, { 
      count: paginatedJobs.length, 
      total: jobs.length,
      filters: options 
    });
    
    return paginatedJobs;
  }

  async addJobMetrics(metrics: Omit<VoiceCloningJobMetrics, 'createdAt'>): Promise<void> {
    const fullMetrics: VoiceCloningJobMetrics = {
      ...metrics,
      createdAt: new Date(),
    };

    const existingMetrics = this.jobMetrics.get(metrics.jobId) || [];
    existingMetrics.push(fullMetrics);
    this.jobMetrics.set(metrics.jobId, existingMetrics);
    
    this.recordOperation('addJobMetrics', true, 0, { jobId: metrics.jobId });
  }

  async getJobMetrics(jobId: string): Promise<VoiceCloningJobMetrics[]> {
    const metrics = this.jobMetrics.get(jobId) || [];
    this.recordOperation('getJobMetrics', true, 0, { jobId, count: metrics.length });
    return metrics;
  }

  async recordOperation(
    operation: string,
    success: boolean,
    durationMs: number,
    details?: Record<string, any>
  ): Promise<void> {
    const metric: VoiceCloningOperationMetrics = {
      operation,
      success,
      durationMs,
      timestamp: new Date(),
      details,
    };
    
    this.operationMetrics.push(metric);
    
    // Keep only last 1000 metrics in memory
    if (this.operationMetrics.length > 1000) {
      this.operationMetrics = this.operationMetrics.slice(-1000);
    }
  }

  async getOperationMetrics(options?: {
    operation?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
  }): Promise<VoiceCloningOperationMetrics[]> {
    let metrics = [...this.operationMetrics];
    
    if (options?.operation) {
      metrics = metrics.filter(m => m.operation === options.operation);
    }
    
    if (options?.fromDate) {
      metrics = metrics.filter(m => m.timestamp >= options.fromDate!);
    }
    
    if (options?.toDate) {
      metrics = metrics.filter(m => m.timestamp <= options.toDate!);
    }
    
    // Sort by timestamp (newest first)
    metrics.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    const limit = options?.limit || metrics.length;
    return metrics.slice(0, limit);
  }

  async getPerformanceStats(fromDate?: Date): Promise<{
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    averageProcessingTimeMs: number;
    successRate: number;
    recentOperations: VoiceCloningOperationMetrics[];
  }> {
    const jobs = Array.from(this.jobs.values());
    const now = new Date();
    const cutoffDate = fromDate || new Date(now.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours by default

    const recentJobs = jobs.filter(job => job.createdAt >= cutoffDate);
    const recentMetrics = this.operationMetrics.filter(m => m.timestamp >= cutoffDate);

    const completedJobs = recentJobs.filter(job => job.status === 'completed').length;
    const failedJobs = recentJobs.filter(job => job.status === 'failed').length;
    
    const completedJobMetrics = recentJobs
      .filter(job => job.status === 'completed' && job.startedAt && job.completedAt)
      .map(job => job.completedAt!.getTime() - job.startedAt!.getTime());
    
    const averageProcessingTimeMs = completedJobMetrics.length > 0
      ? completedJobMetrics.reduce((sum, time) => sum + time, 0) / completedJobMetrics.length
      : 0;

    const successRate = recentJobs.length > 0
      ? (completedJobs / recentJobs.length) * 100
      : 100;

    return {
      totalJobs: recentJobs.length,
      completedJobs,
      failedJobs,
      averageProcessingTimeMs,
      successRate,
      recentOperations: recentMetrics.slice(-10), // Last 10 operations
    };
  }

  async cleanupOldJobs(maxAgeHours: number = 24): Promise<number> {
    const startTime = Date.now();
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - maxAgeHours);

    const oldJobs = Array.from(this.jobs.entries())
      .filter(([_, job]) => job.createdAt < cutoffTime);

    for (const [jobId, _] of oldJobs) {
      this.jobs.delete(jobId);
      this.jobMetrics.delete(jobId);
    }

    const duration = Date.now() - startTime;
    this.recordOperation('cleanupOldJobs', true, duration, {
      deletedCount: oldJobs.length,
      maxAgeHours,
    });

    this.logger.log(`Cleaned up ${oldJobs.length} voice cloning jobs older than ${maxAgeHours} hours`);
    return oldJobs.length;
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
}