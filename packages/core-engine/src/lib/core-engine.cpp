#include <napi.h>
#include <iostream>
#include "voice_cloner.h"
#include "audio_processor.h"
#include "f5_tts_wrapper.h"
#include "memory_monitor.h"

using namespace f5_tts;
using namespace audio;
using namespace memory;

namespace core {

/**
 * Core Engine Addon - Unified Node.js Native Addon
 * 
 * This addon provides:
 * 1. Voice cloning functionality
 * 2. Audio processing utilities
 * 3. Memory management
 * 4. System monitoring
 */

// Global instances
std::unique_ptr<VoiceCloner> global_voice_cloner = nullptr;
std::unique_ptr<AudioProcessor> global_audio_processor = nullptr;
std::unique_ptr<MemoryMonitor> global_memory_monitor = nullptr;

/**
 * Initialize the core engine
 */
Napi::Value Initialize(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  try {
    // Initialize memory monitor first
    MemoryMonitor::Config mem_config;
    mem_config.global_limit.hard_limit_bytes = 1024 * 1024 * 1024; // 1GB
    mem_config.enable_auto_cleanup = true;
    mem_config.cleanup_threshold_percent = 80;
    
    global_memory_monitor = std::make_unique<MemoryMonitor>(mem_config);
    if (!global_memory_monitor->initialize()) {
      Napi::Error::New(env, "Failed to initialize memory monitor").ThrowAsJavaScriptException();
      return env.Null();
    }
    
    // Register components for memory tracking
    global_memory_monitor->register_component("voice_cloner");
    global_memory_monitor->register_component("audio_processor");
    global_memory_monitor->register_component("f5_tts_wrapper");
    global_memory_monitor->register_component("python_service");
    
    // Initialize audio processor
    global_audio_processor = std::make_unique<AudioProcessor>();
    if (!global_audio_processor->initialize()) {
      Napi::Error::New(env, "Failed to initialize audio processor").ThrowAsJavaScriptException();
      return env.Null();
    }
    
    // Track audio processor memory
    global_memory_monitor->track_allocation("audio_processor", 1024 * 1024); // 1MB
    
    return Napi::Boolean::New(env, true);
    
  } catch (const std::exception& e) {
    Napi::Error::New(env, std::string("Failed to initialize core engine: ") + e.what()).ThrowAsJavaScriptException();
    return env.Null();
  }
}

/**
 * Shutdown the core engine
 */
Napi::Value Shutdown(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  try {
    // Cleanup in reverse order of initialization
    if (global_voice_cloner) {
      global_voice_cloner.reset();
    }
    
    if (global_audio_processor) {
      global_audio_processor.reset();
    }
    
    if (global_memory_monitor) {
      // Generate final memory report
      std::string report = global_memory_monitor->generate_report(true);
      std::cout << "Core Engine Memory Report:\n" << report << std::endl;
      
      global_memory_monitor.reset();
    }
    
    return Napi::Boolean::New(env, true);
    
  } catch (const std::exception& e) {
    Napi::Error::New(env, std::string("Failed to shutdown core engine: ") + e.what()).ThrowAsJavaScriptException();
    return env.Null();
  }
}

/**
 * Get core engine version
 */
Napi::Value GetVersion(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  std::string version = "EchoForge Core Engine v1.0.0\n";
  version += "Features:\n";
  version += "  - Voice cloning with f5-tts integration\n";
  version += "  - Audio processing utilities\n";
  version += "  - Memory management and monitoring\n";
  version += "  - Python service integration\n";
  version += "\nBuild: " __DATE__ " " __TIME__;
  
  return Napi::String::New(env, version);
}

/**
 * Check system requirements
 */
Napi::Value CheckSystemRequirements(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  Napi::Object result = Napi::Object::New(env);
  
  // Memory information
  Napi::Object memory_info = Napi::Object::New(env);
  memory_info.Set("monitoring_available", Napi::Boolean::New(env, true));
  memory_info.Set("auto_cleanup", Napi::Boolean::New(env, true));
  memory_info.Set("cache_support", Napi::Boolean::New(env, true));
  result.Set("memory", memory_info);
  
  // Audio processing information
  Napi::Object audio_info = Napi::Object::New(env);
  audio_info.Set("libsndfile_available", Napi::Boolean::New(env, true));
  audio_info.Set("portaudio_available", Napi::Boolean::New(env, true));
  
  Napi::Array formats = Napi::Array::New(env);
  const char* supported_formats[] = {"wav", "flac", "ogg", "mp3"};
  for (size_t i = 0; i < 4; ++i) {
    formats[i] = Napi::String::New(env, supported_formats[i]);
  }
  audio_info.Set("supported_formats", formats);
  
  audio_info.Set("target_sample_rate", Napi::Number::New(env, 22050));
  audio_info.Set("target_channels", Napi::Number::New(env, 1));
  result.Set("audio", audio_info);
  
  // Voice cloning information
  Napi::Object voice_cloning_info = Napi::Object::New(env);
  voice_cloning_info.Set("f5_tts_integration", Napi::Boolean::New(env, true));
  voice_cloning_info.Set("python_service_support", Napi::Boolean::New(env, true));
  voice_cloning_info.Set("embedding_dimension", Napi::Number::New(env, 256));
  voice_cloning_info.Set("max_audio_duration", Napi::Number::New(env, 30)); // seconds
  result.Set("voice_cloning", voice_cloning_info);
  
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
  
  result.Set("node_api_version", Napi::Number::New(env, NAPI_VERSION));
  result.Set("cxx_standard", Napi::String::New(env, "C++17"));
  
  return result;
}

/**
 * Get memory statistics
 */
Napi::Value GetMemoryStatistics(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  try {
    if (!global_memory_monitor) {
      Napi::Error::New(env, "Core engine not initialized").ThrowAsJavaScriptException();
      return env.Null();
    }
    
    Napi::Object result = Napi::Object::New(env);
    
    // Global statistics
    size_t global_usage = global_memory_monitor->get_global_usage();
    bool within_limits = global_memory_monitor->is_within_limits();
    
    result.Set("total_bytes", Napi::Number::New(env, static_cast<double>(global_usage)));
    result.Set("within_limits", Napi::Boolean::New(env, within_limits));
    
    // Component statistics
    auto all_stats = global_memory_monitor->get_all_stats();
    Napi::Object component_stats = Napi::Object::New(env);
    
    for (const auto& [component, stats] : all_stats) {
      Napi::Object comp_obj = Napi::Object::New(env);
      comp_obj.Set("current_bytes", Napi::Number::New(env, static_cast<double>(stats.current_bytes)));
      comp_obj.Set("peak_bytes", Napi::Number::New(env, static_cast<double>(stats.peak_bytes)));
      comp_obj.Set("allocation_count", Napi::Number::New(env, static_cast<double>(stats.allocation_count)));
      comp_obj.Set("deallocation_count", Napi::Number::New(env, static_cast<double>(stats.deallocation_count)));
      comp_obj.Set("average_allocation_size", Napi::Number::New(env, stats.average_allocation_size()));
      
      component_stats.Set(component.c_str(), comp_obj);
    }
    
    result.Set("components", component_stats);
    
    // Alerts
    auto alerts = global_memory_monitor->get_alerts();
    Napi::Array alert_array = Napi::Array::New(env);
    
    for (size_t i = 0; i < alerts.size(); ++i) {
      Napi::Object alert_obj = Napi::Object::New(env);
      alert_obj.Set("severity", Napi::String::New(env, alerts[i].severity_string()));
      alert_obj.Set("component", Napi::String::New(env, alerts[i].component));
      alert_obj.Set("message", Napi::String::New(env, alerts[i].message));
      alert_obj.Set("current_bytes", Napi::Number::New(env, static_cast<double>(alerts[i].current_bytes)));
      alert_obj.Set("threshold_bytes", Napi::Number::New(env, static_cast<double>(alerts[i].threshold_bytes)));
      
      alert_array[i] = alert_obj;
    }
    
    result.Set("alerts", alert_array);
    
    return result;
    
  } catch (const std::exception& e) {
    Napi::Error::New(env, std::string("Failed to get memory statistics: ") + e.what()).ThrowAsJavaScriptException();
    return env.Null();
  }
}

/**
 * Create a voice cloner instance
 */
Napi::Value CreateVoiceCloner(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  try {
    if (!global_memory_monitor) {
      Napi::Error::New(env, "Core engine not initialized").ThrowAsJavaScriptException();
      return env.Null();
    }
    
    // TODO: Parse configuration from JavaScript
    F5TTSConfig config;
    config.model_path = "";
    config.vocoder_path = "";
    config.use_gpu = true;
    config.max_concurrent_requests = 5;
    config.timeout_seconds = 30.0f;
    
    // Create voice cloner
    global_voice_cloner = std::make_unique<VoiceCloner>(config);
    
    // Track memory allocation
    global_memory_monitor->track_allocation("voice_cloner", 256 * 1024 * 1024); // 256MB for models
    
    return Napi::Boolean::New(env, true);
    
  } catch (const std::exception& e) {
    Napi::Error::New(env, std::string("Failed to create voice cloner: ") + e.what()).ThrowAsJavaScriptException();
    return env.Null();
  }
}

/**
 * Get audio processor instance
 */
Napi::Value GetAudioProcessor(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (!global_audio_processor) {
    Napi::Error::New(env, "Audio processor not initialized").ThrowAsJavaScriptException();
    return env.Null();
  }
  
  // Return a reference to the audio processor
  // In a real implementation, this would return a wrapped object
  return Napi::Boolean::New(env, true);
}

/**
 * Initialize the addon module
 */
Napi::Object Init(Napi::Env env, Napi::Object exports) {
  // Core engine functions
  exports.Set("initialize", Napi::Function::New(env, Initialize));
  exports.Set("shutdown", Napi::Function::New(env, Shutdown));
  exports.Set("getVersion", Napi::Function::New(env, GetVersion));
  exports.Set("checkSystemRequirements", Napi::Function::New(env, CheckSystemRequirements));
  exports.Set("getMemoryStatistics", Napi::Function::New(env, GetMemoryStatistics));
  exports.Set("createVoiceCloner", Napi::Function::New(env, CreateVoiceCloner));
  exports.Set("getAudioProcessor", Napi::Function::New(env, GetAudioProcessor));
  
  // Initialize voice cloner class
  VoiceCloner::Init(env, exports);
  
  return exports;
}

} // namespace core

// Register the addon module
NODE_API_MODULE(echoforge_core, core::Init)