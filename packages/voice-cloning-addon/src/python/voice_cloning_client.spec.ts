import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VoiceCloningClient } from './voice_cloning_client';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
}

describe('VoiceCloningClient over HTTP', () => {
  const fetchMock = vi.fn();
  let client: VoiceCloningClient;

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    client = new VoiceCloningClient('http://voice-service:8080');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function lastRequest() {
    const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
    return { url, init, body: init?.body ? JSON.parse(init.body) : undefined };
  }

  it('posts to /initialize and returns the success flag', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }));

    await expect(client.initialize()).resolves.toBe(true);

    expect(lastRequest().url).toBe('http://voice-service:8080/initialize');
    expect(lastRequest().init.method).toBe('POST');
  });

  it('sends audio as base64 when extracting an embedding', async () => {
    const embedding = { embedding: [0.1], sample_rate: 16000, duration: 1 };
    fetchMock.mockResolvedValue(jsonResponse(embedding));

    const result = await client.extractVoiceEmbedding(Uint8Array.from([1, 2, 3]), 16000);

    expect(result).toEqual(embedding);
    expect(lastRequest().url).toBe('http://voice-service:8080/extract-embedding');
    expect(lastRequest().body).toEqual({ audio_data: Buffer.from([1, 2, 3]).toString('base64'), sample_rate: 16000 });
  });

  it('sends the embedding, text and language when synthesising', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ audio_data: [], sample_rate: 22050, duration: 0, format: 'wav' }));

    await client.synthesizeSpeech([0.5, 0.25], 'bonjour', 'fr');

    expect(lastRequest().url).toBe('http://voice-service:8080/synthesize');
    expect(lastRequest().body).toEqual({ voice_embedding: [0.5, 0.25], text: 'bonjour', language: 'fr' });
  });

  it('defaults the synthesis language to English', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    await client.synthesizeSpeech([], 'hello');
    expect(lastRequest().body.language).toBe('en');
  });

  it('passes service errors through', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'Service not initialized' }));
    await expect(client.synthesizeSpeech([], 'hello')).resolves.toEqual({ error: 'Service not initialized' });
  });

  it('reports healthy only when the service says ok', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: 'ok' }));
    await expect(client.healthCheck()).resolves.toBe(true);

    fetchMock.mockResolvedValueOnce(jsonResponse({ status: 'starting' }));
    await expect(client.healthCheck()).resolves.toBe(false);
  });

  it('reports unhealthy when the service is unreachable', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    await expect(client.healthCheck()).resolves.toBe(false);
  });
});

describe('VoiceCloningClient in stdin/stdout mode', () => {
  const client = new VoiceCloningClient('stdio');

  it('is not implemented yet', async () => {
    await expect(client.initialize()).rejects.toThrow(/not yet implemented/);
    await expect(client.extractVoiceEmbedding(Buffer.alloc(0), 16000)).rejects.toThrow(/not yet implemented/);
    await expect(client.synthesizeSpeech([], 'hi')).rejects.toThrow(/not yet implemented/);
    await expect(client.healthCheck()).resolves.toBe(false);
  });
});
