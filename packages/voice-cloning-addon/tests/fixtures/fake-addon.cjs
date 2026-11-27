/**
 * A stand-in for the compiled voice_cloning_addon.node, used by the
 * napi-binding tests via VOICE_CLONING_ADDON_PATH. It mirrors the exports
 * and argument conventions of src/cpp/addon.cc and src/cpp/voice_cloner.cc,
 * and records every VoiceCloner call so tests can check what was passed.
 */
'use strict';

const state = {
  calls: [],
  initialized: false,
  cloneResult: null,
};

function defaultCloneResult() {
  return {
    success: true,
    similarityScore: 0.9,
    processingTimeMs: 5,
    errorMessage: '',
    audio: { samples: Buffer.from([1, 2, 3, 4]), sampleRate: 22050, channels: 1 },
    embedding: { embedding: [0.1, 0.2], dimension: 2 },
  };
}

class VoiceCloner {
  constructor() {
    state.calls.push({ method: 'constructor', args: [] });
  }

  initialize() {
    state.calls.push({ method: 'initialize', args: [] });
    state.initialized = true;
    return true;
  }

  isInitialized() {
    return state.initialized;
  }

  loadModel(path) {
    state.calls.push({ method: 'loadModel', args: [path] });
    return true;
  }

  loadVocoder(path) {
    state.calls.push({ method: 'loadVocoder', args: [path] });
    return true;
  }

  extractVoiceEmbedding(...args) {
    state.calls.push({ method: 'extractVoiceEmbedding', args });
    return { embedding: [0.5, 0.25], dimension: 2 };
  }

  synthesizeSpeech(...args) {
    state.calls.push({ method: 'synthesizeSpeech', args });
    return { samples: Buffer.from([9, 8, 7]), sampleRate: 22050, channels: 1 };
  }

  cloneVoice(...args) {
    state.calls.push({ method: 'cloneVoice', args });
    return state.cloneResult || defaultCloneResult();
  }

  // Like the C++ implementation, the callback is always the last argument.
  cloneVoiceAsync(...args) {
    state.calls.push({ method: 'cloneVoiceAsync', args });
    const callback = args[args.length - 1];
    if (typeof callback !== 'function') {
      throw new TypeError('cloneVoiceAsync: last argument must be a callback');
    }
    const result = state.cloneResult || defaultCloneResult();
    setImmediate(() => callback(null, result));
  }

  getMemoryUsage() {
    return 1234;
  }

  clearCache() {
    state.calls.push({ method: 'clearCache', args: [] });
  }

  getVersion() {
    return 'fake-voice-cloner 0.0.0';
  }
}

module.exports = {
  VoiceCloner,
  getVersion: () => 'fake-addon 0.0.0',
  checkSystemRequirements: () => ({
    libsndfile_available: true,
    portaudio_available: false,
    supported_formats: ['wav', 'flac', 'ogg'],
    platform: 'linux',
    node_version: '24',
  }),
  loadAudioFile: (path) => ({ samples: [0, 0.5, -0.5], sampleRate: 16000, channels: 1, duration: 3 / 16000, path }),

  // Test helpers (not part of the real addon)
  __state: state,
  __reset() {
    state.calls = [];
    state.initialized = false;
    state.cloneResult = null;
  },
};
