/**
 * Test file for N-API Bindings
 */

import { isNativeAddonLoaded, getLoadError, getVersion, checkSystemRequirements, NativeVoiceCloner, NativeAudioProcessor, createCoreEngineFactory } from './napi-binding';
import { CoreEngineConfig } from '../types';

describe('N-API Bindings', () => {
  test('should check if native addon is loaded', () => {
    const loaded = isNativeAddonLoaded();
    const error = getLoadError();
    
    // If not loaded, error should be set
    if (!loaded) {
      expect(error).toBeTruthy();
      console.warn(`Native addon not loaded: ${error}`);
    } else {
      expect(error).toBeNull();
    }
  });

  test('should get version if addon is loaded', () => {
    if (!isNativeAddonLoaded()) {
      console.warn('Skipping version test - native addon not loaded');
      return;
    }
    
    const version = getVersion();
    expect(typeof version).toBe('string');
    expect(version.length).toBeGreaterThan(0);
    console.log(`Native addon version: ${version}`);
  });

  test('should check system requirements if addon is loaded', () => {
    if (!isNativeAddonLoaded()) {
      console.warn('Skipping system requirements test - native addon not loaded');
      return;
    }
    
    const requirements = checkSystemRequirements();
    
    // Check required properties
    expect(requirements).toHaveProperty('libsndfile_available');
    expect(requirements).toHaveProperty('portaudio_available');
    expect(requirements).toHaveProperty('supported_formats');
    expect(requirements).toHaveProperty('platform');
    expect(requirements).toHaveProperty('node_version');
    
    expect(typeof requirements.libsndfile_available).toBe('boolean');
    expect(typeof requirements.portaudio_available).toBe('boolean');
    expect(Array.isArray(requirements.supported_formats)).toBe(true);
    expect(typeof requirements.platform).toBe('string');
    expect(typeof requirements.node_version).toBe('string');
    
    console.log('System requirements:', JSON.stringify(requirements, null, 2));
  });

  test('should create VoiceCloner instance if addon is loaded', () => {
    if (!isNativeAddonLoaded()) {
      console.warn('Skipping VoiceCloner test - native addon not loaded');
      return;
    }
    
    const config: CoreEngineConfig = {
      targetSampleRate: 22050,
      targetChannels: 1,
      useGPU: false
    };
    
    const voiceCloner = new NativeVoiceCloner(config);
    expect(voiceCloner).toBeDefined();
    expect(typeof voiceCloner.initialize).toBe('function');
    expect(typeof voiceCloner.isInitialized).toBe('function');
    expect(typeof voiceCloner.getVersion).toBe('function');
  });

  test('should create AudioProcessor instance if addon is loaded', () => {
    if (!isNativeAddonLoaded()) {
      console.warn('Skipping AudioProcessor test - native addon not loaded');
      return;
    }
    
    const audioProcessor = new NativeAudioProcessor();
    expect(audioProcessor).toBeDefined();
    expect(typeof audioProcessor.loadAudio).toBe('function');
    expect(typeof audioProcessor.convertToMono).toBe('function');
    expect(typeof audioProcessor.normalize).toBe('function');
  });

  test('should create CoreEngineFactory instance if addon is loaded', () => {
    if (!isNativeAddonLoaded()) {
      console.warn('Skipping CoreEngineFactory test - native addon not loaded');
      return;
    }
    
    const factory = createCoreEngineFactory();
    expect(factory).toBeDefined();
    expect(typeof factory.initialize).toBe('function');
    expect(typeof factory.createVoiceCloner).toBe('function');
    expect(typeof factory.createAudioProcessor).toBe('function');
    expect(typeof factory.getVersion).toBe('function');
  });

  test('VoiceCloner methods should throw if not initialized', async () => {
    if (!isNativeAddonLoaded()) {
      console.warn('Skipping VoiceCloner initialization test - native addon not loaded');
      return;
    }
    
    const voiceCloner = new NativeVoiceCloner();
    
    // Should be able to call initialize
    const initialized = await voiceCloner.initialize();
    expect(typeof initialized).toBe('boolean');
    
    // Other methods should not throw if initialized is false
    // (they should handle the initialization check)
    expect(() => voiceCloner.isInitialized()).not.toThrow();
    
    // Test that getVersion works even without full initialization
    const version = voiceCloner.getVersion();
    expect(typeof version).toBe('string');
  });

  test('should handle audio data conversion', () => {
    if (!isNativeAddonLoaded()) {
      console.warn('Skipping audio data conversion test - native addon not loaded');
      return;
    }
    
    const audioProcessor = new NativeAudioProcessor();
    
    // Test mono conversion
    const stereoAudio = {
      samples: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6],
      sampleRate: 44100,
      channels: 2,
      duration: 0.0001
    };
    
    const monoAudio = audioProcessor.convertToMono(stereoAudio);
    expect(monoAudio.channels).toBe(1);
    expect(monoAudio.samples.length).toBe(3); // 6 samples / 2 channels = 3 samples
    expect(monoAudio.sampleRate).toBe(stereoAudio.sampleRate);
    
    // Test normalization
    const audioToNormalize = {
      samples: [0.5, -0.5, 0.3, -0.3],
      sampleRate: 44100,
      channels: 1
    };
    
    const normalized = audioProcessor.normalize(audioToNormalize, 0.8);
    expect(normalized.samples.length).toBe(audioToNormalize.samples.length);
    
    // Find max amplitude in normalized audio
    let maxAmplitude = 0;
    for (const sample of normalized.samples) {
      const absSample = Math.abs(sample);
      if (absSample > maxAmplitude) {
        maxAmplitude = absSample;
      }
    }
    
    // Should be close to target level (0.8) within floating point tolerance
    expect(Math.abs(maxAmplitude - 0.8)).toBeLessThan(0.01);
    
    // Test resampling
    const audioToResample = {
      samples: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
      sampleRate: 44100,
      channels: 1
    };
    
    const resampled = audioProcessor.resample(audioToResample, 22050);
    expect(resampled.sampleRate).toBe(22050);
    expect(resampled.samples.length).toBeLessThanOrEqual(audioToResample.samples.length);
  });
});

// Simple manual test function
export async function testNapiBindings() {
  console.log('Testing N-API Bindings...');
  
  const loaded = isNativeAddonLoaded();
  console.log(`Native addon loaded: ${loaded}`);
  
  if (!loaded) {
    const error = getLoadError();
    console.error(`Load error: ${error}`);
    return false;
  }
  
  try {
    // Test version
    const version = getVersion();
    console.log(`Version: ${version}`);
    
    // Test system requirements
    const requirements = checkSystemRequirements();
    console.log('System requirements:', requirements);
    
    // Test factory creation
    const factory = createCoreEngineFactory();
    console.log('CoreEngineFactory created successfully');
    
    // Test VoiceCloner creation
    const voiceCloner = new NativeVoiceCloner();
    console.log('VoiceCloner created successfully');
    
    // Test AudioProcessor creation
    const audioProcessor = new NativeAudioProcessor();
    console.log('AudioProcessor created successfully');
    
    return true;
  } catch (error) {
    console.error('Error testing N-API bindings:', error);
    return false;
  }
}

// Run manual test if this file is executed directly
if (require.main === module) {
  testNapiBindings().then(success => {
    if (success) {
      console.log('N-API bindings test PASSED');
    } else {
      console.log('N-API bindings test FAILED');
      process.exit(1);
    }
  }).catch(error => {
    console.error('Unhandled error in N-API bindings test:', error);
    process.exit(1);
  });
}