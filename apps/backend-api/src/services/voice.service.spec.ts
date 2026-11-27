import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VoiceService, wavDurationSeconds } from './voice.service';
import { StorageService } from './storage.service';
import { DatabaseService } from './database.service';
import { MetricsService } from './metrics.service';
import { CleanupService } from './cleanup.service';
import { VoiceInferenceError, VoiceInferenceService } from './voice-inference.service';

/** A minimal 16-bit mono PCM WAV file. */
function wavFile(sampleRate: number, samples: number): Buffer {
  const dataSize = samples * 2;
  const wav = Buffer.alloc(44 + dataSize);
  wav.write('RIFF', 0, 'ascii');
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write('WAVE', 8, 'ascii');
  wav.write('fmt ', 12, 'ascii');
  wav.writeUInt32LE(16, 16); // fmt chunk size
  wav.writeUInt16LE(1, 20); // PCM
  wav.writeUInt16LE(1, 22); // mono
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28); // byte rate
  wav.writeUInt16LE(2, 32); // block align
  wav.writeUInt16LE(16, 34); // bits per sample
  wav.write('data', 36, 'ascii');
  wav.writeUInt32LE(dataSize, 40);
  return wav;
}

const request = {
  voiceSampleFile: 'uploads/1234567890-audio.wav',
  transcription: 'Hello, this is a test.',
  language: 'en',
  speed: 1.0,
};

describe('VoiceService', () => {
  let voiceService: VoiceService;
  let storageService: StorageService;
  let voiceInference: VoiceInferenceService;
  let files: Map<string, Buffer>;
  const generatedAudio = wavFile(24000, 48000); // 2 seconds

  beforeEach(() => {
    vi.clearAllMocks();
    files = new Map([['uploads/1234567890-audio.wav', Buffer.from('voice sample')]]);
    storageService = {
      fileExists: vi.fn(async (key: string) => files.has(key)),
      downloadFile: vi.fn(async (key: string) => {
        const file = files.get(key);
        if (!file) throw new Error(`Failed to download file: ${key}`);
        return file;
      }),
      uploadFile: vi.fn(async (key: string, data: Buffer) => {
        files.set(key, data);
      }),
      generateVoiceResultFileName: vi.fn(async (jobId: string) => `voice_results/${jobId}-1.wav`),
    } as unknown as StorageService;

    voiceInference = {
      isConfigured: true,
      clone: vi.fn().mockResolvedValue({ audio: generatedAudio, sampleRate: 24000 }),
    } as unknown as VoiceInferenceService;

    // DatabaseService and MetricsService are in-memory, so use the real ones.
    // CleanupService starts a timer on construction, so it is stubbed.
    const databaseService = new DatabaseService();
    const metricsService = new MetricsService(databaseService);
    const cleanupService = { cleanupOldJobs: vi.fn().mockResolvedValue(0) } as unknown as CleanupService;

    voiceService = new VoiceService(storageService, databaseService, metricsService, cleanupService, voiceInference);
  });

  async function waitForJob(jobId: string, status: 'completed' | 'failed') {
    await vi.waitFor(async () => {
      expect((await voiceService.getJobStatus(jobId)).status).toBe(status);
    });
    return voiceService.getJobStatus(jobId);
  }

  it('should be defined', () => {
    expect(voiceService).toBeDefined();
  });

  describe('cloneVoice', () => {
    it('should create a new voice cloning job', async () => {
      const result = await voiceService.cloneVoice(request);

      expect(result.jobId).toMatch(/^[a-f0-9]{32}$/);
      expect(result.status).toBe('queued');
      expect(result.estimatedTime).toBe(30);
    });

    it('should throw error if voice sample file does not exist', async () => {
      await expect(
        voiceService.cloneVoice({ ...request, voiceSampleFile: 'uploads/nonexistent.wav' }),
      ).rejects.toThrow('Voice sample file not found');
    });

    it('should validate transcription length', async () => {
      await expect(voiceService.cloneVoice({ ...request, transcription: 'a'.repeat(6000) })).rejects.toThrow(
        'Transcription too long',
      );
    });
  });

  describe('processing', () => {
    it('clones the stored sample and stores the generated audio', async () => {
      const { jobId } = await voiceService.cloneVoice({ ...request, sampleTranscript: '  My voice sample.  ', speed: 1.2 });

      const status = await waitForJob(jobId, 'completed');

      expect(voiceInference.clone).toHaveBeenCalledWith({
        voiceSample: Buffer.from('voice sample'),
        voiceSampleFileName: '1234567890-audio.wav',
        text: 'Hello, this is a test.',
        sampleTranscript: 'My voice sample.',
        speed: 1.2,
      });
      expect(status.outputFile).toBe(`voice_results/${jobId}-1.wav`);
      expect(storageService.uploadFile).toHaveBeenCalledWith(`voice_results/${jobId}-1.wav`, generatedAudio, 'audio/wav');
      expect(status.completedAt).toBeInstanceOf(Date);
    });

    it('sends no sample transcript when none or only whitespace was given', async () => {
      const { jobId } = await voiceService.cloneVoice({ ...request, sampleTranscript: '   ' });
      await waitForJob(jobId, 'completed');
      expect(vi.mocked(voiceInference.clone).mock.calls[0][0].sampleTranscript).toBeUndefined();
    });

    it('fails the job with the inference error', async () => {
      vi.mocked(voiceInference.clone).mockRejectedValue(
        new VoiceInferenceError('Voice inference failed (500): Voice cloning failed', 500),
      );
      const { jobId } = await voiceService.cloneVoice(request);

      const status = await waitForJob(jobId, 'failed');

      expect(status.error).toBe('Voice inference failed (500): Voice cloning failed');
      expect(status.outputFile).toBeUndefined();
      expect(storageService.uploadFile).not.toHaveBeenCalled();
    });

    it('fails the job when the sample cannot be downloaded', async () => {
      vi.mocked(storageService.downloadFile).mockRejectedValueOnce(new Error('Failed to download file: gone'));
      const { jobId } = await voiceService.cloneVoice(request);

      const status = await waitForJob(jobId, 'failed');

      expect(status.error).toContain('Failed to download file');
      expect(voiceInference.clone).not.toHaveBeenCalled();
    });

    it('processes queued jobs one after another', async () => {
      const first = await voiceService.cloneVoice(request);
      const second = await voiceService.cloneVoice(request);

      await waitForJob(first.jobId, 'completed');
      await waitForJob(second.jobId, 'completed');

      expect(voiceInference.clone).toHaveBeenCalledTimes(2);
    });
  });

  describe('downloadResult', () => {
    it('returns the stored audio for a completed job', async () => {
      const { jobId } = await voiceService.cloneVoice(request);
      await waitForJob(jobId, 'completed');

      await expect(voiceService.downloadResult(jobId)).resolves.toEqual(generatedAudio);
    });

    it('rejects a job that has not completed', async () => {
      vi.mocked(voiceInference.clone).mockReturnValue(new Promise(() => undefined)); // never finishes
      const { jobId } = await voiceService.cloneVoice(request);

      await expect(voiceService.downloadResult(jobId)).rejects.toThrow('Job not completed');
    });

    it('rejects an unknown job', async () => {
      await expect(voiceService.downloadResult('nonexistent')).rejects.toThrow('Job not found');
    });
  });

  describe('getJobStatus', () => {
    it('should return job status for existing job', async () => {
      const { jobId } = await voiceService.cloneVoice(request);

      const status = await voiceService.getJobStatus(jobId);

      expect(status.jobId).toBe(jobId);
      expect(['pending', 'processing', 'completed', 'failed']).toContain(status.status);
      expect(status.createdAt).toBeInstanceOf(Date);
    });

    it('should throw error for non-existent job', async () => {
      await expect(voiceService.getJobStatus('nonexistent')).rejects.toThrow('Job not found');
    });
  });

  describe('rate limiting', () => {
    it('should allow requests within rate limit', async () => {
      for (let i = 0; i < 10; i++) {
        await expect(voiceService.cloneVoice(request, '127.0.0.1')).resolves.toBeDefined();
      }
    });

    it('should throw error when rate limit exceeded', async () => {
      for (let i = 0; i < 10; i++) {
        await voiceService.cloneVoice(request, '127.0.0.1');
      }

      await expect(voiceService.cloneVoice(request, '127.0.0.1')).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('queue stats', () => {
    it('should return accurate queue statistics', async () => {
      const stats = await voiceService.getQueueStats();

      expect(stats).toHaveProperty('totalJobs');
      expect(stats).toHaveProperty('pendingJobs');
      expect(stats).toHaveProperty('processingJobs');
      expect(stats).toHaveProperty('completedJobs');
      expect(stats).toHaveProperty('failedJobs');
      expect(stats).toHaveProperty('queueLength');
    });
  });
});

describe('wavDurationSeconds', () => {
  it('reads the duration from the fmt and data chunks', () => {
    expect(wavDurationSeconds(wavFile(24000, 36000))).toBe(1.5);
  });

  it('skips chunks before the data chunk', () => {
    const wav = wavFile(16000, 16000);
    const list = Buffer.alloc(8 + 4);
    list.write('LIST', 0, 'ascii');
    list.writeUInt32LE(4, 4);
    const withList = Buffer.concat([wav.subarray(0, 36), list, wav.subarray(36)]);
    expect(wavDurationSeconds(withList)).toBe(1);
  });

  it('returns undefined for data that is not WAV', () => {
    expect(wavDurationSeconds(Buffer.from('not a wav file'))).toBeUndefined();
    expect(wavDurationSeconds(Buffer.alloc(0))).toBeUndefined();
  });
});
