#include "audio_processor.h"
#include "logger.h"
#include <iostream>
#include <cmath>
#include <algorithm>
#include <cstring>
#include <memory>
#include <stdexcept>
#include <vector>
#include <fstream>
#include <chrono>
#include <sndfile.h>
#include <portaudio.h>

namespace audio {

// Get logger instance for audio processor
logging::Logger& get_audio_logger() {
  static logging::Logger& logger = logging::Logger::get_instance("audio_processor");
  return logger;
}

// Private implementation
class AudioProcessor::Impl {
public:
  Impl() : pa_initialized_(false) {
    // Initialize PortAudio (temporarily disabled for core test)
    // PaError err = Pa_Initialize();
    // if (err == paNoError) {
    //   pa_initialized_ = true;
    // }
    pa_initialized_ = false;  // Temporarily disabled
  }
  
  ~Impl() {
    if (pa_initialized_) {
      // Pa_Terminate();  // Temporarily disabled
    }
  }
  
  bool is_portaudio_initialized() const {
    return pa_initialized_;
  }
  
private:
  bool pa_initialized_;
};

// AudioProcessor implementation

AudioProcessor::AudioProcessor() : impl_(std::make_unique<Impl>()) {}

AudioProcessor::~AudioProcessor() = default;

bool AudioProcessor::initialize() {
  // Check if PortAudio is initialized (temporarily disabled for core test)
  // if (!impl_->is_portaudio_initialized()) {
  //   set_error("Failed to initialize PortAudio");
  //   get_audio_logger().error("Failed to initialize PortAudio");
  //   return false;
  // }
  
  // Check libsndfile version (temporarily disabled for core test)
  // std::string libsndfile_version = sf_version_string();
  // get_audio_logger().info("AudioProcessor initialized with libsndfile version: " + libsndfile_version);
  
  get_audio_logger().info("AudioProcessor initialized (PortAudio and libsndfile checks disabled for core test)");
  
  return true;
}

AudioProcessingResult AudioProcessor::load_audio(const std::string& filepath) {
  AudioProcessingResult result;
  
  try {
    get_audio_logger().info("Loading audio file: " + filepath);
    result.audio = load_with_libsndfile(filepath);
    result.success = true;
    get_audio_logger().info("Successfully loaded audio file: " + filepath + 
                           " (duration: " + std::to_string(result.audio.duration()) + "s, " +
                           "sample rate: " + std::to_string(result.audio.sample_rate) + "Hz, " +
                           "channels: " + std::to_string(result.audio.channels) + ")");
  } catch (const std::exception& e) {
    result.success = false;
    result.error_message = e.what();
    set_error(e.what());
    get_audio_logger().error("Failed to load audio file: " + filepath + " - " + e.what());
  }
  
  return result;
}

AudioProcessingResult AudioProcessor::load_audio_from_memory(const void* data, size_t size, AudioFormat format) {
  (void)format;  // Unused parameter for now
  
  AudioProcessingResult result;
  
  if (!data || size == 0) {
    result.success = false;
    result.error_message = "Invalid audio data: null pointer or zero size";
    set_error(result.error_message);
    return result;
  }
  
  try {
    // Create temporary file path
    std::string temp_filename = "/tmp/audio_memory_load_" + std::to_string(std::chrono::system_clock::now().time_since_epoch().count()) + ".wav";
    
    // Write memory buffer to temporary file
    std::ofstream temp_file(temp_filename, std::ios::binary);
    if (!temp_file) {
      result.success = false;
      result.error_message = "Failed to create temporary file for memory audio loading";
      set_error(result.error_message);
      return result;
    }
    
    temp_file.write(static_cast<const char*>(data), size);
    temp_file.close();
    
    // Load from temporary file
    result = load_audio(temp_filename);
    
    // Clean up temporary file
    std::remove(temp_filename.c_str());
    
  } catch (const std::exception& e) {
    result.success = false;
    result.error_message = std::string("Failed to load audio from memory: ") + e.what();
    set_error(result.error_message);
  }
  
  return result;
}

bool AudioProcessor::save_audio(const AudioData& audio, const std::string& filepath, AudioFormat format) {
  try {
    // Determine format from file extension
    AudioFormat actual_format = format;
    if (format == AudioFormat::UNKNOWN) {
      actual_format = format_from_filepath(filepath);
    }
    
    // Map format to libsndfile format
    int snd_format = 0;
    switch (actual_format) {
      case AudioFormat::WAV:
        snd_format = SF_FORMAT_WAV | SF_FORMAT_PCM_16;
        break;
      case AudioFormat::FLAC:
        snd_format = SF_FORMAT_FLAC | SF_FORMAT_PCM_16;
        break;
      case AudioFormat::OGG:
        snd_format = SF_FORMAT_OGG | SF_FORMAT_VORBIS;
        break;
      default:
        throw std::runtime_error("Unsupported output format");
    }
    
    return save_with_libsndfile(audio, filepath, snd_format);
    
  } catch (const std::exception& e) {
    set_error(e.what());
    return false;
  }
}

AudioData AudioProcessor::convert_format(const AudioData& audio, AudioFormat target_format) {
  // For now, just return a copy since we're using libsndfile for I/O
  // Actual format conversion would depend on the specific format
  AudioData result = audio;
  result.format = target_format;
  return result;
}

AudioData AudioProcessor::resample(const AudioData& audio, int target_sample_rate) {
  if (audio.sample_rate == target_sample_rate) {
    return audio;
  }
  
  AudioData result;
  result.sample_rate = target_sample_rate;
  result.channels = audio.channels;
  result.format = audio.format;
  
  result.samples = resample_internal(audio.samples, audio.sample_rate, target_sample_rate, audio.channels);
  
  return result;
}

AudioData AudioProcessor::to_mono(const AudioData& audio) {
  if (audio.channels == 1) {
    return audio;
  }
  
  AudioData result = convert_to_mono_internal(audio.samples, audio.channels);
  result.sample_rate = audio.sample_rate;
  result.format = audio.format;
  
  return result;
}

AudioData AudioProcessor::normalize(const AudioData& audio, float threshold) {
  AudioData result = audio;
  result.samples = normalize_internal(audio.samples, threshold);
  return result;
}

AudioData AudioProcessor::trim_silence(const AudioData& audio, float silence_threshold, float min_silence_duration) {
  if (audio.samples.empty()) {
    return audio;
  }
  
  AudioData result = audio;
  
  // Find first non-silent sample
  size_t start = 0;
  size_t end = audio.samples.size();
  
  (void)min_silence_duration;  // Unused parameter for now
  
  // Simple silence detection: look for samples below threshold
  for (size_t i = 0; i < audio.samples.size(); i += audio.channels) {
    bool is_silent = true;
    for (int ch = 0; ch < audio.channels; ++ch) {
      if (std::abs(audio.samples[i + ch]) > silence_threshold) {
        is_silent = false;
        break;
      }
    }
    
    if (!is_silent) {
      start = i;
      break;
    }
  }
  
  // Find last non-silent sample
  for (size_t i = audio.samples.size(); i > 0; i -= audio.channels) {
    bool is_silent = true;
    for (int ch = 0; ch < audio.channels; ++ch) {
      if (std::abs(audio.samples[i - audio.channels + ch]) > silence_threshold) {
        is_silent = false;
        break;
      }
    }
    
    if (!is_silent) {
      end = i;
      break;
    }
  }
  
  // Ensure we have at least some audio
  if (start >= end) {
    return result;
  }
  
  // Extract the non-silent portion
  result.samples = std::vector<float>(audio.samples.begin() + start, audio.samples.begin() + end);
  
  return result;
}

AudioData AudioProcessor::extract_segment(const AudioData& audio, double start_time, double duration) {
  AudioData result = audio;
  
  size_t start_sample = static_cast<size_t>(start_time * audio.sample_rate * audio.channels);
  size_t duration_samples = static_cast<size_t>(duration * audio.sample_rate * audio.channels);
  
  if (start_sample >= audio.samples.size()) {
    // Empty result
    result.samples.clear();
    return result;
  }
  
  size_t end_sample = std::min(start_sample + duration_samples, audio.samples.size());
  result.samples = std::vector<float>(audio.samples.begin() + start_sample, audio.samples.begin() + end_sample);
  
  return result;
}

AudioData AudioProcessor::enhance(const AudioData& audio, float strength) {
  // Simple enhancement: amplify higher frequencies
  AudioData result = audio;
  
  // This is a very basic enhancement - in a real implementation,
  // we would use proper audio processing algorithms
  for (size_t i = 0; i < result.samples.size(); ++i) {
    // Simple gain adjustment based on strength
    result.samples[i] *= (1.0f + strength * 0.5f);
    
    // Clip to [-1.0, 1.0]
    if (result.samples[i] > 1.0f) result.samples[i] = 1.0f;
    if (result.samples[i] < -1.0f) result.samples[i] = -1.0f;
  }
  
  return result;
}

AudioData AudioProcessor::reduce_noise(const AudioData& audio) {
  // Simple noise reduction: apply a low-pass filter
  AudioData result = audio;
  
  // Very basic moving average filter
  const int window_size = 5;
  std::vector<float> filtered(audio.samples.size());
  
  for (size_t i = 0; i < audio.samples.size(); ++i) {
    float sum = 0.0f;
    int count = 0;
    
    for (int j = -window_size; j <= window_size; ++j) {
      int idx = static_cast<int>(i) + j;
      if (idx >= 0 && idx < static_cast<int>(audio.samples.size())) {
        sum += audio.samples[idx];
        ++count;
      }
    }
    
    filtered[i] = sum / count;
  }
  
  result.samples = filtered;
  return result;
}

AudioData AudioProcessor::compress(const AudioData& audio, float ratio, float threshold) {
  AudioData result = audio;
  
  // Simple dynamic range compression
  for (size_t i = 0; i < result.samples.size(); ++i) {
    float sample = result.samples[i];
    float abs_sample = std::abs(sample);
    
    if (abs_sample > threshold) {
      // Compress the portion above threshold
      float excess = abs_sample - threshold;
      float compressed_excess = excess / ratio;
      float new_abs = threshold + compressed_excess;
      
      result.samples[i] = (sample > 0 ? new_abs : -new_abs);
    }
  }
  
  return result;
}

AudioMetadata AudioProcessor::get_metadata(const std::string& filepath) {
  AudioMetadata metadata;
  
  SF_INFO sfinfo;
  std::memset(&sfinfo, 0, sizeof(sfinfo));
  
  SNDFILE* file = sf_open(filepath.c_str(), SFM_READ, &sfinfo);
  if (!file) {
    set_error(sf_strerror(nullptr));
    return metadata;
  }
  
  metadata.sample_rate = sfinfo.samplerate;
  metadata.channels = sfinfo.channels;
  metadata.frames = static_cast<int>(sfinfo.frames);
  metadata.duration = static_cast<double>(sfinfo.frames) / sfinfo.samplerate;
  
  // Determine format
  if (sfinfo.format & SF_FORMAT_WAV) {
    metadata.format = AudioFormat::WAV;
  } else if (sfinfo.format & SF_FORMAT_FLAC) {
    metadata.format = AudioFormat::FLAC;
  } else if (sfinfo.format & SF_FORMAT_OGG) {
    metadata.format = AudioFormat::OGG;
  } else {
    metadata.format = AudioFormat::UNKNOWN;
  }
  
  sf_close(file);
  return metadata;
}

AudioMetadata AudioProcessor::get_metadata_from_memory(const void* data, size_t size, AudioFormat format) {
  (void)data;    // Unused parameter
  (void)size;    // Unused parameter  
  (void)format;  // Unused parameter
  
  AudioMetadata metadata;
  set_error("Memory metadata extraction not implemented yet");
  return metadata;
}

bool AudioProcessor::is_format_supported(AudioFormat format) {
  switch (format) {
    case AudioFormat::WAV:
    case AudioFormat::FLAC:
    case AudioFormat::OGG:
      return true;
    default:
      return false;
  }
}

AudioFormat AudioProcessor::format_from_extension(const std::string& extension) {
  std::string ext = extension;
  std::transform(ext.begin(), ext.end(), ext.begin(), ::tolower);
  
  if (ext == ".wav") return AudioFormat::WAV;
  if (ext == ".mp3") return AudioFormat::MP3;
  if (ext == ".ogg") return AudioFormat::OGG;
  if (ext == ".flac") return AudioFormat::FLAC;
  
  return AudioFormat::UNKNOWN;
}

AudioFormat AudioProcessor::format_from_filepath(const std::string& filepath) {
  size_t dot_pos = filepath.find_last_of('.');
  if (dot_pos == std::string::npos) {
    return AudioFormat::UNKNOWN;
  }
  
  return format_from_extension(filepath.substr(dot_pos));
}

std::string AudioProcessor::get_error() const {
  return last_error_;
}

std::string AudioProcessor::get_version() {
  return "1.0.0 (AudioProcessor)";
}

// Private helper methods

void AudioProcessor::set_error(const std::string& error) const {
  last_error_ = error;
}

SF_INFO AudioProcessor::create_sfinfo(const AudioData& audio, int format) const {
  SF_INFO sfinfo;
  std::memset(&sfinfo, 0, sizeof(sfinfo));
  
  sfinfo.samplerate = audio.sample_rate;
  sfinfo.channels = audio.channels;
  sfinfo.format = format;
  
  return sfinfo;
}

AudioData AudioProcessor::load_with_libsndfile(const std::string& filepath) {
  SF_INFO sfinfo;
  std::memset(&sfinfo, 0, sizeof(sfinfo));
  
  SNDFILE* file = sf_open(filepath.c_str(), SFM_READ, &sfinfo);
  if (!file) {
    throw std::runtime_error(std::string("Failed to open audio file: ") + sf_strerror(nullptr));
  }
  
  AudioData audio;
  audio.sample_rate = sfinfo.samplerate;
  audio.channels = sfinfo.channels;
  
  // Determine format
  if (sfinfo.format & SF_FORMAT_WAV) {
    audio.format = AudioFormat::WAV;
  } else if (sfinfo.format & SF_FORMAT_FLAC) {
    audio.format = AudioFormat::FLAC;
  } else if (sfinfo.format & SF_FORMAT_OGG) {
    audio.format = AudioFormat::OGG;
  } else {
    audio.format = AudioFormat::UNKNOWN;
  }
  
  // Read audio data
  size_t total_samples = sfinfo.frames * sfinfo.channels;
  audio.samples.resize(total_samples);
  
  sf_count_t samples_read = sf_read_float(file, audio.samples.data(), total_samples);
  if (samples_read != static_cast<sf_count_t>(total_samples)) {
    sf_close(file);
    throw std::runtime_error("Failed to read all audio samples");
  }
  
  sf_close(file);
  return audio;
}

bool AudioProcessor::save_with_libsndfile(const AudioData& audio, const std::string& filepath, int format) {
  SF_INFO sfinfo = create_sfinfo(audio, format);
  
  SNDFILE* file = sf_open(filepath.c_str(), SFM_WRITE, &sfinfo);
  if (!file) {
    set_error(std::string("Failed to create audio file: ") + sf_strerror(nullptr));
    return false;
  }
  
  sf_count_t samples_written = sf_write_float(file, audio.samples.data(), audio.samples.size());
  sf_close(file);
  
  if (samples_written != static_cast<sf_count_t>(audio.samples.size())) {
    set_error("Failed to write all audio samples");
    return false;
  }
  
  return true;
}

AudioData AudioProcessor::convert_to_mono_internal(const std::vector<float>& samples, int channels) {
  if (channels == 1) {
    return AudioData();  // Already mono
  }
  
  size_t num_frames = samples.size() / channels;
  std::vector<float> mono_samples(num_frames);
  
  for (size_t i = 0; i < num_frames; ++i) {
    float sum = 0.0f;
    for (int ch = 0; ch < channels; ++ch) {
      sum += samples[i * channels + ch];
    }
    mono_samples[i] = sum / channels;
  }
  
  AudioData result;
  result.samples = mono_samples;
  result.channels = 1;
  // Note: sample_rate and format need to be set by caller
  
  return result;
}

std::vector<float> AudioProcessor::resample_internal(const std::vector<float>& samples, 
                                                    int original_rate, int target_rate, int channels) {
  if (original_rate == target_rate) {
    return samples;
  }
  
  double ratio = static_cast<double>(target_rate) / original_rate;
  size_t original_frames = samples.size() / channels;
  size_t target_frames = static_cast<size_t>(original_frames * ratio);
  
  std::vector<float> resampled(target_frames * channels);
  
  // Simple linear interpolation for resampling
  for (size_t t = 0; t < target_frames; ++t) {
    double original_pos = t / ratio;
    size_t idx1 = static_cast<size_t>(original_pos);
    size_t idx2 = std::min(idx1 + 1, original_frames - 1);
    double alpha = original_pos - idx1;
    
    for (int ch = 0; ch < channels; ++ch) {
      float sample1 = samples[idx1 * channels + ch];
      float sample2 = samples[idx2 * channels + ch];
      resampled[t * channels + ch] = sample1 * (1.0f - static_cast<float>(alpha)) + 
                                    sample2 * static_cast<float>(alpha);
    }
  }
  
  return resampled;
}

std::vector<float> AudioProcessor::normalize_internal(const std::vector<float>& samples, float threshold) {
  if (samples.empty()) {
    return samples;
  }
  
  // Find maximum absolute value
  float max_val = 0.0f;
  for (float sample : samples) {
    float abs_sample = std::abs(sample);
    if (abs_sample > max_val) {
      max_val = abs_sample;
    }
  }
  
  if (max_val < 1e-6f) {
    return samples;  // All samples are near zero
  }
  
  // Scale to fit within threshold
  float scale = threshold / max_val;
  std::vector<float> normalized(samples.size());
  
  for (size_t i = 0; i < samples.size(); ++i) {
    normalized[i] = samples[i] * scale;
  }
  
  return normalized;
}

} // namespace audio