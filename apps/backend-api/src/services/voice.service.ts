import { Injectable, Logger } from '@nestjs/common';
import { StorageService } from './storage.service';
import { DatabaseService, DatabaseVoiceCloningJob } from './database.service';
import { MetricsService } from './metrics.service';
import { CleanupService } from './cleanup.service';
import { VoiceInferenceService } from './voice-inference.service';

// Re-export database interfaces for backwards compatibility
export type VoiceCloningJob = DatabaseVoiceCloningJob;

export interface CloneVoiceRequest {
  voiceSampleFile: string;
  /** Text to speak in the cloned voice */
  transcription: string;
  /** What is said in the voice sample; without it the inference service transcribes the sample */
  sampleTranscript?: string;
  language?: string;
  speed?: number;
}

export interface CloneVoiceResponse {
  jobId: string;
  status: string;
  estimatedTime?: number;
}

export interface JobStatusResponse {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  outputFile?: string;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);
  private processingQueue: string[] = [];
  private isProcessing = false;
  private requestTimestamps: Map<string, number[]> = new Map();

  constructor(
    private readonly storageService: StorageService,
    private readonly databaseService: DatabaseService,
    private readonly metricsService: MetricsService,
    private readonly cleanupService: CleanupService,
    private readonly voiceInference: VoiceInferenceService,
  ) {
    if (!this.voiceInference.isConfigured) {
      this.logger.warn('VOICE_INFERENCE_URL is not set; voice cloning jobs will fail until it is');
    }

    // Start background processing
    this.startBackgroundProcessing();
  }

  async cloneVoice(request: CloneVoiceRequest, clientIp?: string): Promise<CloneVoiceResponse> {
    // Apply rate limiting
    if (clientIp) {
      this.applyRateLimit(clientIp);
    }

    // Validate that the voice sample file exists
    const fileExists = await this.storageService.fileExists(request.voiceSampleFile);
    if (!fileExists) {
      throw new Error(`Voice sample file not found: ${request.voiceSampleFile}`);
    }

    // Validate transcription length
    if (request.transcription.length > 5000) {
      throw new Error('Transcription too long. Maximum length is 5000 characters.');
    }

    // Create a new job in database; its ID is assigned by the database
    const job = await this.databaseService.createJob({
      voiceSampleFile: request.voiceSampleFile,
      transcription: request.transcription,
      sampleTranscript: request.sampleTranscript?.trim() || undefined,
      language: request.language || 'en',
      speed: request.speed || 1.0,
      status: 'pending',
    });
    const jobId = job.id;

    this.processingQueue.push(jobId);

    // Start processing if not already processing
    if (!this.isProcessing) {
      this.processQueue();
    }

    // Record metrics
    this.metricsService.recordRequest(clientIp || 'unknown', true);

    return {
      jobId,
      status: 'queued',
      estimatedTime: 30, // Default estimate: 30 seconds
    };
  }

  async getJobStatus(jobId: string): Promise<JobStatusResponse> {
    const job = await this.databaseService.getJob(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    return {
      jobId: job.id,
      status: job.status,
      outputFile: job.outputFile,
      error: job.error,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    };
  }

  async downloadResult(jobId: string): Promise<Buffer> {
    const job = await this.databaseService.getJob(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (job.status !== 'completed' || !job.outputFile) {
      throw new Error(`Job not completed or no output available: ${jobId}`);
    }

    return await this.storageService.downloadFile(job.outputFile);
  }

  private applyRateLimit(clientIp: string): void {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    const maxRequests = 10; // Maximum 10 requests per minute

    // Get or initialize timestamps for this IP
    let timestamps = this.requestTimestamps.get(clientIp) || [];
    
    // Remove timestamps outside the window
    timestamps = timestamps.filter(timestamp => now - timestamp < windowMs);
    
    // Check if limit exceeded
    if (timestamps.length >= maxRequests) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    
    // Add current timestamp
    timestamps.push(now);
    this.requestTimestamps.set(clientIp, timestamps);
    
    // Clean up old entries periodically (in a real app, use a scheduled job)
    if (Math.random() < 0.01) { // 1% chance to clean up
      this.cleanupRateLimitData();
    }
  }

  private cleanupRateLimitData(): void {
    const now = Date.now();
    const windowMs = 60 * 1000;
    
    for (const [clientIp, timestamps] of this.requestTimestamps.entries()) {
      const validTimestamps = timestamps.filter(timestamp => now - timestamp < windowMs);
      if (validTimestamps.length === 0) {
        this.requestTimestamps.delete(clientIp);
      } else {
        this.requestTimestamps.set(clientIp, validTimestamps);
      }
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.processingQueue.length > 0) {
      const jobId = this.processingQueue.shift()!;
      await this.processJob(jobId);
    }

    this.isProcessing = false;
  }

  private async processJob(jobId: string): Promise<void> {
    const job = await this.databaseService.getJob(jobId);
    if (!job) {
      this.logger.warn(`Job not found while processing: ${jobId}`);
      return;
    }

    const startTime = Date.now();
    
    try {
      // Update job status to processing
      await this.databaseService.updateJob(jobId, {
        status: 'processing',
        startedAt: new Date(),
      });
      
      this.logger.log(`Processing job ${jobId}: downloading voice sample`);
      const voiceSample = await this.storageService.downloadFile(job.voiceSampleFile);

      this.logger.log(`Processing job ${jobId}: cloning voice`);
      const result = await this.voiceInference.clone({
        voiceSample,
        voiceSampleFileName: job.voiceSampleFile.split('/').pop() || 'sample.wav',
        text: job.transcription,
        sampleTranscript: job.sampleTranscript,
        speed: job.speed,
      });

      const outputFileName = await this.storageService.generateVoiceResultFileName(jobId);
      await this.storageService.uploadFile(outputFileName, result.audio, 'audio/wav');

      const completedAt = new Date();
      const processingTimeMs = completedAt.getTime() - startTime;
      const audioDurationSeconds = wavDurationSeconds(result.audio);

      await this.databaseService.updateJob(jobId, {
        status: 'completed',
        outputFile: outputFileName,
        completedAt: completedAt,
        metadata: {
          processingTimeMs,
          audioDurationSeconds,
          ...job.metadata,
        },
      });

      await this.databaseService.addJobMetrics({
        jobId,
        processingTimeMs,
        audioDurationSeconds,
      });

      // Record processing time in metrics service
      this.metricsService.recordProcessingTime(processingTimeMs);

      this.logger.log(`Job ${jobId} completed successfully in ${processingTimeMs}ms`);
    } catch (error) {
      const errorTime = Date.now();
      const processingTimeMs = errorTime - startTime;
      
      this.logger.error(`Failed to process job ${jobId}:`, error);
      
      await this.databaseService.updateJob(jobId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date(),
        metadata: {
          processingTimeMs,
          error: error instanceof Error ? error.message : 'Unknown error',
          ...job.metadata,
        },
      });

      // Record metrics for failed job
      this.metricsService.recordProcessingTime(processingTimeMs);
      
      // Record operation metrics
      await this.databaseService.recordOperation('processJob', false, processingTimeMs, {
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async cleanupOldJobs(maxAgeHours = 24): Promise<void> {
    // Delegate to cleanup service
    await this.cleanupService.cleanupOldJobs(maxAgeHours);
  }

  async getQueueStats() {
    const allJobs = await this.databaseService.listJobs();
    
    return {
      totalJobs: allJobs.length,
      pendingJobs: allJobs.filter(j => j.status === 'pending').length,
      processingJobs: allJobs.filter(j => j.status === 'processing').length,
      completedJobs: allJobs.filter(j => j.status === 'completed').length,
      failedJobs: allJobs.filter(j => j.status === 'failed').length,
      queueLength: this.processingQueue.length,
    };
  }

  async getMetrics() {
    return await this.metricsService.getMetricsSummary();
  }

  async getCleanupStats() {
    return await this.cleanupService.getCleanupStats({ limit: 10 });
  }

  async getPerformanceStats() {
    return await this.databaseService.getPerformanceStats();
  }

  private async startBackgroundProcessing(): Promise<void> {
    // Load pending jobs from database on startup
    const pendingJobs = await this.databaseService.listJobs({
      status: 'pending',
    });

    for (const job of pendingJobs) {
      this.processingQueue.push(job.id);
    }

    if (pendingJobs.length > 0 && !this.isProcessing) {
      this.logger.log(`Loaded ${pendingJobs.length} pending jobs from database`);
      this.processQueue();
    }
  }
}
/**
 * Duration of a PCM WAV file in seconds, read from its fmt and data chunks.
 * Returns undefined if the buffer isn't a WAV file it can read.
 */
export function wavDurationSeconds(wav: Buffer): number | undefined {
  if (wav.length < 12 || wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') {
    return undefined;
  }
  let byteRate: number | undefined;
  let offset = 12;
  while (offset + 8 <= wav.length) {
    const chunkId = wav.toString('ascii', offset, offset + 4);
    const chunkSize = wav.readUInt32LE(offset + 4);
    const dataStart = offset + 8;
    if (chunkId === 'fmt ' && dataStart + 12 <= wav.length) {
      byteRate = wav.readUInt32LE(dataStart + 8);
    } else if (chunkId === 'data' && byteRate) {
      return chunkSize / byteRate;
    }
    offset = dataStart + chunkSize + (chunkSize % 2);
  }
  return undefined;
}
