#include <gtest/gtest.h>
#include "audio_processor.h"
#include "config_manager.h"
#include "logger.h"
#include <iostream>
#include <fstream>
#include <cstdio>

using namespace audio;
using namespace config;

// Test basic audio processor functionality
TEST(AudioProcessorTest, BasicInitialization) {
  AudioProcessor processor;
  EXPECT_TRUE(processor.initialize());
  EXPECT_TRUE(processor.get_error().empty());
}

TEST(AudioProcessorTest, FormatSupport) {
  EXPECT_TRUE(AudioProcessor::is_format_supported(AudioFormat::WAV));
  EXPECT_TRUE(AudioProcessor::is_format_supported(AudioFormat::FLAC));
  EXPECT_TRUE(AudioProcessor::is_format_supported(AudioFormat::OGG));
  
  // MP3 might not be supported depending on libsndfile configuration
  // EXPECT_FALSE(AudioProcessor::is_format_supported(AudioFormat::MP3));
}

TEST(AudioProcessorTest, FormatDetection) {
  EXPECT_EQ(AudioProcessor::format_from_extension(".wav"), AudioFormat::WAV);
  EXPECT_EQ(AudioProcessor::format_from_extension(".flac"), AudioFormat::FLAC);
  EXPECT_EQ(AudioProcessor::format_from_extension(".ogg"), AudioFormat::OGG);
  EXPECT_EQ(AudioProcessor::format_from_extension(".mp3"), AudioFormat::MP3);
  EXPECT_EQ(AudioProcessor::format_from_extension(".unknown"), AudioFormat::UNKNOWN);
  
  EXPECT_EQ(AudioProcessor::format_from_filepath("/path/to/audio.wav"), AudioFormat::WAV);
  EXPECT_EQ(AudioProcessor::format_from_filepath("audio.flac"), AudioFormat::FLAC);
  EXPECT_EQ(AudioProcessor::format_from_filepath("no_extension"), AudioFormat::UNKNOWN);
}

// Test config manager
TEST(ConfigManagerTest, BasicOperations) {
  ConfigManager& config = ConfigManager::get_instance();
  
  // Test default values
  EXPECT_EQ(config.get_int("audio", "target_sample_rate"), 22050);
  EXPECT_EQ(config.get_int("audio", "target_channels"), 1);
  EXPECT_FLOAT_EQ(config.get_float("audio", "normalization_threshold"), 0.95f);
  EXPECT_FALSE(config.get_bool("audio", "enable_noise_reduction"));
  
  // Test set/get
  config.set_string("test", "string_key", "test_value");
  EXPECT_EQ(config.get_string("test", "string_key"), "test_value");
  
  config.set_int("test", "int_key", 42);
  EXPECT_EQ(config.get_int("test", "int_key"), 42);
  
  config.set_float("test", "float_key", 3.14f);
  EXPECT_FLOAT_EQ(config.get_float("test", "float_key"), 3.14f);
  
  config.set_bool("test", "bool_key", true);
  EXPECT_TRUE(config.get_bool("test", "bool_key"));
  
  // Test existence checks
  EXPECT_TRUE(config.has_section("test"));
  EXPECT_TRUE(config.has_key("test", "string_key"));
  EXPECT_FALSE(config.has_key("test", "nonexistent_key"));
  
  // Test removal
  EXPECT_TRUE(config.remove_key("test", "string_key"));
  EXPECT_FALSE(config.has_key("test", "string_key"));
  
  EXPECT_TRUE(config.remove_section("test"));
  EXPECT_FALSE(config.has_section("test"));
}

TEST(ConfigManagerTest, SaveAndLoad) {
  ConfigManager& config = ConfigManager::get_instance();
  
  // Create test file path
  std::string test_file = "/tmp/test_config.cfg";
  
  // Add some test values
  config.set_string("test_section", "test_string", "hello");
  config.set_int("test_section", "test_int", 123);
  config.set_float("test_section", "test_float", 456.789f);
  config.set_bool("test_section", "test_bool", true);
  
  // Save to file
  EXPECT_TRUE(config.save_config(test_file));
  
  // Clear config and load from file
  config.clear();
  EXPECT_TRUE(config.load_config(test_file));
  
  // Verify values were loaded
  EXPECT_EQ(config.get_string("test_section", "test_string"), "hello");
  EXPECT_EQ(config.get_int("test_section", "test_int"), 123);
  EXPECT_FLOAT_EQ(config.get_float("test_section", "test_float"), 456.789f);
  EXPECT_TRUE(config.get_bool("test_section", "test_bool"));
  
  // Clean up
  std::remove(test_file.c_str());
}

// Test logger
TEST(LoggerTest, BasicLogging) {
  logging::Logger& logger = logging::Logger::get_instance("test_logger");
  
  // Set level to debug to capture all messages
  logger.set_level(logging::LogLevel::DEBUG);
  
  // These should all work without throwing
  EXPECT_NO_THROW(logger.trace("Trace message"));
  EXPECT_NO_THROW(logger.debug("Debug message"));
  EXPECT_NO_THROW(logger.info("Info message"));
  EXPECT_NO_THROW(logger.warn("Warning message"));
  EXPECT_NO_THROW(logger.error("Error message"));
  EXPECT_NO_THROW(logger.fatal("Fatal message"));
  
  // Test flush and close
  EXPECT_NO_THROW(logger.flush());
  EXPECT_NO_THROW(logger.close());
}

// Test audio data operations
TEST(AudioDataTest, BasicOperations) {
  AudioData audio(44100, 2);  // 44.1kHz stereo
  
  EXPECT_EQ(audio.sample_rate, 44100);
  EXPECT_EQ(audio.channels, 2);
  EXPECT_EQ(audio.num_frames(), 0);
  EXPECT_FLOAT_EQ(audio.duration(), 0.0f);
  
  // Add some samples
  audio.samples = {0.1f, 0.2f, 0.3f, 0.4f, 0.5f, 0.6f};  // 3 frames of stereo
  
  EXPECT_EQ(audio.size(), 6);
  EXPECT_EQ(audio.num_frames(), 3);
  EXPECT_FLOAT_EQ(audio.duration(), 3.0f / 44100.0f);
}

// Test audio processing functions
TEST(AudioProcessingTest, MonoConversion) {
  // Create stereo audio data (2 channels)
  AudioData stereo(44100, 2);
  stereo.samples = {0.1f, 0.2f,  // Frame 1: left=0.1, right=0.2
                    0.3f, 0.4f,  // Frame 2: left=0.3, right=0.4
                    0.5f, 0.6f}; // Frame 3: left=0.5, right=0.6
  
  AudioProcessor processor;
  processor.initialize();
  
  AudioData mono = processor.to_mono(stereo);
  
  EXPECT_EQ(mono.channels, 1);
  EXPECT_EQ(mono.sample_rate, 44100);
  EXPECT_EQ(mono.num_frames(), 3);
  
  // Check mono conversion: average of left and right channels
  EXPECT_FLOAT_EQ(mono.samples[0], (0.1f + 0.2f) / 2.0f);
  EXPECT_FLOAT_EQ(mono.samples[1], (0.3f + 0.4f) / 2.0f);
  EXPECT_FLOAT_EQ(mono.samples[2], (0.5f + 0.6f) / 2.0f);
}

TEST(AudioProcessingTest, Normalization) {
  AudioData audio(44100, 1);
  audio.samples = {0.1f, 0.2f, 0.3f, 0.4f, 0.5f};
  
  AudioProcessor processor;
  processor.initialize();
  
  AudioData normalized = processor.normalize(audio, 1.0f);
  
  EXPECT_EQ(normalized.samples.size(), 5);
  
  // Check that values are scaled (max was 0.5, so all values doubled)
  EXPECT_FLOAT_EQ(normalized.samples[0], 0.2f);
  EXPECT_FLOAT_EQ(normalized.samples[1], 0.4f);
  EXPECT_FLOAT_EQ(normalized.samples[2], 0.6f);
  EXPECT_FLOAT_EQ(normalized.samples[3], 0.8f);
  EXPECT_FLOAT_EQ(normalized.samples[4], 1.0f);  // Max value should be 1.0
}

// Main function
int main(int argc, char** argv) {
  ::testing::InitGoogleTest(&argc, argv);
  return RUN_ALL_TESTS();
}