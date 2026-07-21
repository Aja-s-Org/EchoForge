import { Logger } from '@nestjs/common';

export interface VoiceCloningConfig {
  // Core engine configuration
  maxHeapMB: number;
  audioPoolSizeMB: number;
  cleanupThresholdPercent: number;
  f5ttsModelPath: string;
  f5ttsVocoderPath: string;
  useGPU: boolean;
  pythonServicePath: string;
  targetSampleRate: number;
  targetChannels: number;
  normalizationThreshold: number;
  
  // Processing configuration
  maxConcurrentJobs: number;
  timeoutMs: number;
  qualityPreset: 'fast' | 'balanced' | 'high';
  cacheEnabled: boolean;
  cacheTtlSeconds: number;
  
  // Logging and monitoring
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  performanceMonitoring: boolean;
  
  // Resource management
  maxMemoryPerJobMB: number;
  autoCleanup: boolean;
  cleanupIntervalSeconds?: number;
  
  // API configuration
  rateLimitRequestsPerMinute: number;
  maxTranscriptionLength: number;
  maxAudioFileSizeMB: number;
  allowedAudioFormats: string[];
  
  // Storage configuration
  storageProvider: 'aws' | 'gcp' | 'local';
  storageBucket: string;
  storageRegion?: string;
  storageBasePath: string;
  
  // Security configuration
  requireAuthentication: boolean;
  allowedApiKeyPrefixes: string[];
  adminRoles: string[];
  adminPermissions: string[];
  
  // Database configuration
  databaseType: 'memory' | 'postgres' | 'mongodb';
  databaseUrl?: string;
  databaseMaxConnections?: number;
}

export class VoiceConfigManager {
  private readonly logger = new Logger(VoiceConfigManager.name);
  private config: VoiceCloningConfig;
  
  constructor() {
    this.config = this.loadDefaultConfig();
    this.loadConfigFromEnvironment();
  }
  
  private loadDefaultConfig(): VoiceCloningConfig {
    return {
      // Core engine configuration
      maxHeapMB: 2048,
      audioPoolSizeMB: 256,
      cleanupThresholdPercent: 80,
      f5ttsModelPath: './models/f5-tts',
      f5ttsVocoderPath: './models/f5-tts/vocoder',
      useGPU: false,
      pythonServicePath: './python-service',
      targetSampleRate: 22050,
      targetChannels: 1,
      normalizationThreshold: 0.95,
      
      // Processing configuration
      maxConcurrentJobs: 5,
      timeoutMs: 30000,
      qualityPreset: 'balanced',
      cacheEnabled: true,
      cacheTtlSeconds: 3600,
      
      // Logging and monitoring
      logLevel: 'info',
      performanceMonitoring: true,
      
      // Resource management
      maxMemoryPerJobMB: 512,
      autoCleanup: true,
      cleanupIntervalSeconds: 300,
      
      // API configuration
      rateLimitRequestsPerMinute: 10,
      maxTranscriptionLength: 5000,
      maxAudioFileSizeMB: 100,
      allowedAudioFormats: ['audio/wav', 'audio/mpeg', 'audio/ogg', 'audio/x-wav'],
      
      // Storage configuration
      storageProvider: 'aws',
      storageBucket: 'echoforge-samples',
      storageRegion: 'us-east-1',
      storageBasePath: 'voice-cloning',
      
      // Security configuration
      requireAuthentication: true,
      allowedApiKeyPrefixes: ['sk_', 'ek_', 'vc_'],
      adminRoles: ['admin', 'service'],
      adminPermissions: ['voice.monitor', 'voice.cleanup', 'voice.configure', 'voice.list'],
      
      // Database configuration
      databaseType: 'memory',
    };
  }
  
  private loadConfigFromEnvironment(): void {
    const env = process.env;
    
    // Core engine configuration
    if (env['VOICE_CLONING_MAX_HEAP_MB']) {
      this.config.maxHeapMB = parseInt(env['VOICE_CLONING_MAX_HEAP_MB'], 10);
    }
    
    if (env['VOICE_CLONING_AUDIO_POOL_MB']) {
      this.config.audioPoolSizeMB = parseInt(env['VOICE_CLONING_AUDIO_POOL_MB'], 10);
    }
    
    if (env['VOICE_CLONING_CLEANUP_THRESHOLD']) {
      this.config.cleanupThresholdPercent = parseInt(env['VOICE_CLONING_CLEANUP_THRESHOLD'], 10);
    }
    
    if (env['F5TTS_MODEL_PATH']) {
      this.config.f5ttsModelPath = env['F5TTS_MODEL_PATH'];
    }
    
    if (env['F5TTS_VOCODER_PATH']) {
      this.config.f5ttsVocoderPath = env['F5TTS_VOCODER_PATH'];
    }
    
    if (env['VOICE_CLONING_USE_GPU']) {
      this.config.useGPU = env['VOICE_CLONING_USE_GPU'] === 'true';
    }
    
    if (env['VOICE_CLONING_TARGET_SAMPLE_RATE']) {
      this.config.targetSampleRate = parseInt(env['VOICE_CLONING_TARGET_SAMPLE_RATE'], 10);
    }
    
    // Processing configuration
    if (env['VOICE_CLONING_MAX_CONCURRENT_JOBS']) {
      this.config.maxConcurrentJobs = parseInt(env['VOICE_CLONING_MAX_CONCURRENT_JOBS'], 10);
    }
    
    if (env['VOICE_CLONING_TIMEOUT_MS']) {
      this.config.timeoutMs = parseInt(env['VOICE_CLONING_TIMEOUT_MS'], 10);
    }
    
    if (env['VOICE_CLONING_QUALITY_PRESET']) {
      const preset = env['VOICE_CLONING_QUALITY_PRESET'] as 'fast' | 'balanced' | 'high';
      if (['fast', 'balanced', 'high'].includes(preset)) {
        this.config.qualityPreset = preset;
      }
    }
    
    if (env['VOICE_CLONING_CACHE_ENABLED']) {
      this.config.cacheEnabled = env['VOICE_CLONING_CACHE_ENABLED'] === 'true';
    }
    
    if (env['VOICE_CLONING_CACHE_TTL_SECONDS']) {
      this.config.cacheTtlSeconds = parseInt(env['VOICE_CLONING_CACHE_TTL_SECONDS'], 10);
    }
    
    // Logging and monitoring
    if (env['VOICE_CLONING_LOG_LEVEL']) {
      const level = env['VOICE_CLONING_LOG_LEVEL'] as 'error' | 'warn' | 'info' | 'debug';
      if (['error', 'warn', 'info', 'debug'].includes(level)) {
        this.config.logLevel = level;
      }
    }
    
    if (env['VOICE_CLONING_PERFORMANCE_MONITORING']) {
      this.config.performanceMonitoring = env['VOICE_CLONING_PERFORMANCE_MONITORING'] === 'true';
    }
    
    // Resource management
    if (env['VOICE_CLONING_MAX_MEMORY_PER_JOB_MB']) {
      this.config.maxMemoryPerJobMB = parseInt(env['VOICE_CLONING_MAX_MEMORY_PER_JOB_MB'], 10);
    }
    
    if (env['VOICE_CLONING_AUTO_CLEANUP']) {
      this.config.autoCleanup = env['VOICE_CLONING_AUTO_CLEANUP'] === 'true';
    }
    
    if (env['VOICE_CLONING_CLEANUP_INTERVAL_SECONDS']) {
      this.config.cleanupIntervalSeconds = parseInt(env['VOICE_CLONING_CLEANUP_INTERVAL_SECONDS'], 10);
    }
    
    // API configuration
    if (env['VOICE_CLONING_RATE_LIMIT_REQUESTS_PER_MINUTE']) {
      this.config.rateLimitRequestsPerMinute = parseInt(env['VOICE_CLONING_RATE_LIMIT_REQUESTS_PER_MINUTE'], 10);
    }
    
    if (env['VOICE_CLONING_MAX_TRANSCRIPTION_LENGTH']) {
      this.config.maxTranscriptionLength = parseInt(env['VOICE_CLONING_MAX_TRANSCRIPTION_LENGTH'], 10);
    }
    
    if (env['VOICE_CLONING_MAX_AUDIO_FILE_SIZE_MB']) {
      this.config.maxAudioFileSizeMB = parseInt(env['VOICE_CLONING_MAX_AUDIO_FILE_SIZE_MB'], 10);
    }
    
    if (env['VOICE_CLONING_ALLOWED_AUDIO_FORMATS']) {
      this.config.allowedAudioFormats = env['VOICE_CLONING_ALLOWED_AUDIO_FORMATS'].split(',');
    }
    
    // Storage configuration
    if (env['CLOUD_PROVIDER']) {
      const provider = env['CLOUD_PROVIDER'] as 'aws' | 'gcp' | 'local';
      if (['aws', 'gcp', 'local'].includes(provider)) {
        this.config.storageProvider = provider;
      }
    }
    
    if (env['ECHOFORGE_SAMPLES_BUCKET']) {
      this.config.storageBucket = env['ECHOFORGE_SAMPLES_BUCKET'];
    }
    
    if (env['AWS_REGION']) {
      this.config.storageRegion = env['AWS_REGION'];
    }
    
    if (env['VOICE_CLONING_STORAGE_BASE_PATH']) {
      this.config.storageBasePath = env['VOICE_CLONING_STORAGE_BASE_PATH'];
    }
    
    // Security configuration
    if (env['VOICE_CLONING_REQUIRE_AUTHENTICATION']) {
      this.config.requireAuthentication = env['VOICE_CLONING_REQUIRE_AUTHENTICATION'] === 'true';
    }
    
    if (env['VOICE_CLONING_ALLOWED_API_KEY_PREFIXES']) {
      this.config.allowedApiKeyPrefixes = env['VOICE_CLONING_ALLOWED_API_KEY_PREFIXES'].split(',');
    }
    
    // Database configuration
    if (env['VOICE_CLONING_DATABASE_TYPE']) {
      const dbType = env['VOICE_CLONING_DATABASE_TYPE'] as 'memory' | 'postgres' | 'mongodb';
      if (['memory', 'postgres', 'mongodb'].includes(dbType)) {
        this.config.databaseType = dbType;
      }
    }
    
    if (env['VOICE_CLONING_DATABASE_URL']) {
      this.config.databaseUrl = env['VOICE_CLONING_DATABASE_URL'];
    }
    
    if (env['VOICE_CLONING_DATABASE_MAX_CONNECTIONS']) {
      this.config.databaseMaxConnections = parseInt(env['VOICE_CLONING_DATABASE_MAX_CONNECTIONS'], 10);
    }
    
    this.logger.log('Loaded voice cloning configuration from environment');
  }
  
  getConfig(): VoiceCloningConfig {
    return { ...this.config };
  }
  
  updateConfig(updates: Partial<VoiceCloningConfig>): void {
    this.config = { ...this.config, ...updates };
    this.logger.log('Updated voice cloning configuration');
  }
  
  validateConfig(): string[] {
    const errors: string[] = [];
    
    // Validate required paths
    if (!this.config.f5ttsModelPath) {
      errors.push('f5ttsModelPath is required');
    }
    
    // Validate numeric ranges
    if (this.config.maxHeapMB < 256) {
      errors.push('maxHeapMB must be at least 256MB');
    }
    
    if (this.config.maxConcurrentJobs < 1) {
      errors.push('maxConcurrentJobs must be at least 1');
    }
    
    if (this.config.timeoutMs < 1000) {
      errors.push('timeoutMs must be at least 1000ms');
    }
    
    if (this.config.maxTranscriptionLength < 1) {
      errors.push('maxTranscriptionLength must be at least 1 character');
    }
    
    if (this.config.maxAudioFileSizeMB < 1) {
      errors.push('maxAudioFileSizeMB must be at least 1MB');
    }
    
    // Validate storage configuration
    if (this.config.storageProvider === 'aws' && !this.config.storageRegion) {
      errors.push('storageRegion is required for AWS provider');
    }
    
    // Validate database configuration
    if (this.config.databaseType !== 'memory' && !this.config.databaseUrl) {
      errors.push('databaseUrl is required for non-memory database types');
    }
    
    return errors;
  }
  
  isConfigValid(): boolean {
    return this.validateConfig().length === 0;
  }
  
  getConfigSummary(): Record<string, any> {
    const summary: Record<string, any> = {};
    
    // Only include non-sensitive config
    summary.maxConcurrentJobs = this.config.maxConcurrentJobs;
    summary.qualityPreset = this.config.qualityPreset;
    summary.cacheEnabled = this.config.cacheEnabled;
    summary.performanceMonitoring = this.config.performanceMonitoring;
    summary.autoCleanup = this.config.autoCleanup;
    summary.storageProvider = this.config.storageProvider;
    summary.requireAuthentication = this.config.requireAuthentication;
    summary.databaseType = this.config.databaseType;
    summary.isValid = this.isConfigValid();
    
    return summary;
  }
  
  static createFromEnv(): VoiceConfigManager {
    return new VoiceConfigManager();
  }
}

// Singleton instance for dependency injection
export const voiceConfigManager = VoiceConfigManager.createFromEnv();