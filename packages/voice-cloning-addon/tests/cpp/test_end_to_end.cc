#include <iostream>
#include <cassert>
#include <vector>
#include <memory>
#include "f5_tts_wrapper.h"
#include "audio_processor.h"
#include "logger.h"

using namespace f5_tts;
using namespace audio;

// Helper to get logger
logging::Logger& get_test_logger() {
  static logging::Logger& logger = logging::Logger::get_instance("test_end_to_end");
  return logger;
}

void test_audio_processor_basic() {
  get_test_logger().info("Test 1: Testing AudioProcessor basic functionality...");
  
  AudioProcessor processor;
  bool initialized = processor.initialize();
  assert(initialized == true);
  get_test_logger().info("  ✓ AudioProcessor initialized successfully");
  
  // Test format detection
  AudioFormat wav_format = AudioProcessor::format_from_extension(".wav");
  assert(wav_format == AudioFormat::WAV);
  
  AudioFormat mp3_format = AudioProcessor::format_from_extension(".mp3");
  assert(mp3_format == AudioFormat::MP3);
  
  AudioFormat unknown_format = AudioProcessor::format_from_extension(".unknown");
  assert(unknown_format == AudioFormat::UNKNOWN);
  
  get_test_logger().info("  ✓ Format detection works correctly");
  
  // Test format support
  bool wav_supported = AudioProcessor::is_format_supported(AudioFormat::WAV);
  assert(wav_supported == true);
  
  get_test_logger().info("  ✓ Format support check works");
  
  get_test_logger().info("  ✓ AudioProcessor basic test passed");
}

void test_audio_resampling() {
  get_test_logger().info("Test 2: Testing audio resampling...");
  
  AudioProcessor processor;
  processor.initialize();
  
  // Create test audio data
  AudioData test_audio;
  test_audio.sample_rate = 44100;
  test_audio.channels = 1;
  test_audio.samples.resize(44100, 0.1f);  // 1 second at 44.1kHz
  
  // Resample to 22050 Hz
  AudioData resampled = processor.resample(test_audio, 22050);
  
  assert(resampled.sample_rate == 22050);
  assert(resampled.channels == 1);
  assert(resampled.samples.size() == 22050);  // Half the samples
  
  get_test_logger().info("  Resampled from " + std::to_string(test_audio.sample_rate) + 
                         "Hz to " + std::to_string(resampled.sample_rate) + "Hz");
  
  get_test_logger().info("  ✓ Audio resampling test passed");
}

void test_audio_normalization() {
  get_test_logger().info("Test 3: Testing audio normalization...");
  
  AudioProcessor processor;
  processor.initialize();
  
  // Create test audio with low volume
  AudioData test_audio;
  test_audio.sample_rate = 22050;
  test_audio.channels = 1;
  test_audio.samples.resize(22050, 0.1f);  // Low volume
  
  // Normalize
  AudioData normalized = processor.normalize(test_audio, 0.9f);
  
  // Find maximum value
  float max_val = 0.0f;
  for (float sample : normalized.samples) {
    float abs_sample = std::abs(sample);
    if (abs_sample > max_val) {
      max_val = abs_sample;
    }
  }
  
  assert(std::abs(max_val - 0.9f) < 0.01f);  // Should be normalized to ~0.9
  
  get_test_logger().info("  Normalized audio max value: " + std::to_string(max_val));
  
  get_test_logger().info("  ✓ Audio normalization test passed");
}

void test_f5_tts_integration() {
  get_test_logger().info("Test 4: Testing F5-TTS integration...");
  
  // Create F5-TTS configuration
  F5TTSConfig config;
  config.model_path = "./models/f5-tts";
  config.vocoder_path = "./models/vocoder";
  config.use_gpu = false;
  config.max_concurrent_requests = 5;
  config.timeout_seconds = 30.0f;
  
  // Create wrapper
  F5TTSWrapper wrapper(config);
  get_test_logger().info("  Created F5TTSWrapper with config");
  
  // Initialize
  bool initialized = wrapper.initialize();
  assert(initialized == true);
  get_test_logger().info("  ✓ F5-TTS wrapper initialized");
  
  // Create test audio
  AudioData test_audio;
  test_audio.sample_rate = 22050;
  test_audio.channels = 1;
  test_audio.samples.resize(22050, 0.0f);  // 1 second of audio
  
  // Add some simple waveform for testing
  for (int i = 0; i < 22050; ++i) {
    float t = static_cast<float>(i) / 22050.0f;
    test_audio.samples[i] = 0.1f * std::sin(2.0f * M_PI * 440.0f * t);  // A4 note
  }
  
  // Test voice embedding extraction
  get_test_logger().info("  Testing voice embedding extraction...");
  VoiceEmbedding embedding = wrapper.extract_voice_embedding(test_audio);
  
  assert(embedding.dimension == 256);
  assert(embedding.embedding.size() == 256);
  get_test_logger().info("  ✓ Voice embedding extracted (dimension: " + 
                         std::to_string(embedding.dimension) + ")");
  
  // Test speech synthesis
  get_test_logger().info("  Testing speech synthesis...");
  std::string test_text = "Hello, this is a test of the voice cloning system.";
  AudioData synthesized = wrapper.synthesize_speech(embedding, test_text, "en", 1.0f);
  
  assert(synthesized.sample_rate == 22050);
  assert(synthesized.channels == 1);
  assert(!synthesized.samples.empty());
  get_test_logger().info("  ✓ Speech synthesized (duration: " + 
                         std::to_string(synthesized.duration()) + "s)");
  
  // Test complete voice cloning pipeline
  get_test_logger().info("  Testing complete voice cloning pipeline...");
  VoiceCloningInput input;
  input.voice_sample = test_audio;
  input.text = test_text;
  input.language = "en";
  input.speed = 1.0f;
  
  VoiceCloningResult result = wrapper.clone_voice(input);
  
  assert(result.success == true);
  assert(result.processing_time_ms > 0);
  assert(result.similarity_score >= 0.0f && result.similarity_score <= 1.0f);
  assert(!result.audio.samples.empty());
  assert(result.embedding.embedding.size() == 256);
  
  get_test_logger().info("  ✓ Voice cloning pipeline completed successfully");
  get_test_logger().info("    Processing time: " + std::to_string(result.processing_time_ms) + "ms");
  get_test_logger().info("    Similarity score: " + std::to_string(result.similarity_score));
  get_test_logger().info("    Audio duration: " + std::to_string(result.audio.duration()) + "s");
  
  // Test memory management
  get_test_logger().info("  Testing memory management...");
  size_t memory_usage = wrapper.get_memory_usage();
  get_test_logger().info("    Memory usage: " + std::to_string(memory_usage) + " bytes");
  
  wrapper.clear_cache();
  get_test_logger().info("  ✓ Cache cleared successfully");
  
  get_test_logger().info("  ✓ F5-TTS integration test passed");
}

void test_error_handling() {
  get_test_logger().info("Test 5: Testing error handling...");
  
  AudioProcessor processor;
  processor.initialize();
  
  // Test loading non-existent file
  AudioProcessingResult result = processor.load_audio("/nonexistent/file.wav");
  assert(result.success == false);
  assert(!result.error_message.empty());
  get_test_logger().info("  ✓ Error handling for non-existent file works");
  
  // Test with empty audio data
  AudioData empty_audio;
  empty_audio.sample_rate = 22050;
  empty_audio.channels = 1;
  empty_audio.samples.clear();  // Empty samples
  
  AudioData normalized = processor.normalize(empty_audio);
  assert(normalized.samples.empty());
  get_test_logger().info("  ✓ Empty audio handling works");
  
  get_test_logger().info("  ✓ Error handling test passed");
}

int main() {
  // Configure logger
  logging::Logger::get_instance("test_end_to_end").set_level(logging::LogLevel::INFO);
  
  std::cout << "=== Voice Cloning Addon End-to-End Test ===" << std::endl;
  std::cout << std::endl;
  
  try {
    test_audio_processor_basic();
    std::cout << std::endl;
    
    test_audio_resampling();
    std::cout << std::endl;
    
    test_audio_normalization();
    std::cout << std::endl;
    
    test_f5_tts_integration();
    std::cout << std::endl;
    
    test_error_handling();
    std::cout << std::endl;
    
    std::cout << "=== All end-to-end tests passed! ===" << std::endl;
    return 0;
    
  } catch (const std::exception& e) {
    std::cerr << "Test failed with exception: " << e.what() << std::endl;
    return 1;
  } catch (...) {
    std::cerr << "Test failed with unknown exception" << std::endl;
    return 1;
  }
}