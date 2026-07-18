#ifndef F5_TTS_WRAPPER_H
#define F5_TTS_WRAPPER_H

#include <string>
#include <vector>
#include <memory>
#include "audio_processor.h"
#include "config_manager.h"
#include "logger.h"

namespace f5_tts {

// Forward declarations
class F5TTSImpl;

/**
 * @brief Audio data container
 */
struct AudioData {
  std::vector<float> samples;
  int sample_rate;
  int channels;
  
  AudioData() : sample_rate(0), channels(0) {}
  AudioData(int sr, int ch) : sample_rate(sr), channels(ch) {}
};

/**
 * @brief Voice embedding container
 */
struct VoiceEmbedding {
  std::vector<float> embedding;
  int dimension;
  
  VoiceEmbedding() : dimension(256) {}  // Default to 256-dim as per requirements
  explicit VoiceEmbedding(int dim) : dimension(dim) {}
};

/**
 * @brief Configuration for F5-TTS
 */
struct F5TTSConfig {
  std::string model_path;
  std::string checkpoint_path;
  std::string vocoder_path;
  std::string python_service_path;  // Path to Python service script
  bool use_gpu;
  int max_concurrent_requests;
  float timeout_seconds;
  
  F5TTSConfig() : 
    use_gpu(true),
    max_concurrent_requests(5),
    timeout_seconds(30.0f) {}
};

/**
 * @brief Result of voice cloning operation
 */
struct VoiceCloningResult {
  AudioData audio;
  VoiceEmbedding embedding;
  float similarity_score;
  float processing_time_ms;
  std::string error_message;
  bool success;
  
  VoiceCloningResult() : 
    similarity_score(0.0f),
    processing_time_ms(0.0f),
    success(false) {}
};

/**
 * @brief Input for voice cloning
 */
struct VoiceCloningInput {
  AudioData voice_sample;
  std::string text;
  std::string language;
  float speed;
  
  VoiceCloningInput() : 
    language("en"),
    speed(1.0f) {}
};

/**
 * @brief Wrapper for F5-TTS library
 * 
 * This class provides a C++ interface to the F5-TTS voice cloning library.
 * It handles model loading, inference, and resource management.
 */
class F5TTSWrapper {
public:
  /**
   * @brief Constructor
   * @param config Configuration for the F5-TTS instance
   */
  explicit F5TTSWrapper(const F5TTSConfig& config);
  
  /**
   * @brief Destructor
   */
  ~F5TTSWrapper();
  
  /**
   * @brief Initialize the F5-TTS library
   * @return true if initialization succeeded, false otherwise
   */
  bool initialize();
  
  /**
   * @brief Check if the library is initialized
   * @return true if initialized, false otherwise
   */
  bool is_initialized() const;
  
  /**
   * @brief Extract voice embedding from audio sample
   * @param audio Input audio data
   * @return Voice embedding
   */
  VoiceEmbedding extract_voice_embedding(const AudioData& audio);
  
  /**
   * @brief Generate speech with cloned voice
   * @param embedding Voice embedding to clone
   * @param text Text to synthesize
   * @param language Language of the text
   * @param speed Speaking speed (default: 1.0)
   * @return Generated audio data
   */
  AudioData synthesize_speech(const VoiceEmbedding& embedding, 
                             const std::string& text,
                             const std::string& language = "en",
                             float speed = 1.0f);
  
  /**
   * @brief Perform voice cloning in one step
   * @param input Voice cloning input
   * @return Voice cloning result
   */
  VoiceCloningResult clone_voice(const VoiceCloningInput& input);
  
  /**
   * @brief Load model from disk
   * @param model_path Path to model file
   * @return true if loaded successfully, false otherwise
   */
  bool load_model(const std::string& model_path);
  
  /**
   * @brief Load vocoder from disk
   * @param vocoder_path Path to vocoder file
   * @return true if loaded successfully, false otherwise
   */
  bool load_vocoder(const std::string& vocoder_path);
  
  /**
   * @brief Get current configuration
   * @return Current configuration
   */
  F5TTSConfig get_config() const;
  
  /**
   * @brief Update configuration
   * @param config New configuration
   * @return true if configuration updated successfully, false otherwise
   */
  bool update_config(const F5TTSConfig& config);
  
  /**
   * @brief Get library version
   * @return Version string
   */
  static std::string get_version();
  
  /**
   * @brief Check if GPU is available
   * @return true if GPU is available, false otherwise
   */
  static bool is_gpu_available();
  
  /**
   * @brief Get memory usage in bytes
   * @return Current memory usage
   */
  size_t get_memory_usage() const;
  
  /**
   * @brief Clear cached data
   */
  void clear_cache();
  
private:
  std::unique_ptr<F5TTSImpl> impl_;
  F5TTSConfig config_;
};

} // namespace f5_tts

#endif // F5_TTS_WRAPPER_H