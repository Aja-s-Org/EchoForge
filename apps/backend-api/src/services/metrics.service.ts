import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from './database.service';

export interface VoiceCloningMetrics {
  // Job statistics
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  
  // Performance metrics
  averageProcessingTimeMs: number;
  p95ProcessingTimeMs: number;
  p99ProcessingTimeMs: number;
  
  // Success rate
  successRate: number;
  
  // Resource usage
  estimatedMemoryUsageMB: number;
  estimatedStorageUsageMB: number;
  
  // Rate limiting
  rateLimitedRequests: number;
  successfulRequests: number;
  
  // Timing metrics
  timestamp: Date;
  timeWindowMinutes: number;
}

export interface VoiceCloningMetricsSummary {
  current: VoiceCloningMetrics;
  historical: {
    lastHour: VoiceCloningMetrics;
    lastDay: VoiceCloningMetrics;
    lastWeek: VoiceCloningMetrics;
  };
  trends: {
    successRateChange: number;
    processingTimeChange: number;
    requestVolumeChange: number;
  };
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private requestCounts = new Map<string, number>();
  private successCounts = new Map<string, number>();
  private rateLimitedCounts = new Map<string, number>();
  private processingTimes: number[] = [];
  private metricsHistory: VoiceCloningMetrics[] = [];
  
  constructor(private readonly databaseService: DatabaseService) {}
  
  async collectMetrics(timeWindowMinutes: number = 5): Promise<VoiceCloningMetrics> {
    const startTime = Date.now();
    
    try {
      // Get job statistics from database
      const allJobs = await this.databaseService.listJobs();
      const activeJobs = allJobs.filter(job => job.status === 'pending' || job.status === 'processing');
      const completedJobs = allJobs.filter(job => job.status === 'completed');
      const failedJobs = allJobs.filter(job => job.status === 'failed');
      
      // Calculate processing times from completed jobs
      const processingTimes = completedJobs
        .filter(job => job.startedAt && job.completedAt)
        .map(job => job.completedAt!.getTime() - job.startedAt!.getTime());
      
      // Calculate percentiles
      const sortedTimes = processingTimes.sort((a, b) => a - b);
      const p95Index = Math.floor(sortedTimes.length * 0.95);
      const p99Index = Math.floor(sortedTimes.length * 0.99);
      
      const p95ProcessingTimeMs = sortedTimes.length > 0 ? sortedTimes[p95Index] : 0;
      const p99ProcessingTimeMs = sortedTimes.length > 0 ? sortedTimes[p99Index] : 0;
      
      // Calculate averages
      const averageProcessingTimeMs = processingTimes.length > 0
        ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
        : 0;
      
      // Calculate success rate
      const totalProcessedJobs = completedJobs.length + failedJobs.length;
      const successRate = totalProcessedJobs > 0
        ? (completedJobs.length / totalProcessedJobs) * 100
        : 100;
      
      // Estimate resource usage
      const estimatedMemoryUsageMB = activeJobs.length * 512; // 512MB per active job
      const estimatedStorageUsageMB = completedJobs.length * 10; // 10MB per completed job
      
      // Get request counts
      const successfulRequests = Array.from(this.successCounts.values())
        .reduce((sum, count) => sum + count, 0);
      const rateLimitedRequests = Array.from(this.rateLimitedCounts.values())
        .reduce((sum, count) => sum + count, 0);
      
      const metrics: VoiceCloningMetrics = {
        totalJobs: allJobs.length,
        activeJobs: activeJobs.length,
        completedJobs: completedJobs.length,
        failedJobs: failedJobs.length,
        averageProcessingTimeMs,
        p95ProcessingTimeMs,
        p99ProcessingTimeMs,
        successRate,
        estimatedMemoryUsageMB,
        estimatedStorageUsageMB,
        rateLimitedRequests,
        successfulRequests,
        timestamp: new Date(),
        timeWindowMinutes,
      };
      
      // Store in history (keep last 1000 metrics)
      this.metricsHistory.push(metrics);
      if (this.metricsHistory.length > 1000) {
        this.metricsHistory = this.metricsHistory.slice(-1000);
      }
      
      // Record metrics collection operation
      const duration = Date.now() - startTime;
      await this.databaseService.recordOperation('collectMetrics', true, duration, {
        jobsCollected: allJobs.length,
        metricsCollected: Object.keys(metrics).length,
      });
      
      this.logger.debug(`Collected voice cloning metrics for ${allJobs.length} jobs`);
      return metrics;
      
    } catch (error) {
      this.logger.error('Failed to collect voice cloning metrics', error);
      
      await this.databaseService.recordOperation('collectMetrics', false, Date.now() - startTime, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      // Return empty metrics on failure
      return {
        totalJobs: 0,
        activeJobs: 0,
        completedJobs: 0,
        failedJobs: 0,
        averageProcessingTimeMs: 0,
        p95ProcessingTimeMs: 0,
        p99ProcessingTimeMs: 0,
        successRate: 100,
        estimatedMemoryUsageMB: 0,
        estimatedStorageUsageMB: 0,
        rateLimitedRequests: 0,
        successfulRequests: 0,
        timestamp: new Date(),
        timeWindowMinutes,
      };
    }
  }
  
  async getMetricsSummary(): Promise<VoiceCloningMetricsSummary> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Get current metrics
    const currentMetrics = await this.collectMetrics(5);
    
    // Get historical metrics from history
    const lastHourMetrics = this.getHistoricalMetrics(oneHourAgo, now);
    const lastDayMetrics = this.getHistoricalMetrics(oneDayAgo, now);
    const lastWeekMetrics = this.getHistoricalMetrics(oneWeekAgo, now);
    
    // Calculate trends
    const successRateChange = lastHourMetrics.successRate !== 0
      ? ((currentMetrics.successRate - lastHourMetrics.successRate) / lastHourMetrics.successRate) * 100
      : 0;
    
    const processingTimeChange = lastHourMetrics.averageProcessingTimeMs !== 0
      ? ((currentMetrics.averageProcessingTimeMs - lastHourMetrics.averageProcessingTimeMs) / lastHourMetrics.averageProcessingTimeMs) * 100
      : 0;
    
    const requestVolumeChange = lastHourMetrics.successfulRequests !== 0
      ? ((currentMetrics.successfulRequests - lastHourMetrics.successfulRequests) / lastHourMetrics.successfulRequests) * 100
      : 0;
    
    return {
      current: currentMetrics,
      historical: {
        lastHour: lastHourMetrics,
        lastDay: lastDayMetrics,
        lastWeek: lastWeekMetrics,
      },
      trends: {
        successRateChange,
        processingTimeChange,
        requestVolumeChange,
      },
    };
  }
  
  recordRequest(clientIp: string, success: boolean, rateLimited: boolean = false): void {
    const now = new Date();
    const hourKey = `${clientIp}:${now.getHours()}`;
    
    // Update request counts
    const currentCount = this.requestCounts.get(hourKey) || 0;
    this.requestCounts.set(hourKey, currentCount + 1);
    
    if (success) {
      const currentSuccess = this.successCounts.get(hourKey) || 0;
      this.successCounts.set(hourKey, currentSuccess + 1);
    }
    
    if (rateLimited) {
      const currentRateLimited = this.rateLimitedCounts.get(hourKey) || 0;
      this.rateLimitedCounts.set(hourKey, currentRateLimited + 1);
    }
    
    // Clean up old entries (older than 24 hours)
    this.cleanupOldEntries();
  }
  
  recordProcessingTime(processingTimeMs: number): void {
    this.processingTimes.push(processingTimeMs);
    
    // Keep only last 10000 processing times
    if (this.processingTimes.length > 10000) {
      this.processingTimes = this.processingTimes.slice(-10000);
    }
  }
  
  async getAlertConditions(): Promise<Array<{
    condition: string;
    currentValue: number;
    threshold: number;
    severity: 'warning' | 'critical';
    triggered: boolean;
  }>> {
    const metrics = await this.collectMetrics();
    
    const conditions = [
      {
        condition: 'Success rate below 95%',
        currentValue: metrics.successRate,
        threshold: 95,
        severity: 'warning' as const,
        triggered: metrics.successRate < 95,
      },
      {
        condition: 'Success rate below 80%',
        currentValue: metrics.successRate,
        threshold: 80,
        severity: 'critical' as const,
        triggered: metrics.successRate < 80,
      },
      {
        condition: 'Average processing time above 30 seconds',
        currentValue: metrics.averageProcessingTimeMs / 1000,
        threshold: 30,
        severity: 'warning' as const,
        triggered: metrics.averageProcessingTimeMs > 30000,
      },
      {
        condition: 'Average processing time above 60 seconds',
        currentValue: metrics.averageProcessingTimeMs / 1000,
        threshold: 60,
        severity: 'critical' as const,
        triggered: metrics.averageProcessingTimeMs > 60000,
      },
      {
        condition: 'Active jobs above 10',
        currentValue: metrics.activeJobs,
        threshold: 10,
        severity: 'warning' as const,
        triggered: metrics.activeJobs > 10,
      },
      {
        condition: 'Active jobs above 20',
        currentValue: metrics.activeJobs,
        threshold: 20,
        severity: 'critical' as const,
        triggered: metrics.activeJobs > 20,
      },
    ];
    
    return conditions;
  }
  
  private getHistoricalMetrics(fromDate: Date, toDate: Date): VoiceCloningMetrics {
    const historicalMetrics = this.metricsHistory.filter(
      m => m.timestamp >= fromDate && m.timestamp <= toDate
    );
    
    if (historicalMetrics.length === 0) {
      return {
        totalJobs: 0,
        activeJobs: 0,
        completedJobs: 0,
        failedJobs: 0,
        averageProcessingTimeMs: 0,
        p95ProcessingTimeMs: 0,
        p99ProcessingTimeMs: 0,
        successRate: 100,
        estimatedMemoryUsageMB: 0,
        estimatedStorageUsageMB: 0,
        rateLimitedRequests: 0,
        successfulRequests: 0,
        timestamp: new Date(),
        timeWindowMinutes: Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60)),
      };
    }
    
    // Calculate averages for the historical period
    return {
      totalJobs: Math.round(
        historicalMetrics.reduce((sum, m) => sum + m.totalJobs, 0) / historicalMetrics.length
      ),
      activeJobs: Math.round(
        historicalMetrics.reduce((sum, m) => sum + m.activeJobs, 0) / historicalMetrics.length
      ),
      completedJobs: Math.round(
        historicalMetrics.reduce((sum, m) => sum + m.completedJobs, 0) / historicalMetrics.length
      ),
      failedJobs: Math.round(
        historicalMetrics.reduce((sum, m) => sum + m.failedJobs, 0) / historicalMetrics.length
      ),
      averageProcessingTimeMs:
        historicalMetrics.reduce((sum, m) => sum + m.averageProcessingTimeMs, 0) / historicalMetrics.length,
      p95ProcessingTimeMs:
        historicalMetrics.reduce((sum, m) => sum + m.p95ProcessingTimeMs, 0) / historicalMetrics.length,
      p99ProcessingTimeMs:
        historicalMetrics.reduce((sum, m) => sum + m.p99ProcessingTimeMs, 0) / historicalMetrics.length,
      successRate:
        historicalMetrics.reduce((sum, m) => sum + m.successRate, 0) / historicalMetrics.length,
      estimatedMemoryUsageMB: Math.round(
        historicalMetrics.reduce((sum, m) => sum + m.estimatedMemoryUsageMB, 0) / historicalMetrics.length
      ),
      estimatedStorageUsageMB: Math.round(
        historicalMetrics.reduce((sum, m) => sum + m.estimatedStorageUsageMB, 0) / historicalMetrics.length
      ),
      rateLimitedRequests: Math.round(
        historicalMetrics.reduce((sum, m) => sum + m.rateLimitedRequests, 0) / historicalMetrics.length
      ),
      successfulRequests: Math.round(
        historicalMetrics.reduce((sum, m) => sum + m.successfulRequests, 0) / historicalMetrics.length
      ),
      timestamp: new Date(),
      timeWindowMinutes: Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60)),
    };
  }
  
  private cleanupOldEntries(): void {
    const now = new Date();
    const twentyFourHoursAgo = now.getTime() - 24 * 60 * 60 * 1000;
    
    // Clean up request counts
    for (const [key, _] of this.requestCounts.entries()) {
      const [, hour] = key.split(':');
      const entryTime = new Date();
      entryTime.setHours(parseInt(hour, 10), 0, 0, 0);
      
      if (entryTime.getTime() < twentyFourHoursAgo) {
        this.requestCounts.delete(key);
        this.successCounts.delete(key);
        this.rateLimitedCounts.delete(key);
      }
    }
    
    // Clean up old metrics history (older than 30 days)
    const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;
    this.metricsHistory = this.metricsHistory.filter(
      m => m.timestamp.getTime() >= thirtyDaysAgo
    );
  }
}