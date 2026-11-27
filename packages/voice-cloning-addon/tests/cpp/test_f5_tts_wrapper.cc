#include <gtest/gtest.h>

#include <stdexcept>
#include <string>

#include "f5_tts_wrapper.h"

using f5_tts::AudioData;
using f5_tts::F5TTSConfig;
using f5_tts::F5TTSWrapper;
using f5_tts::VoiceCloningInput;
using f5_tts::VoiceEmbedding;

// These tests cover the wrapper's contract (initialisation, errors, config),
// not the audio it generates: synthesis is still a placeholder until the
// Python service is wired in (see issue #20).

namespace {

F5TTSConfig test_config() {
  F5TTSConfig config;
  config.model_path = "/models/f5-tts";
  config.vocoder_path = "/models/vocoder";
  config.use_gpu = false;
  return config;
}

AudioData voice_sample() {
  AudioData audio(22050, 1);
  audio.samples.assign(22050, 0.1f);  // 1 second
  return audio;
}

}  // namespace

TEST(F5TTSWrapperTest, StartsUninitialised) {
  F5TTSWrapper wrapper(test_config());
  EXPECT_FALSE(wrapper.is_initialized());
}

TEST(F5TTSWrapperTest, InitialiseIsIdempotent) {
  F5TTSWrapper wrapper(test_config());
  EXPECT_TRUE(wrapper.initialize());
  EXPECT_TRUE(wrapper.initialize());
  EXPECT_TRUE(wrapper.is_initialized());
}

TEST(F5TTSWrapperTest, ExtractingEmbeddingBeforeInitialiseThrows) {
  F5TTSWrapper wrapper(test_config());
  EXPECT_THROW(wrapper.extract_voice_embedding(voice_sample()), std::runtime_error);
}

TEST(F5TTSWrapperTest, SynthesisingBeforeInitialiseThrows) {
  F5TTSWrapper wrapper(test_config());
  EXPECT_THROW(wrapper.synthesize_speech(VoiceEmbedding(), "hello"), std::runtime_error);
}

TEST(F5TTSWrapperTest, CloneVoiceBeforeInitialiseReportsFailure) {
  F5TTSWrapper wrapper(test_config());
  VoiceCloningInput input;
  input.voice_sample = voice_sample();
  input.text = "hello";

  const auto result = wrapper.clone_voice(input);

  EXPECT_FALSE(result.success);
  EXPECT_NE(result.error_message.find("not initialized"), std::string::npos) << result.error_message;
  EXPECT_GE(result.processing_time_ms, 0.0f);
}

TEST(F5TTSWrapperTest, CloneVoiceReturnsAudioAndEmbedding) {
  F5TTSWrapper wrapper(test_config());
  ASSERT_TRUE(wrapper.initialize());
  VoiceCloningInput input;
  input.voice_sample = voice_sample();
  input.text = "hello world";

  const auto result = wrapper.clone_voice(input);

  ASSERT_TRUE(result.success) << result.error_message;
  EXPECT_TRUE(result.error_message.empty());
  EXPECT_GT(result.audio.sample_rate, 0);
  EXPECT_EQ(result.audio.channels, 1);
  EXPECT_FALSE(result.audio.samples.empty());
  EXPECT_EQ(result.embedding.embedding.size(), static_cast<size_t>(result.embedding.dimension));
  EXPECT_GE(result.similarity_score, 0.0f);
  EXPECT_LE(result.similarity_score, 1.0f);
}

TEST(F5TTSWrapperTest, ReturnsTheConfigItWasCreatedWith) {
  F5TTSWrapper wrapper(test_config());
  const auto config = wrapper.get_config();
  EXPECT_EQ(config.model_path, "/models/f5-tts");
  EXPECT_EQ(config.vocoder_path, "/models/vocoder");
  EXPECT_FALSE(config.use_gpu);
}

TEST(F5TTSWrapperTest, UpdateConfigReplacesConfig) {
  F5TTSWrapper wrapper(test_config());
  F5TTSConfig updated = test_config();
  updated.max_concurrent_requests = 2;

  EXPECT_TRUE(wrapper.update_config(updated));
  EXPECT_EQ(wrapper.get_config().max_concurrent_requests, 2);
}

TEST(F5TTSWrapperTest, LoadModelAndVocoderUpdateConfig) {
  F5TTSWrapper wrapper(test_config());

  EXPECT_TRUE(wrapper.load_model("/models/other"));
  EXPECT_TRUE(wrapper.load_vocoder("/models/other-vocoder"));

  EXPECT_EQ(wrapper.get_config().model_path, "/models/other");
  EXPECT_EQ(wrapper.get_config().vocoder_path, "/models/other-vocoder");
}

TEST(F5TTSWrapperTest, ReportsVersion) {
  EXPECT_FALSE(F5TTSWrapper::get_version().empty());
}
