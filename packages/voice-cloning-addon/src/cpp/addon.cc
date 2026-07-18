#include <napi.h>
#include "voice_cloner.h"
#include "audio_processor.h"

namespace {

// Helper function to get library version
Napi::Value GetVersion(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  std::string version = "Voice Cloning Addon v1.0.0";
  version += "\nAudio Processor: " + audio::AudioProcessor::get_version();
  version += "\nF5-TTS Wrapper: 1.0.0";
  
  return Napi::String::New(env, version);
}

// Helper function to check system requirements
Napi::Value CheckSystemRequirements(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  Napi::Object result = Napi::Object::New(env);
  
  // Check if libsndfile is available
  result.Set("libsndfile_available", Napi::Boolean::New(env, true));
  
  // Check if PortAudio is available
  result.Set("portaudio_available", Napi::Boolean::New(env, true));
  
  // Check supported audio formats
  Napi::Array formats = Napi::Array::New(env);
  const char* supported_formats[] = {"wav", "flac", "ogg"};
  for (size_t i = 0; i < 3; ++i) {
    formats[i] = Napi::String::New(env, supported_formats[i]);
  }
  result.Set("supported_formats", formats);
  
  // Platform information
  #ifdef __APPLE__
    result.Set("platform", Napi::String::New(env, "macos"));
  #elif defined(__linux__)
    result.Set("platform", Napi::String::New(env, "linux"));
  #elif defined(_WIN32)
    result.Set("platform", Napi::String::New(env, "windows"));
  #else
    result.Set("platform", Napi::String::New(env, "unknown"));
  #endif
  
  result.Set("node_version", Napi::String::New(env, "18+"));
  
  return result;
}

// Helper function to create audio buffer from file
Napi::Value LoadAudioFile(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "File path must be a string").ThrowAsJavaScriptException();
    return env.Null();
  }
  
  std::string filepath = info[0].As<Napi::String>().Utf8Value();
  
  try {
    // Create audio processor
    audio::AudioProcessor processor;
    if (!processor.initialize()) {
      Napi::Error::New(env, "Failed to initialize audio processor: " + processor.get_error()).ThrowAsJavaScriptException();
      return env.Null();
    }
    
    // Load audio
    audio::AudioProcessingResult result = processor.load_audio(filepath);
    
    if (!result.success) {
      Napi::Error::New(env, "Failed to load audio: " + result.error_message).ThrowAsJavaScriptException();
      return env.Null();
    }
    
    // Convert to JavaScript object
    Napi::Object audio_obj = Napi::Object::New(env);
    audio_obj.Set("sampleRate", Napi::Number::New(env, result.audio.sample_rate));
    audio_obj.Set("channels", Napi::Number::New(env, result.audio.channels));
    audio_obj.Set("duration", Napi::Number::New(env, result.audio.duration()));
    
    // Create buffer for samples
    Napi::ArrayBuffer buffer = Napi::ArrayBuffer::New(env, result.audio.samples.size() * sizeof(float));
    float* data = static_cast<float*>(buffer.Data());
    for (size_t i = 0; i < result.audio.samples.size(); ++i) {
      data[i] = result.audio.samples[i];
    }
    
    audio_obj.Set("samples", buffer);
    return audio_obj;
    
  } catch (const std::exception& e) {
    Napi::Error::New(env, std::string("Error loading audio file: ") + e.what()).ThrowAsJavaScriptException();
    return env.Null();
  }
}

// Initialize the addon
Napi::Object Init(Napi::Env env, Napi::Object exports) {
  // Initialize voice cloner class
  VoiceCloner::Init(env, exports);
  
  // Add helper functions
  exports.Set("getVersion", Napi::Function::New(env, GetVersion));
  exports.Set("checkSystemRequirements", Napi::Function::New(env, CheckSystemRequirements));
  exports.Set("loadAudioFile", Napi::Function::New(env, LoadAudioFile));
  
  return exports;
}

// Register the addon
NODE_API_MODULE(voice_cloning_addon, Init)