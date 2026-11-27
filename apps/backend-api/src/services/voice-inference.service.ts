import { Injectable, Logger } from '@nestjs/common';

/**
 * Client for the voice inference service (apps/voice-inference), which runs
 * F5-TTS. Configuration:
 *
 * - VOICE_INFERENCE_URL: base URL of the service, e.g. https://voice-inference-xyz.a.run.app
 * - VOICE_INFERENCE_AUTH: `gcp-id-token` to send a Google identity token (the
 *   service is private on Cloud Run), or `none`. Defaults to `gcp-id-token`
 *   when CLOUD_PROVIDER=gcp, otherwise `none`.
 * - VOICE_INFERENCE_TIMEOUT_MS: per-request timeout (default 10 minutes; CPU
 *   inference is slow).
 */

export interface InferenceCloneRequest {
  voiceSample: Buffer;
  voiceSampleFileName: string;
  text: string;
  sampleTranscript?: string;
  speed?: number;
}

export interface InferenceCloneResult {
  /** 16-bit PCM WAV file */
  audio: Buffer;
  sampleRate?: number;
}

export class VoiceInferenceError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'VoiceInferenceError';
  }
}

const METADATA_IDENTITY_URL =
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity';

/** Refresh identity tokens this long before they expire. */
const TOKEN_EXPIRY_MARGIN_MS = 5 * 60 * 1000;

@Injectable()
export class VoiceInferenceService {
  private readonly logger = new Logger(VoiceInferenceService.name);
  private cachedToken?: { value: string; expiresAt: number };

  /** Attempts made while the service answers 503 (model still loading). */
  maxAttempts = 3;

  get baseUrl(): string | undefined {
    const url = process.env['VOICE_INFERENCE_URL']?.trim();
    return url ? url.replace(/\/+$/, '') : undefined;
  }

  get isConfigured(): boolean {
    return this.baseUrl !== undefined;
  }

  private get authMode(): 'gcp-id-token' | 'none' {
    const mode = process.env['VOICE_INFERENCE_AUTH'];
    if (mode === 'gcp-id-token' || mode === 'none') return mode;
    return process.env['CLOUD_PROVIDER'] === 'gcp' ? 'gcp-id-token' : 'none';
  }

  private get timeoutMs(): number {
    const value = Number(process.env['VOICE_INFERENCE_TIMEOUT_MS']);
    return Number.isFinite(value) && value > 0 ? value : 10 * 60 * 1000;
  }

  async clone(request: InferenceCloneRequest): Promise<InferenceCloneResult> {
    const baseUrl = this.baseUrl;
    if (!baseUrl) {
      throw new VoiceInferenceError('Voice inference service is not configured (VOICE_INFERENCE_URL)');
    }

    for (let attempt = 1; ; attempt++) {
      const response = await fetch(`${baseUrl}/v1/clone`, {
        method: 'POST',
        body: this.buildForm(request),
        headers: await this.authHeaders(baseUrl),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (response.ok) {
        const sampleRate = Number(response.headers.get('x-sample-rate'));
        return {
          audio: Buffer.from(await response.arrayBuffer()),
          sampleRate: Number.isFinite(sampleRate) && sampleRate > 0 ? sampleRate : undefined,
        };
      }

      if (response.status === 503 && attempt < this.maxAttempts) {
        const delayMs = this.retryDelayMs(response.headers.get('retry-after'));
        this.logger.warn(`Voice inference service is loading; retrying in ${delayMs}ms`);
        await this.sleep(delayMs);
        continue;
      }

      throw new VoiceInferenceError(
        `Voice inference failed (${response.status}): ${await this.errorDetail(response)}`,
        response.status,
      );
    }
  }

  private buildForm(request: InferenceCloneRequest): FormData {
    const form = new FormData();
    form.append('voice_sample', new Blob([new Uint8Array(request.voiceSample)]), request.voiceSampleFileName);
    form.append('text', request.text);
    if (request.sampleTranscript) {
      form.append('sample_transcript', request.sampleTranscript);
    }
    if (request.speed !== undefined) {
      form.append('speed', String(request.speed));
    }
    return form;
  }

  private async authHeaders(audience: string): Promise<Record<string, string>> {
    if (this.authMode === 'none') {
      return {};
    }
    return { Authorization: `Bearer ${await this.identityToken(audience)}` };
  }

  /** Google-signed identity token for the inference service, from the metadata server. */
  private async identityToken(audience: string): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt - TOKEN_EXPIRY_MARGIN_MS > Date.now()) {
      return this.cachedToken.value;
    }

    const url = `${METADATA_IDENTITY_URL}?audience=${encodeURIComponent(audience)}`;
    const response = await fetch(url, { headers: { 'Metadata-Flavor': 'Google' } });
    if (!response.ok) {
      throw new VoiceInferenceError(`Could not get an identity token from the metadata server (${response.status})`);
    }
    const token = (await response.text()).trim();
    this.cachedToken = { value: token, expiresAt: this.tokenExpiry(token) };
    return token;
  }

  /** Read `exp` from the JWT payload; assume one hour if it can't be read. */
  private tokenExpiry(token: string): number {
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'));
      if (typeof payload.exp === 'number') {
        return payload.exp * 1000;
      }
    } catch {
      // fall through
    }
    return Date.now() + 60 * 60 * 1000;
  }

  private retryDelayMs(retryAfter: string | null): number {
    const seconds = Number(retryAfter);
    return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 60) * 1000 : 10_000;
  }

  private async errorDetail(response: Response): Promise<string> {
    try {
      const body = await response.json();
      if (typeof body?.detail === 'string') return body.detail;
    } catch {
      // not JSON
    }
    return response.statusText || 'no details';
  }

  /** Overridable in tests. */
  sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
