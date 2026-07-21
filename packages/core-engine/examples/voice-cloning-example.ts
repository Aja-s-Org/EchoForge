#!/usr/bin/env node

/**
 * Voice Cloning Example using N-API Bindings
 * 
 * This example demonstrates how to use the Node.js N-API bindings
 * for the voice cloning addon.
 */

import { 
  isNativeAddonLoaded, 
  getLoadError,
  getVersion,
  checkSystemRequirements,
  NativeVoiceCloner,
  NativeAudioProcessor,
  createCoreEngineFactory,
  CoreEngineConfig
} from '../src/lib/napi-binding';

async function runExample() {
  console.log('=== Voice Cloning N-API Example ===\n');
  
  // Step 1: Check if native addon is loaded
  console.log('1. Checking native addon status...');
  const loaded = isNativeAddonLoaded();
  
  if (!loaded) {
    const error = getLoadError();
    console.error(`❌ Native addon not loaded: ${error}`);
    console.log('\nTo build the native addon, run:');
    console.log('  cd packages/core-engine');
    console.log('  npm run build:native');
    return;
  }
  
  console.log('✅ Native addon loaded successfully\n');
  
  // Step 2: Get version information
  console.log('2. Getting version information...');
  const version = getVersion();
  console.log(`✅ Version: ${version}\n`);
  
  // Step 3: Check system requirements
  console.log('3. Checking system requirements...');
  const requirements = checkSystemRequirements();
  console.log('✅ System requirements:');
  console.log(`   Platform: ${requirements.platform}`);
  console.log(`   Node.js version: ${requirements.node_version}`);
  console.log(`   libsndfile available: ${requirements.libsndfile_available}`);
  console.log(`   PortAudio available: ${requirements.portaudio_available}`);
  console.log(`   Supported formats: ${requirements.supported_formats.join(', ')}\n`);
  
  // Step 4: Create Core Engine Factory
  console.log('4. Creating Core Engine Factory...');
  const factory = createCoreEngineFactory();
  
  const config: CoreEngineConfig = {
    targetSampleRate: 22050,
    targetChannels: 1,
    useGPU: false,
    f5ttsModelPath: process.env.F5TTS_MODEL_PATH || './models/f5-tts',
    f5ttsVocoderPath: process.env.F5TTS_VOCODER_PATH || './models/vocoder'
  };
  
  await factory.initialize(config);
  console.log('✅ Core Engine Factory initialized\n');
  
  // Step 5: Create Voice Cloner
  console.log('5. Creating Voice Cloner...');
  const voiceCloner = new NativeVoiceCloner(config);
  const initialized = await voiceCloner.initialize();
  console.log(`✅ Voice Cloner initialized: ${initialized}\n`);
  
  // Step 6: Create Audio Processor
  console.log('6. Creating Audio Processor...');
  const audioProcessor = new NativeAudioProcessor();
  console.log('✅ Audio Processor created\n');
  
  // Step 7: Demonstrate audio processing
  console.log('7. Demonstrating audio processing...');
  
  const testAudio = {
    samples: new Array(1000).fill(0).map((_, i) => Math.sin(i * 0.01)),
    sampleRate: 44100,
    channels: 2
  };
  
  // Convert to mono
  const monoAudio = audioProcessor.convertToMono(testAudio);
  console.log(`   Converted ${testAudio.channels}-channel audio to ${monoAudio.channels}-channel mono`);
  
  // Normalize
  const normalizedAudio = audioProcessor.normalize(monoAudio, 0.5);
  console.log(`   Normalized audio to target level 0.5`);
  
  // Resample
  const resampledAudio = audioProcessor.resample(normalizedAudio, 22050);
  console.log(`   Resampled from ${normalizedAudio.sampleRate}Hz to ${resampledAudio.sampleRate}Hz\n`);
  
  // Step 8: Show Voice Cloner capabilities
  console.log('8. Voice Cloner capabilities:');
  console.log(`   Version: ${voiceCloner.getVersion()}`);
  
  try {
    const memoryUsage = await voiceCloner.getMemoryUsage();
    console.log(`   Memory usage: ${memoryUsage} bytes`);
  } catch (error) {
    console.log(`   Memory usage: Not available (${error instanceof Error ? error.message : String(error)})`);
  }
  
  // Step 9: Cleanup
  console.log('\n9. Cleaning up...');
  await factory.shutdown();
  console.log('✅ Cleanup completed\n');
  
  console.log('=== Example completed successfully ===');
  console.log('\nNext steps:');
  console.log('1. Load a model: await voiceCloner.loadModel("./path/to/model")');
  console.log('2. Load a vocoder: await voiceCloner.loadVocoder("./path/to/vocoder")');
  console.log('3. Extract voice embedding:');
  console.log('   const embedding = await voiceCloner.extractVoiceEmbedding(audioBuffer)');
  console.log('4. Synthesize speech:');
  console.log('   const audio = await voiceCloner.synthesizeSpeech(embedding, "Hello world")');
  console.log('5. Clone voice directly:');
  console.log('   const clonedAudio = await voiceCloner.cloneVoice(audioBuffer, "Text to speak")');
}

// Error handling
runExample().catch(error => {
  console.error('\n❌ Error running example:');
  console.error(error instanceof Error ? error.message : String(error));
  
  if (error instanceof Error && error.stack) {
    console.error('\nStack trace:');
    console.error(error.stack);
  }
  
  process.exit(1);
});