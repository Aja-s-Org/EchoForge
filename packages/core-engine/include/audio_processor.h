#ifndef AUDIO_PROCESSOR_H
#define AUDIO_PROCESSOR_H

#include <vector>
#include <string>
#include <memory>
#include <sndfile.h>
#include <portaudio.h>

namespace audio {

/**
 * @brief Supported audio formats
 */
enum class AudioFormat {
  WAV,
  MP3,
  OGG,
  FLAC,
  UNKNOWN
};

/**
 * @brief Audio metadata
 */
struct AudioMetadata {
  int sample_rate;
  int channels;
  int frames;
  AudioFormat format;
  double duration;  // seconds
  
  AudioMetadata() : sample_rate(0), channels(0), frames(0), 
                   format(AudioFormat::UNKNOWN), duration(0.0) {}
};

/**
 * @brief Audio data container
 */
struct AudioData {
  std::vector<float> samples;
  int sample_rate;
  int channels;
  AudioFormat format;
  
  AudioData() : sample_rate(0), channels(0), format(AudioFormat::UNKNOWN) {}
  AudioData(int sr, int ch, AudioFormat fmt = AudioFormat::WAV) : 
    sample_rate(sr), channels(ch), format(fmt) {}
  
  size_t size() const { return samples.size(); }
  size_t num_frames() const { return samples.size() / channels; }
  double duration() const { 
    return sample_rate > 0 ? static_cast<double>(num_frames()) / sample_rate : 0.0; 
  }
};

/**
 * @brief Audio processing result
 */
struct AudioProcessingResult {
  AudioData audio;
  bool success;
  std::string error_message;
  
  AudioProcessingResult() : success(false) {}
};

/**
 * @brief Audio processing configuration
 */
struct AudioProcessingConfig {
  int target_sample_rate;
  int target_channels;
  float normalization_threshold;
  bool enable_noise_reduction;
  bool enable_compression;
  float compression_ratio;
  float enhancement_strength;
  
  AudioProcessingConfig() : 
    target_sample_rate(22050),
    target_channels(1),
    normalization_threshold(0.95f),
    enable_noise_reduction(false),
    enable_compression(false),
    compression_ratio(2.0f),
    enhancement_strength(0.5f) {}
};

/**
 * @brief Audio processor for handling audio file I/O and processing
 */
class AudioProcessor {
public:
  /**
   * @brief Constructor
   */
  AudioProcessor();
  
  /**
   * @brief Destructor
   */
  ~AudioProcessor();
  
  /**
   * @brief Initialize audio processor
   * @return true if initialization succeeded, false otherwise
   */
  bool initialize();
  
  /**
   * @brief Load audio from file
   * @param filepath Path to audio file
   * @return Audio processing result
   */
  AudioProcessingResult load_audio(const std::string& filepath);
  
  /**
   * @brief Load audio from memory buffer
   * @param data Audio data buffer
   * @param size Buffer size
   * @param format Audio format
   * @return Audio processing result
   */
  AudioProcessingResult load_audio_from_memory(const void* data, size_t size, AudioFormat format);
  
  /**
   * @brief Save audio to file
   * @param audio Audio data to save
   * @param filepath Output file path
   * @param format Output format
   * @return true if saved successfully, false otherwise
   */
  bool save_audio(const AudioData& audio, const std::string& filepath, AudioFormat format = AudioFormat::WAV);
  
  /**
   * @brief Convert audio to different format
   * @param audio Input audio data
   * @param target_format Target format
   * @return Converted audio data
   */
  AudioData convert_format(const AudioData& audio, AudioFormat target_format);
  
  /**
   * @brief Resample audio to target sample rate
   * @param audio Input audio data
   * @param target_sample_rate Target sample rate
   * @return Resampled audio data
   */
  AudioData resample(const AudioData& audio, int target_sample_rate);
  
  /**
   * @brief Convert audio to mono
   * @param audio Input audio data
   * @return Mono audio data
   */
  AudioData to_mono(const AudioData& audio);
  
  /**
   * @brief Normalize audio levels
   * @param audio Input audio data
   * @param threshold Maximum level (0.0 to 1.0)
   * @return Normalized audio data
   */
  AudioData normalize(const AudioData& audio, float threshold = 0.95f);
  
  /**
   * @brief Trim silence from audio
   * @param audio Input audio data
   * @param silence_threshold Threshold for silence detection
   * @param min_silence_duration Minimum silence duration to trim (seconds)
   * @return Trimmed audio data
   */
  AudioData trim_silence(const AudioData& audio, float silence_threshold = 0.01f, 
                         float min_silence_duration = 0.1f);
  
  /**
   * @brief Extract segment from audio
   * @param audio Input audio data
   * @param start_time Start time in seconds
   * @param duration Duration in seconds
   * @return Extracted audio segment
   */
  AudioData extract_segment(const AudioData& audio, double start_time, double duration);
  
  /**
   * @brief Apply audio enhancement
   * @param audio Input audio data
   * @param strength Enhancement strength (0.0 to 1.0)
   * @return Enhanced audio data
   */
  AudioData enhance(const AudioData& audio, float strength = 0.5f);
  
  /**
   * @brief Apply noise reduction
   * @param audio Input audio data
   * @return Noise-reduced audio data
   */
  AudioData reduce_noise(const AudioData& audio);
  
  /**
   * @brief Apply dynamic range compression
   * @param audio Input audio data
   * @param ratio Compression ratio
   * @param threshold Compression threshold
   * @return Compressed audio data
   */
  AudioData compress(const AudioData& audio, float ratio = 2.0f, float threshold = 0.5f);
  
  /**
   * @brief Get audio metadata
   * @param filepath Path to audio file
   * @return Audio metadata
   */
  AudioMetadata get_metadata(const std::string& filepath);
  
  /**
   * @brief Get audio metadata from memory
   * @param data Audio data buffer
   * @param size Buffer size
   * @param format Audio format
   * @return Audio metadata
   */
  AudioMetadata get_metadata_from_memory(const void* data, size_t size, AudioFormat format);
  
  /**
   * @brief Check if format is supported
   * @param format Audio format
   * @return true if supported, false otherwise
   */
  static bool is_format_supported(AudioFormat format);
  
  /**
   * @brief Get format from file extension
   * @param extension File extension (e.g., ".wav", ".mp3")
   * @return Audio format
   */
  static AudioFormat format_from_extension(const std::string& extension);
  
  /**
   * @brief Get format from file path
   * @param filepath File path
   * @return Audio format
   */
  static AudioFormat format_from_filepath(const std::string& filepath);
  
  /**
   * @brief Get error message
   * @return Last error message
   */
  std::string get_error() const;
  
  /**
   * @brief Get version information
   * @return Version string
   */
  static std::string get_version();
  
private:
  // Private implementation
  class Impl;
  std::unique_ptr<Impl> impl_;
  
  // Error handling
  mutable std::string last_error_;
  void set_error(const std::string& error) const;
  
  // Helper methods
  AudioData convert_to_mono_internal(const std::vector<float>& samples, int channels);
  std::vector<float> resample_internal(const std::vector<float>& samples, 
                                      int original_rate, int target_rate, int channels);
  std::vector<float> normalize_internal(const std::vector<float>& samples, float threshold);
  
  // libsndfile helpers
  SF_INFO create_sfinfo(const AudioData& audio, int format) const;
  AudioData load_with_libsndfile(const std::string& filepath);
  bool save_with_libsndfile(const AudioData& audio, const std::string& filepath, int format);
};

} // namespace audio

#endif // AUDIO_PROCESSOR_H