/**
 * TypeScript client for the Python voice cloning service.
 * This client communicates with the Python service via HTTP or stdin/stdout.
 */

export interface VoiceEmbedding {
  embedding: number[];
  sample_rate: number;
  duration: number;
}

export interface SynthesizedSpeech {
  audio_data: number[];
  sample_rate: number;
  duration: number;
  format: string;
}

export interface VoiceCloningError {
  error: string;
}

export class VoiceCloningClient {
  private serviceUrl: string;
  private useHttp: boolean;

  constructor(serviceUrl: string = 'http://localhost:8080') {
    this.serviceUrl = serviceUrl;
    this.useHttp = serviceUrl.startsWith('http');
  }

  /**
   * Initialize the voice cloning service.
   */
  async initialize(): Promise<boolean> {
    if (this.useHttp) {
      const response = await fetch(`${this.serviceUrl}/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = await response.json();
      return result.success;
    } else {
      // TODO: Implement stdin/stdout communication
      throw new Error('stdin/stdout mode not yet implemented');
    }
  }

  /**
   * Extract voice embedding from audio data.
   */
  async extractVoiceEmbedding(
    audioData: Buffer | Uint8Array,
    sampleRate: number
  ): Promise<VoiceEmbedding | VoiceCloningError> {
    const audioBuffer = Buffer.isBuffer(audioData) 
      ? audioData 
      : Buffer.from(audioData);

    if (this.useHttp) {
      const response = await fetch(`${this.serviceUrl}/extract-embedding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio_data: audioBuffer.toString('base64'),
          sample_rate: sampleRate,
        }),
      });
      return await response.json();
    } else {
      // TODO: Implement stdin/stdout communication
      throw new Error('stdin/stdout mode not yet implemented');
    }
  }

  /**
   * Synthesize speech with cloned voice.
   */
  async synthesizeSpeech(
    voiceEmbedding: number[],
    text: string,
    language: string = 'en'
  ): Promise<SynthesizedSpeech | VoiceCloningError> {
    if (this.useHttp) {
      const response = await fetch(`${this.serviceUrl}/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voice_embedding: voiceEmbedding,
          text: text,
          language: language,
        }),
      });
      return await response.json();
    } else {
      // TODO: Implement stdin/stdout communication
      throw new Error('stdin/stdout mode not yet implemented');
    }
  }

  /**
   * Check if the service is healthy.
   */
  async healthCheck(): Promise<boolean> {
    if (this.useHttp) {
      try {
        const response = await fetch(`${this.serviceUrl}/health`);
        const result = await response.json();
        return result.status === 'ok';
      } catch {
        return false;
      }
    } else {
      // TODO: Implement stdin/stdout health check
      return false;
    }
  }
}