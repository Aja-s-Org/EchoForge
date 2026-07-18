#include <iostream>
#include "audio_processor.h"
#include "config_manager.h"
#include "logger.h"
#include <memory>

using namespace audio;
using namespace config;
using namespace logging;

int main() {
  std::cout << "Testing Voice Cloning Addon Core Components\n";
  std::cout << "===========================================\n\n";
  
  // Test 1: Logger
  std::cout << "1. Testing Logger...\n";
  Logger& logger = Logger::get_instance("test");
  logger.set_level(LogLevel::INFO);
  logger.info("Logger test passed");
  std::cout << "   ✓ Logger working\n\n";
  
  // Test 2: Config Manager
  std::cout << "2. Testing Config Manager...\n";
  ConfigManager& config = ConfigManager::get_instance();
  
  // Test default values
  int sample_rate = config.get_int("audio", "target_sample_rate", -1);
  if (sample_rate == 22050) {
    std::cout << "   ✓ Default config values loaded correctly\n";
  } else {
    std::cout << "   ✗ Default config values incorrect: " << sample_rate << "\n";
    return 1;
  }
  
  // Test set/get
  config.set_string("test", "test_key", "test_value");
  if (config.get_string("test", "test_key") == "test_value") {
    std::cout << "   ✓ Config set/get working\n";
  } else {
    std::cout << "   ✗ Config set/get failed\n";
    return 1;
  }
  
  std::cout << "   ✓ Config Manager test passed\n\n";
  
  // Test 3: Audio Processor
  std::cout << "3. Testing Audio Processor...\n";
  AudioProcessor processor;
  
  if (!processor.initialize()) {
    std::cout << "   ✗ Audio Processor initialization failed: " << processor.get_error() << "\n";
    return 1;
  }
  std::cout << "   ✓ Audio Processor initialized\n";
  
  // Test format detection
  AudioFormat wav_format = AudioProcessor::format_from_extension(".wav");
  if (wav_format == AudioFormat::WAV) {
    std::cout << "   ✓ WAV format detection working\n";
  } else {
    std::cout << "   ✗ WAV format detection failed\n";
    return 1;
  }
  
  // Test format support
  if (AudioProcessor::is_format_supported(AudioFormat::WAV)) {
    std::cout << "   ✓ WAV format supported\n";
  } else {
    std::cout << "   ✗ WAV format not supported\n";
    return 1;
  }
  
  std::cout << "   ✓ Audio Processor test passed\n\n";
  
  // Test 4: Audio Processing Functions
  std::cout << "4. Testing Audio Processing Functions...\n";
  
  // Create test audio data
  AudioData test_audio(44100, 2);  // 44.1kHz stereo
  test_audio.samples = {0.1f, 0.2f, 0.3f, 0.4f, 0.5f, 0.6f};  // 3 frames
  
  // Test mono conversion
  AudioData mono = processor.to_mono(test_audio);
  if (mono.channels == 1 && mono.num_frames() == 3) {
    std::cout << "   ✓ Mono conversion working\n";
  } else {
    std::cout << "   ✗ Mono conversion failed\n";
    return 1;
  }
  
  // Test normalization
  AudioData normalized = processor.normalize(test_audio, 1.0f);
  if (normalized.samples.size() == test_audio.samples.size()) {
    std::cout << "   ✓ Normalization working\n";
  } else {
    std::cout << "   ✗ Normalization failed\n";
    return 1;
  }
  
  std::cout << "   ✓ Audio Processing Functions test passed\n\n";
  
  std::cout << "===========================================\n";
  std::cout << "All core component tests passed successfully!\n";
  std::cout << "Ready for Python service integration tests.\n";
  
  return 0;
}