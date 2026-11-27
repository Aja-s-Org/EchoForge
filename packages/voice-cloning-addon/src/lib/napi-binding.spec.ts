import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const FAKE_ADDON = join(__dirname, '../../tests/fixtures/fake-addon.cjs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fake = require(FAKE_ADDON);

type Binding = typeof import('./napi-binding');

/** Load napi-binding fresh, optionally pointing it at the fake addon. */
async function loadBinding(addonPath?: string): Promise<Binding> {
  vi.resetModules();
  if (addonPath) {
    vi.stubEnv('VOICE_CLONING_ADDON_PATH', addonPath);
  } else {
    vi.stubEnv('VOICE_CLONING_ADDON_PATH', '');
  }
  return import('./napi-binding.js');
}

function callsTo(method: string) {
  return fake.__state.calls.filter((call: { method: string }) => call.method === method);
}

beforeEach(() => {
  fake.__reset();
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('when the native addon is missing', () => {
  it('reports that it is not loaded, with a reason', async () => {
    const binding = await loadBinding(join(__dirname, 'does-not-exist.node'));

    // The real build output may exist on a developer machine; only assert
    // the not-loaded behaviour when it doesn't.
    if (binding.isNativeAddonLoaded()) return;
    expect(binding.getLoadError()).toMatch(/not found/);
    expect(() => binding.getVersion()).toThrow(/Native addon not loaded/);
    expect(() => new binding.NativeVoiceCloner()).toThrow(/Native addon not loaded/);
  });
});

describe('with the fake addon', () => {
  let binding: Binding;

  beforeEach(async () => {
    binding = await loadBinding(FAKE_ADDON);
  });

  it('loads it from VOICE_CLONING_ADDON_PATH', () => {
    expect(binding.isNativeAddonLoaded()).toBe(true);
    expect(binding.getLoadError()).toBeNull();
    expect(binding.getVersion()).toBe('fake-addon 0.0.0');
  });

  it('passes system requirements through', () => {
    expect(binding.checkSystemRequirements()).toMatchObject({
      libsndfile_available: true,
      supported_formats: ['wav', 'flac', 'ogg'],
    });
  });

  describe('NativeVoiceCloner', () => {
    it('requires initialize() before cloning', async () => {
      const cloner = new binding.NativeVoiceCloner();
      expect(cloner.isInitialized()).toBe(false);
      await expect(cloner.cloneVoice(Buffer.from([1]), 'hi')).rejects.toThrow(/not initialized/);
      await expect(cloner.extractVoiceEmbedding('voice.wav')).rejects.toThrow(/not initialized/);
      await expect(cloner.synthesizeSpeech([0], 'hi')).rejects.toThrow(/not initialized/);
    });

    it('clones from a file path', async () => {
      const cloner = new binding.NativeVoiceCloner();
      await cloner.initialize();

      const audio = await cloner.cloneVoice('/samples/voice.wav', 'hello', 'en', 1.1);

      expect(audio).toEqual(Buffer.from([1, 2, 3, 4]));
      expect(callsTo('cloneVoice')[0].args).toEqual(['/samples/voice.wav', 'hello', 'en', 1.1]);
    });

    it('passes sample rate and channels from config when cloning a buffer', async () => {
      const cloner = new binding.NativeVoiceCloner({ targetSampleRate: 16000, targetChannels: 2 });
      await cloner.initialize();
      const sample = Buffer.from([5, 6]);

      await cloner.cloneVoice(sample, 'hello', 'en');

      // voice_cloner.cc reads a buffer's sample rate and channels before the text.
      expect(callsTo('cloneVoice')[0].args).toEqual([sample, 16000, 2, 'hello', 'en', undefined]);
    });

    it('uses the same buffer argument order for cloneVoiceAsync, with the callback last', async () => {
      const cloner = new binding.NativeVoiceCloner({ targetSampleRate: 16000, targetChannels: 1 });
      await cloner.initialize();
      const sample = Buffer.from([5, 6]);

      await cloner.cloneVoiceAsync(sample, 'hello', 'en', 0.9);

      const args = callsTo('cloneVoiceAsync')[0].args;
      expect(args.slice(0, -1)).toEqual([sample, 16000, 1, 'hello', 'en', 0.9]);
      expect(typeof args[args.length - 1]).toBe('function');
    });

    it('defaults to 22.05 kHz mono when config has no audio settings', async () => {
      const cloner = new binding.NativeVoiceCloner();
      await cloner.initialize();

      await cloner.extractVoiceEmbedding(Buffer.from([1]));

      const [, sampleRate, channels] = callsTo('extractVoiceEmbedding')[0].args;
      expect([sampleRate, channels]).toEqual([22050, 1]);
    });

    it('throws the native error message when cloning fails', async () => {
      fake.__state.cloneResult = { success: false, errorMessage: 'model exploded', similarityScore: 0, processingTimeMs: 1 };
      const cloner = new binding.NativeVoiceCloner();
      await cloner.initialize();

      await expect(cloner.cloneVoice('/v.wav', 'hi')).rejects.toThrow('Voice cloning failed: model exploded');
    });

    it('throws when cloning succeeds without audio', async () => {
      fake.__state.cloneResult = { success: true, errorMessage: '', similarityScore: 1, processingTimeMs: 1 };
      const cloner = new binding.NativeVoiceCloner();
      await cloner.initialize();

      await expect(cloner.cloneVoice('/v.wav', 'hi')).rejects.toThrow(/no audio data/);
    });

    it('returns the embedding vector', async () => {
      const cloner = new binding.NativeVoiceCloner();
      await cloner.initialize();
      await expect(cloner.extractVoiceEmbedding('/v.wav')).resolves.toEqual([0.5, 0.25]);
    });

    it('passes the callback last to cloneVoiceAsync, as the C++ side expects', async () => {
      const cloner = new binding.NativeVoiceCloner();
      await cloner.initialize();

      const audio = await cloner.cloneVoiceAsync('/v.wav', 'hello', 'en', 1.2);

      expect(audio).toEqual(Buffer.from([1, 2, 3, 4]));
      const args = callsTo('cloneVoiceAsync')[0].args;
      expect(typeof args[args.length - 1]).toBe('function');
      expect(args.slice(0, -1)).toEqual(['/v.wav', 'hello', 'en', 1.2]);
    });

    it('rejects cloneVoiceAsync when the native result failed', async () => {
      fake.__state.cloneResult = { success: false, errorMessage: 'no voice', similarityScore: 0, processingTimeMs: 1 };
      const cloner = new binding.NativeVoiceCloner();
      await cloner.initialize();

      await expect(cloner.cloneVoiceAsync('/v.wav', 'hi')).rejects.toThrow('Voice cloning failed: no voice');
    });

    it('forwards model, cache and version calls', async () => {
      const cloner = new binding.NativeVoiceCloner();
      await expect(cloner.loadModel('/models/a')).resolves.toBe(true);
      await expect(cloner.loadVocoder('/models/b')).resolves.toBe(true);
      await expect(cloner.getMemoryUsage()).resolves.toBe(1234);
      await cloner.clearCache();
      expect(cloner.getVersion()).toBe('fake-voice-cloner 0.0.0');
      expect(callsTo('loadModel')[0].args).toEqual(['/models/a']);
      expect(callsTo('clearCache')).toHaveLength(1);
    });
  });

  describe('NativeAudioProcessor', () => {
    const processor = () => new binding.NativeAudioProcessor();

    it('loads audio through the addon', async () => {
      await expect(processor().loadAudio('/a.wav')).resolves.toMatchObject({ sampleRate: 16000, channels: 1 });
    });

    it('averages interleaved channels into mono', () => {
      const mono = processor().convertToMono({ samples: [0.1, 0.3, 0.5, 0.7], sampleRate: 8000, channels: 2 });
      expect(mono.channels).toBe(1);
      expect(mono.samples[0]).toBeCloseTo(0.2);
      expect(mono.samples[1]).toBeCloseTo(0.6);
    });

    it('scales the peak to the target level', () => {
      const normalized = processor().normalize({ samples: [0.1, -0.5, 0.25], sampleRate: 8000, channels: 1 }, 1);
      expect(normalized.samples).toEqual([0.2, -1, 0.5]);
    });

    it('leaves silence untouched when normalizing', () => {
      const silent = { samples: [0, 0], sampleRate: 8000, channels: 1 };
      expect(processor().normalize(silent).samples).toEqual([0, 0]);
    });

    it('resamples to the target rate without changing duration', () => {
      const audio = { samples: new Array(44100).fill(0.5), sampleRate: 44100, channels: 1, duration: 1 };

      const resampled = processor().resample(audio, 22050);

      expect(resampled.sampleRate).toBe(22050);
      expect(resampled.samples).toHaveLength(22050);
      expect(resampled.duration).toBeCloseTo(1);
    });

    it('reports file info from the loaded audio', async () => {
      await expect(processor().getAudioInfo('/a.wav')).resolves.toMatchObject({ sampleRate: 16000, channels: 1 });
    });
  });

  describe('NativeCoreEngineFactory', () => {
    it('creates initialised components through the addon', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const factory = binding.createCoreEngineFactory();

      await expect(factory.initialize({ targetSampleRate: 16000 })).resolves.toBe(true);
      const cloner = await factory.createVoiceCloner();
      const processor = await factory.createAudioProcessor();

      expect(cloner).toBeInstanceOf(binding.NativeVoiceCloner);
      expect(processor).toBeInstanceOf(binding.NativeAudioProcessor);
      expect(factory.getVersion()).toBe('fake-addon 0.0.0');
      await expect(factory.shutdown()).resolves.toBeUndefined();
    });
  });
});
