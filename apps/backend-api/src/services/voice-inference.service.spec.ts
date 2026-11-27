import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VoiceInferenceError, VoiceInferenceService } from './voice-inference.service';

const request = {
  voiceSample: Buffer.from('RIFF....WAVE'),
  voiceSampleFileName: 'sample.wav',
  text: 'Hello there',
  sampleTranscript: 'This is my voice.',
  speed: 1.25,
};

function audioResponse(audio = Buffer.from('wav bytes'), sampleRate = '24000'): Response {
  return new Response(new Uint8Array(audio), { status: 200, headers: { 'X-Sample-Rate': sampleRate } });
}

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

/** An unsigned JWT whose payload has the given exp (seconds). */
function idToken(expSeconds: number): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'RS256' })}.${encode({ exp: expSeconds })}.signature`;
}

describe('VoiceInferenceService', () => {
  const fetchMock = vi.fn();
  let service: VoiceInferenceService;

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('VOICE_INFERENCE_URL', 'https://voice-inference.example.run.app/');
    vi.stubEnv('VOICE_INFERENCE_AUTH', 'none');
    vi.stubEnv('CLOUD_PROVIDER', '');
    service = new VoiceInferenceService();
    service.sleep = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  function cloneCalls() {
    return fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/v1/clone'));
  }

  it('is not configured without VOICE_INFERENCE_URL', async () => {
    vi.stubEnv('VOICE_INFERENCE_URL', '');

    expect(service.isConfigured).toBe(false);
    await expect(service.clone(request)).rejects.toThrow('Voice inference service is not configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts the sample and fields as multipart form data', async () => {
    fetchMock.mockResolvedValue(audioResponse());

    const result = await service.clone(request);

    expect(result).toEqual({ audio: Buffer.from('wav bytes'), sampleRate: 24000 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://voice-inference.example.run.app/v1/clone');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({});
    expect(init.signal).toBeInstanceOf(AbortSignal);
    const form = init.body as FormData;
    expect(form.get('text')).toBe('Hello there');
    expect(form.get('sample_transcript')).toBe('This is my voice.');
    expect(form.get('speed')).toBe('1.25');
    const sample = form.get('voice_sample') as File;
    expect(sample.name).toBe('sample.wav');
    expect(Buffer.from(await sample.arrayBuffer())).toEqual(request.voiceSample);
  });

  it('leaves out optional fields that are not set', async () => {
    fetchMock.mockResolvedValue(audioResponse());

    await service.clone({ ...request, sampleTranscript: undefined, speed: undefined });

    const form = fetchMock.mock.calls[0][1].body as FormData;
    expect(form.has('sample_transcript')).toBe(false);
    expect(form.has('speed')).toBe(false);
  });

  it('reports the service error detail', async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { detail: 'voice_sample is not a supported audio file' }));

    const error = await service.clone(request).catch((e) => e);

    expect(error).toBeInstanceOf(VoiceInferenceError);
    expect(error.status).toBe(400);
    expect(error.message).toBe('Voice inference failed (400): voice_sample is not a supported audio file');
  });

  it('retries while the service reports the model is loading', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(503, { detail: 'Model is still loading' }, { 'Retry-After': '30' }))
      .mockResolvedValueOnce(audioResponse());

    await expect(service.clone(request)).resolves.toMatchObject({ sampleRate: 24000 });

    expect(cloneCalls()).toHaveLength(2);
    expect(service.sleep).toHaveBeenCalledWith(30_000);
  });

  it('gives up after the last attempt', async () => {
    fetchMock.mockImplementation(async () => jsonResponse(503, { detail: 'Model is still loading' }));

    await expect(service.clone(request)).rejects.toThrow('Voice inference failed (503): Model is still loading');
    expect(cloneCalls()).toHaveLength(service.maxAttempts);
  });

  describe('with Google identity tokens', () => {
    beforeEach(() => {
      vi.stubEnv('VOICE_INFERENCE_AUTH', '');
      vi.stubEnv('CLOUD_PROVIDER', 'gcp');
    });

    it('sends an identity token for the service URL from the metadata server', async () => {
      const token = idToken(Math.floor(Date.now() / 1000) + 3600);
      fetchMock.mockResolvedValueOnce(new Response(token)).mockResolvedValueOnce(audioResponse());

      await service.clone(request);

      const [metadataUrl, metadataInit] = fetchMock.mock.calls[0];
      expect(metadataUrl).toBe(
        'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity' +
          '?audience=https%3A%2F%2Fvoice-inference.example.run.app',
      );
      expect(metadataInit.headers).toEqual({ 'Metadata-Flavor': 'Google' });
      expect(cloneCalls()[0][1].headers).toEqual({ Authorization: `Bearer ${token}` });
    });

    it('reuses the token until it is close to expiring', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-11-27T10:00:00Z'));
      const nowSeconds = Math.floor(Date.now() / 1000);
      fetchMock.mockImplementation(async (url: string) =>
        url.includes('metadata.google.internal') ? new Response(idToken(nowSeconds + 3600)) : audioResponse(),
      );

      await service.clone(request);
      await service.clone(request);
      vi.setSystemTime(new Date('2026-11-27T10:56:00Z')); // within 5 minutes of expiry
      await service.clone(request);

      const metadataCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes('metadata.google.internal'));
      expect(metadataCalls).toHaveLength(2);
    });

    it('fails clearly when no token is available', async () => {
      fetchMock.mockResolvedValueOnce(new Response('', { status: 404 }));

      await expect(service.clone(request)).rejects.toThrow('Could not get an identity token from the metadata server (404)');
      expect(cloneCalls()).toHaveLength(0);
    });
  });
});
