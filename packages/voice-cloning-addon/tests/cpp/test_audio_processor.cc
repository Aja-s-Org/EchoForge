#include <gtest/gtest.h>

#include <cmath>
#include <cstdio>
#include <string>
#include <vector>

#include "audio_processor.h"

using audio::AudioData;
using audio::AudioFormat;
using audio::AudioProcessor;

namespace {

constexpr float kPi = 3.14159265358979f;

// A short mono sine wave, used as an in-memory audio fixture.
AudioData make_sine(int sample_rate, double seconds, float amplitude = 0.5f, float frequency = 440.0f) {
  AudioData audio(sample_rate, 1);
  const size_t frames = static_cast<size_t>(sample_rate * seconds);
  audio.samples.resize(frames);
  for (size_t i = 0; i < frames; ++i) {
    audio.samples[i] = amplitude * std::sin(2.0f * kPi * frequency * i / sample_rate);
  }
  return audio;
}

std::string temp_path(const std::string& name) {
  return ::testing::TempDir() + "voice_cloning_" + name;
}

class AudioProcessorTest : public ::testing::Test {
 protected:
  void SetUp() override { ASSERT_TRUE(processor.initialize()); }
  AudioProcessor processor;
};

}  // namespace

TEST(AudioDataTest, ReportsFramesAndDuration) {
  AudioData audio(44100, 2);
  EXPECT_EQ(audio.num_frames(), 0u);
  EXPECT_DOUBLE_EQ(audio.duration(), 0.0);

  audio.samples = {0.1f, 0.2f, 0.3f, 0.4f, 0.5f, 0.6f};  // 3 stereo frames
  EXPECT_EQ(audio.size(), 6u);
  EXPECT_EQ(audio.num_frames(), 3u);
  EXPECT_DOUBLE_EQ(audio.duration(), 3.0 / 44100.0);
}

TEST(AudioFormatTest, DetectsFormatFromExtensionCaseInsensitively) {
  EXPECT_EQ(AudioProcessor::format_from_extension(".wav"), AudioFormat::WAV);
  EXPECT_EQ(AudioProcessor::format_from_extension(".WAV"), AudioFormat::WAV);
  EXPECT_EQ(AudioProcessor::format_from_extension(".flac"), AudioFormat::FLAC);
  EXPECT_EQ(AudioProcessor::format_from_extension(".ogg"), AudioFormat::OGG);
  EXPECT_EQ(AudioProcessor::format_from_extension(".mp3"), AudioFormat::MP3);
  EXPECT_EQ(AudioProcessor::format_from_extension(".txt"), AudioFormat::UNKNOWN);
}

TEST(AudioFormatTest, DetectsFormatFromFilePath) {
  EXPECT_EQ(AudioProcessor::format_from_filepath("/samples/voice.wav"), AudioFormat::WAV);
  EXPECT_EQ(AudioProcessor::format_from_filepath("voice.sample.flac"), AudioFormat::FLAC);
  EXPECT_EQ(AudioProcessor::format_from_filepath("no_extension"), AudioFormat::UNKNOWN);
}

TEST_F(AudioProcessorTest, WavRoundTripPreservesAudio) {
  const AudioData original = make_sine(22050, 0.25);
  const std::string path = temp_path("roundtrip.wav");

  ASSERT_TRUE(processor.save_audio(original, path, AudioFormat::WAV)) << processor.get_error();
  const auto loaded = processor.load_audio(path);
  std::remove(path.c_str());

  ASSERT_TRUE(loaded.success) << loaded.error_message;
  EXPECT_EQ(loaded.audio.sample_rate, 22050);
  EXPECT_EQ(loaded.audio.channels, 1);
  ASSERT_EQ(loaded.audio.samples.size(), original.samples.size());
  for (size_t i = 0; i < original.samples.size(); ++i) {
    // WAV stores 16-bit PCM, so allow for quantisation error.
    ASSERT_NEAR(loaded.audio.samples[i], original.samples[i], 1e-3f) << "sample " << i;
  }
}

TEST_F(AudioProcessorTest, MetadataMatchesSavedFile) {
  AudioData stereo(16000, 2);
  stereo.samples.assign(16000 * 2, 0.0f);  // 1 second of stereo silence
  const std::string path = temp_path("metadata.wav");

  ASSERT_TRUE(processor.save_audio(stereo, path, AudioFormat::WAV)) << processor.get_error();
  const auto metadata = processor.get_metadata(path);
  std::remove(path.c_str());

  EXPECT_EQ(metadata.sample_rate, 16000);
  EXPECT_EQ(metadata.channels, 2);
  EXPECT_EQ(metadata.frames, 16000);
  EXPECT_NEAR(metadata.duration, 1.0, 1e-6);
  EXPECT_EQ(metadata.format, AudioFormat::WAV);
}

TEST_F(AudioProcessorTest, MetadataDetectsFlac) {
  const AudioData original = make_sine(22050, 0.1);
  const std::string path = temp_path("metadata.flac");

  ASSERT_TRUE(processor.save_audio(original, path, AudioFormat::FLAC)) << processor.get_error();
  const auto metadata = processor.get_metadata(path);
  std::remove(path.c_str());

  EXPECT_EQ(metadata.format, AudioFormat::FLAC);
}

TEST_F(AudioProcessorTest, LoadingMissingFileFailsWithMessage) {
  const auto result = processor.load_audio(temp_path("does_not_exist.wav"));
  EXPECT_FALSE(result.success);
  EXPECT_FALSE(result.error_message.empty());
  EXPECT_FALSE(processor.get_error().empty());
}

TEST_F(AudioProcessorTest, ToMonoAveragesChannels) {
  AudioData stereo(44100, 2);
  stereo.samples = {0.1f, 0.2f, 0.3f, 0.4f, 0.5f, 0.6f};

  const AudioData mono = processor.to_mono(stereo);

  EXPECT_EQ(mono.channels, 1);
  EXPECT_EQ(mono.sample_rate, 44100);
  ASSERT_EQ(mono.num_frames(), 3u);
  EXPECT_FLOAT_EQ(mono.samples[0], 0.15f);
  EXPECT_FLOAT_EQ(mono.samples[1], 0.35f);
  EXPECT_FLOAT_EQ(mono.samples[2], 0.55f);
}

TEST_F(AudioProcessorTest, ToMonoLeavesMonoUnchanged) {
  const AudioData mono = make_sine(22050, 0.01);
  EXPECT_EQ(processor.to_mono(mono).samples, mono.samples);
}

TEST_F(AudioProcessorTest, NormalizeScalesPeakToThreshold) {
  AudioData audio(44100, 1);
  audio.samples = {0.1f, -0.25f, 0.5f};

  const AudioData normalized = processor.normalize(audio, 1.0f);

  ASSERT_EQ(normalized.samples.size(), 3u);
  EXPECT_FLOAT_EQ(normalized.samples[0], 0.2f);
  EXPECT_FLOAT_EQ(normalized.samples[1], -0.5f);
  EXPECT_FLOAT_EQ(normalized.samples[2], 1.0f);
}

TEST_F(AudioProcessorTest, ResampleChangesRateAndLength) {
  const AudioData audio = make_sine(44100, 1.0);

  const AudioData resampled = processor.resample(audio, 22050);

  EXPECT_EQ(resampled.sample_rate, 22050);
  EXPECT_EQ(resampled.channels, 1);
  EXPECT_NEAR(static_cast<double>(resampled.num_frames()), 22050.0, 2.0);
  EXPECT_NEAR(resampled.duration(), 1.0, 1e-3);
}

TEST_F(AudioProcessorTest, ResampleToSameRateIsNoOp) {
  const AudioData audio = make_sine(22050, 0.01);
  EXPECT_EQ(processor.resample(audio, 22050).samples, audio.samples);
}

TEST_F(AudioProcessorTest, ExtractSegmentReturnsRequestedWindow) {
  AudioData audio(10, 1);  // 10 Hz so sample indices are easy to read
  audio.samples = {0, 1, 2, 3, 4, 5, 6, 7, 8, 9};

  const AudioData segment = processor.extract_segment(audio, 0.2, 0.3);

  EXPECT_EQ(segment.samples, (std::vector<float>{2, 3, 4}));
}

TEST_F(AudioProcessorTest, ExtractSegmentPastEndIsEmpty) {
  AudioData audio(10, 1);
  audio.samples = {0, 1, 2};
  EXPECT_TRUE(processor.extract_segment(audio, 5.0, 1.0).samples.empty());
}
