import { Injectable, Logger } from '@nestjs/common';
import { StorageService } from './storage.service';
import { DatabaseService, DatabaseVoiceCloningJob } from './database.service';
import { MetricsService } from './metrics.service';
import { CleanupService } from './cleanup.service';
import { randomBytes } from 'crypto';

// Mock interfaces for core-engine (will be replaced with actual imports)
interface CoreEngineConfig {
  maxHeapMB?: number;
  audioPoolSizeMB?: number;
  cleanupThresholdPercent?: number;
  f5ttsModelPath?: string;
  f5ttsVocoderPath?: string;
  useGPU?: boolean;
  pythonServicePath?: string;
  targetSampleRate?: number;
  targetChannels?: number;
  normalizationThreshold?: number;
}

interface VoiceCloner {
  initialize(config?: CoreEngineConfig): Promise<boolean>;
  isInitialized(): boolean;
  extractVoiceEmbedding(audioData: Buffer | string): Promise<number[]>;
  synthesizeSpeech(embedding: number[], text: string, language?: string, speed?: number): Promise<Buffer>;
  cloneVoice(audioData: Buffer | string, text: string, language?: string, speed?: number): Promise<Buffer>;
  loadModel(modelPath: string): Promise<boolean>;
  loadVocoder(vocoderPath: string): Promise<boolean>;
  getMemoryUsage(): Promise<number>;
  clearCache(): Promise<void>;
  getVersion(): string;
}

// Re-export database interfaces for backwards compatibility
export type VoiceCloningJob = DatabaseVoiceCloningJob;

export interface CloneVoiceRequest {
  voiceSampleFile: string;
  transcription: string;
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
  private voiceCloner: VoiceCloner | null = null;
  private processingQueue: string[] = [];
  private isProcessing = false;
  private requestCounts: Map<string, number> = new Map();
  private requestTimestamps: Map<string, number[]> = new Map();

  constructor(
    private readonly storageService: StorageService,
    private readonly databaseService: DatabaseService,
    private readonly metricsService: MetricsService,
    private readonly cleanupService: CleanupService,
  ) {
    this.initializeEngine();
    
    // Start background processing
    this.startBackgroundProcessing();
  }

  private async initializeEngine(): Promise<void> {
    try {
      // Initialize core engine with configuration
      const config: CoreEngineConfig = {
        maxHeapMB: parseInt(process.env['VOICE_CLONING_MAX_HEAP_MB'] || '2048'),
        useGPU: process.env['VOICE_CLONING_USE_GPU'] === 'true',
        f5ttsModelPath: process.env['F5TTS_MODEL_PATH'] || './models/f5-tts',
        targetSampleRate: 22050,
      };

      // Mock engine initialization (will be replaced with actual coreEngine() call)
      // const engine = await coreEngine();
      // await engine.initialize(config);
      // this.voiceCloner = await engine.createVoiceCloner(config);
      
      this.logger.log('Voice cloning engine initialized successfully (mock)');
    } catch (error) {
      this.logger.error('Failed to initialize voice cloning engine', error);
      throw error;
    }
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

    // Create a new job in database
    const jobId = this.generateJobId();
    const job = await this.databaseService.createJob({
      voiceSampleFile: request.voiceSampleFile,
      transcription: request.transcription,
      language: request.language || 'en',
      speed: request.speed || 1.0,
      status: 'pending',
    });

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

    // In a real implementation, this would read from storage service
    // For now, we'll return a placeholder
    // TODO: Integrate with storage service for actual file download
    return Buffer.from('Audio data placeholder');
  }

  private generateJobId(): string {
    return randomBytes(16).toString('hex');
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
      
      // Check if voice cloner is available
      if (!this.voiceCloner) {
        throw new Error('Voice cloning engine not initialized');
      }

      // Download voice sample from storage using storage service
      this.logger.log(`Processing job ${jobId}: Downloading voice sample from ${job.voiceSampleFile}`);
      
      // TODO: Actually download the file from storage service
      // const voiceSample = await this.storageService.downloadFile(job.voiceSampleFile);
      
      // Clone the voice
      this.logger.log(`Processing job ${jobId}: Cloning voice`);
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Generate output file name
      const outputFileName = `voice_results/${jobId}.wav`;
      
      // TODO: Actually save the result to storage service
      // await this.storageService.uploadFile(outputFileName, generatedAudio);

      // Update job status to completed
      const completedAt = new Date();
      const processingTimeMs = completedAt.getTime() - startTime;
      
      await this.databaseService.updateJob(jobId, {
        status: 'completed',
        outputFile: outputFileName,
        completedAt: completedAt,
        metadata: {
          processingTimeMs,
          ...job.metadata,
        },
      });

      // Record job metrics
      await this.databaseService.addJobMetrics({
        jobId,
        processingTimeMs,
        audioDurationSeconds: 0, // TODO: Get actual duration
        qualityScore: 0.95, // TODO: Calculate actual quality
        voiceSimilarity: 0.9, // TODO: Calculate actual similarity
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

  async cleanupOldJobs(maxAgeHours: number = 24): Promise<void> {
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