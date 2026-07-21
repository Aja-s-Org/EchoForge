#include <napi.h>
#include <iostream>
#include <memory>
#include <string>
#include <thread>
#include <chrono>
#include "voice_cloner.h"
#include "f5_tts_wrapper.h"
#include "audio_processor.h"

using namespace f5_tts;

// AsyncWorker implementation for long-running voice cloning operations
class VoiceCloner::AsyncWorker : public Napi::AsyncWorker {
public:
  AsyncWorker(Napi::Function& callback, VoiceCloner* cloner, 
              f5_tts::VoiceCloningInput input)
    : Napi::AsyncWorker(callback), cloner_(cloner), input_(std::move(input)) {}
  
  ~AsyncWorker() = default;
  
  void Execute() override {
    try {
      // Perform the voice cloning operation
      result_ = cloner_->f5_tts_->clone_voice(input_);
    } catch (const std::exception& e) {
      SetError("Voice cloning failed: " + std::string(e.what()));
    }
  }
  
  void OnOK() override {
    Napi::HandleScope scope(Env());
    
    try {
      // Convert result to JavaScript object
      Napi::Object result_obj = cloner_->ConvertToJSObject(Env(), result_);
      
      // Call the callback with null error and result
      Callback().Call({Env().Null(), result_obj});
    } catch (const std::exception& e) {
      // If conversion fails, call with error
      Callback().Call({Napi::Error::New(Env(), e.what()).Value(), Env().Null()});
    }
  }
  
  void OnError(const Napi::Error& e) override {
    Napi::HandleScope scope(Env());
    Callback().Call({e.Value(), Env().Null()});
  }
  
private:
  VoiceCloner* cloner_;
  f5_tts::VoiceCloningInput input_;
  f5_tts::VoiceCloningResult result_;
};

// VoiceCloner constructor
VoiceCloner::VoiceCloner(const Napi::CallbackInfo& info) : ObjectWrap(info) {
  Napi::Env env = info.Env();
  
  // Initialize default configuration
  config_.model_path = "";
  config_.checkpoint_path = "";
  config_.vocoder_path = "";
  config_.use_gpu = true;
  config_.max_concurrent_requests = 5;
  config_.timeout_seconds = 30.0f;
  
  // Create F5-TTS wrapper
  f5_tts_ = std::make_unique<F5TTSWrapper>(config_);
  initialized_ = false;
  
  std::cout << "VoiceCloner created" << std::endl;
}

VoiceCloner::~VoiceCloner() {
  std::cout << "VoiceCloner destroyed" << std::endl;
}

// Initialize the class
Napi::Function VoiceCloner::GetClass(Napi::Env env) {
  return DefineClass(env, "VoiceCloner", {
    InstanceMethod("initialize", &VoiceCloner::Initialize),
    InstanceMethod("isInitialized", &VoiceCloner::IsInitialized),
    InstanceMethod("loadModel", &VoiceCloner::LoadModel),
    InstanceMethod("loadVocoder", &VoiceCloner::LoadVocoder),
    InstanceMethod("extractVoiceEmbedding", &VoiceCloner::ExtractVoiceEmbedding),
    InstanceMethod("synthesizeSpeech", &VoiceCloner::SynthesizeSpeech),
    InstanceMethod("cloneVoice", &VoiceCloner::CloneVoice),
    InstanceMethod("cloneVoiceAsync", &VoiceCloner::CloneVoiceAsync),
    InstanceMethod("getMemoryUsage", &VoiceCloner::GetMemoryUsage),
    InstanceMethod("clearCache", &VoiceCloner::ClearCache),
    InstanceMethod("getVersion", &VoiceCloner::GetVersion),
  });
}

void VoiceCloner::Init(Napi::Env env, Napi::Object exports) {
  Napi::Function func = GetClass(env);
  Napi::FunctionReference* constructor = new Napi::FunctionReference();
  *constructor = Napi::Persistent(func);
  env.SetInstanceData(constructor);
  
  exports.Set("VoiceCloner", func);
}

// Public method implementations

Napi::Value VoiceCloner::Initialize(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  try {
    if (initialized_) {
      return Napi::Boolean::New(env, true);
    }
    
    bool success = f5_tts_->initialize();
    initialized_ = success;
    
    return Napi::Boolean::New(env, success);
    
  } catch (const std::exception& e) {
    ThrowError(env, std::string("Failed to initialize: ") + e.what());
    return env.Null();
  }
}

Napi::Value VoiceCloner::IsInitialized(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  return Napi::Boolean::New(env, initialized_);
}

Napi::Value VoiceCloner::LoadModel(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 1 || !info[0].IsString()) {
    ThrowError(env, "Model path must be a string");
    return env.Null();
  }
  
  std::string model_path = info[0].As<Napi::String>().Utf8Value();
  
  try {
    bool success = f5_tts_->load_model(model_path);
    config_.model_path = model_path;
    
    return Napi::Boolean::New(env, success);
    
  } catch (const std::exception& e) {
    ThrowError(env, std::string("Failed to load model: ") + e.what());
    return env.Null();
  }
}

Napi::Value VoiceCloner::LoadVocoder(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 1 || !info[0].IsString()) {
    ThrowError(env, "Vocoder path must be a string");
    return env.Null();
  }
  
  std::string vocoder_path = info[0].As<Napi::String>().Utf8Value();
  
  try {
    bool success = f5_tts_->load_vocoder(vocoder_path);
    config_.vocoder_path = vocoder_path;
    
    return Napi::Boolean::New(env, success);
    
  } catch (const std::exception& e) {
    ThrowError(env, std::string("Failed to load vocoder: ") + e.what());
    return env.Null();
  }
}

Napi::Value VoiceCloner::ExtractVoiceEmbedding(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (!initialized_) {
    ThrowError(env, "VoiceCloner not initialized. Call initialize() first.");
    return env.Null();
  }
  
  if (info.Length() < 1) {
    ThrowError(env, "Expected audio buffer, sample rate, and channels");
    return env.Null();
  }
  
  try {
    f5_tts::AudioData audio;
    
    if (info[0].IsBuffer()) {
      // Parse audio buffer
      Napi::Buffer<float> buffer = info[0].As<Napi::Buffer<float>>();
      
      if (info.Length() < 3 || !info[1].IsNumber() || !info[2].IsNumber()) {
        ThrowError(env, "Expected sample rate and channels after audio buffer");
        return env.Null();
      }
      
      int sample_rate = info[1].As<Napi::Number>().Int32Value();
      int channels = info[2].As<Napi::Number>().Int32Value();
      
      audio = ConvertToAudioData(buffer, sample_rate, channels);
    } 
    else if (info[0].IsString()) {
      // Load from file path using audio processor
      std::string filepath = info[0].As<Napi::String>().Utf8Value();
      
      try {
        audio::AudioProcessor processor;
        if (!processor.initialize()) {
          ThrowError(env, "Failed to initialize audio processor");
          return env.Null();
        }
        
        audio::AudioProcessingResult result = processor.load_audio(filepath);
        if (!result.success) {
          ThrowError(env, "Failed to load audio file: " + result.error_message);
          return env.Null();
        }
        
        // Convert to f5_tts::AudioData
        audio.sample_rate = result.audio.sample_rate;
        audio.channels = result.audio.channels;
        audio.samples = result.audio.samples;
        
      } catch (const std::exception& e) {
        ThrowError(env, std::string("Failed to load audio file: ") + e.what());
        return env.Null();
      }
    }
    else if (info[0].IsObject()) {
      // Audio data object with samples, sampleRate, channels
      Napi::Object audio_obj = info[0].As<Napi::Object>();
      
      if (!audio_obj.Has("samples") || !audio_obj.Has("sampleRate") || !audio_obj.Has("channels")) {
        ThrowError(env, "Audio object must have samples, sampleRate, and channels properties");
        return env.Null();
      }
      
      Napi::Buffer<float> buffer = audio_obj.Get("samples").As<Napi::Buffer<float>>();
      int sample_rate = audio_obj.Get("sampleRate").As<Napi::Number>().Int32Value();
      int channels = audio_obj.Get("channels").As<Napi::Number>().Int32Value();
      
      audio = ConvertToAudioData(buffer, sample_rate, channels);
    }
    else {
      ThrowError(env, "Expected audio buffer, file path string, or audio object");
      return env.Null();
    }
    
    VoiceEmbedding embedding = f5_tts_->extract_voice_embedding(audio);
    return ConvertToJSObject(env, embedding);
    
  } catch (const std::exception& e) {
    ThrowError(env, std::string("Failed to extract voice embedding: ") + e.what());
    return env.Null();
  }
}

Napi::Value VoiceCloner::SynthesizeSpeech(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (!initialized_) {
    ThrowError(env, "VoiceCloner not initialized. Call initialize() first.");
    return env.Null();
  }
  
  if (info.Length() < 2) {
    ThrowError(env, "Expected embedding and text string");
    return env.Null();
  }
  
  try {
    VoiceEmbedding embedding;
    
    if (info[0].IsObject()) {
      Napi::Object embedding_obj = info[0].As<Napi::Object>();
      
      if (!embedding_obj.Has("embedding") || !embedding_obj.Has("dimension")) {
        ThrowError(env, "Embedding object must have embedding array and dimension property");
        return env.Null();
      }
      
      Napi::Array embedding_array = embedding_obj.Get("embedding").As<Napi::Array>();
      int dimension = embedding_obj.Get("dimension").As<Napi::Number>().Int32Value();
      
      embedding.dimension = dimension;
      embedding.embedding.resize(dimension);
      
      for (int i = 0; i < dimension; ++i) {
        Napi::Value val = embedding_array[i];
        if (val.IsNumber()) {
          embedding.embedding[i] = val.As<Napi::Number>().FloatValue();
        } else {
          embedding.embedding[i] = 0.0f;
        }
      }
    } 
    else if (info[0].IsArray()) {
      Napi::Array embedding_array = info[0].As<Napi::Array>();
      int dimension = embedding_array.Length();
      
      embedding.dimension = dimension;
      embedding.embedding.resize(dimension);
      
      for (int i = 0; i < dimension; ++i) {
        Napi::Value val = embedding_array[i];
        if (val.IsNumber()) {
          embedding.embedding[i] = val.As<Napi::Number>().FloatValue();
        } else {
          embedding.embedding[i] = 0.0f;
        }
      }
    }
    else {
      ThrowError(env, "Expected embedding object or array");
      return env.Null();
    }
    
    if (!info[1].IsString()) {
      ThrowError(env, "Text must be a string");
      return env.Null();
    }
    
    std::string text = info[1].As<Napi::String>().Utf8Value();
    std::string language = "en";
    float speed = 1.0f;
    
    if (info.Length() > 2 && info[2].IsString()) {
      language = info[2].As<Napi::String>().Utf8Value();
    }
    
    if (info.Length() > 3 && info[3].IsNumber()) {
      speed = info[3].As<Napi::Number>().FloatValue();
    }
    
    AudioData audio = f5_tts_->synthesize_speech(embedding, text, language, speed);
    return ConvertToJSObject(env, audio);
    
  } catch (const std::exception& e) {
    ThrowError(env, std::string("Failed to synthesize speech: ") + e.what());
    return env.Null();
  }
}

Napi::Value VoiceCloner::CloneVoice(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (!initialized_) {
    ThrowError(env, "VoiceCloner not initialized. Call initialize() first.");
    return env.Null();
  }
  
  if (info.Length() < 2) {
    ThrowError(env, "Expected audio input and text");
    return env.Null();
  }
  
  try {
    f5_tts::VoiceCloningInput input;
    
    // Parse audio input
    if (info[0].IsBuffer()) {
      // Audio buffer with sample rate and channels
      if (info.Length() < 4 || !info[1].IsNumber() || !info[2].IsNumber() || !info[3].IsString()) {
        ThrowError(env, "Expected audio buffer, sample rate, channels, and text");
        return env.Null();
      }
      
      Napi::Buffer<float> buffer = info[0].As<Napi::Buffer<float>>();
      int sample_rate = info[1].As<Napi::Number>().Int32Value();
      int channels = info[2].As<Napi::Number>().Int32Value();
      
      input.voice_sample = ConvertToAudioData(buffer, sample_rate, channels);
      input.text = info[3].As<Napi::String>().Utf8Value();
      
      // Optional parameters
      if (info.Length() > 4 && info[4].IsString()) {
        input.language = info[4].As<Napi::String>().Utf8Value();
      }
      
      if (info.Length() > 5 && info[5].IsNumber()) {
        input.speed = info[5].As<Napi::Number>().FloatValue();
      }
    }
    else if (info[0].IsString()) {
      // File path with text
      if (!info[1].IsString()) {
        ThrowError(env, "Expected text string after file path");
        return env.Null();
      }
      
      std::string filepath = info[0].As<Napi::String>().Utf8Value();
      input.text = info[1].As<Napi::String>().Utf8Value();
      
      // Load audio from file using audio processor
      try {
        audio::AudioProcessor processor;
        if (!processor.initialize()) {
          ThrowError(env, "Failed to initialize audio processor");
          return env.Null();
        }
        
        audio::AudioProcessingResult result = processor.load_audio(filepath);
        if (!result.success) {
          ThrowError(env, "Failed to load audio file: " + result.error_message);
          return env.Null();
        }
        
        input.voice_sample.sample_rate = result.audio.sample_rate;
        input.voice_sample.channels = result.audio.channels;
        input.voice_sample.samples = result.audio.samples;
        
      } catch (const std::exception& e) {
        ThrowError(env, std::string("Failed to load audio file: ") + e.what());
        return env.Null();
      }
      
      // Optional parameters
      if (info.Length() > 2 && info[2].IsString()) {
        input.language = info[2].As<Napi::String>().Utf8Value();
      }
      
      if (info.Length() > 3 && info[3].IsNumber()) {
        input.speed = info[3].As<Napi::Number>().FloatValue();
      }
    }
    else if (info[0].IsObject()) {
      // Audio object with text
      if (!info[1].IsString()) {
        ThrowError(env, "Expected text string after audio object");
        return env.Null();
      }
      
      Napi::Object audio_obj = info[0].As<Napi::Object>();
      
      if (!audio_obj.Has("samples") || !audio_obj.Has("sampleRate") || !audio_obj.Has("channels")) {
        ThrowError(env, "Audio object must have samples, sampleRate, and channels properties");
        return env.Null();
      }
      
      Napi::Buffer<float> buffer = audio_obj.Get("samples").As<Napi::Buffer<float>>();
      int sample_rate = audio_obj.Get("sampleRate").As<Napi::Number>().Int32Value();
      int channels = audio_obj.Get("channels").As<Napi::Number>().Int32Value();
      
      input.voice_sample = ConvertToAudioData(buffer, sample_rate, channels);
      input.text = info[1].As<Napi::String>().Utf8Value();
      
      // Optional parameters
      if (info.Length() > 2 && info[2].IsString()) {
        input.language = info[2].As<Napi::String>().Utf8Value();
      }
      
      if (info.Length() > 3 && info[3].IsNumber()) {
        input.speed = info[3].As<Napi::Number>().FloatValue();
      }
    }
    else {
      ThrowError(env, "Expected audio buffer, file path string, or audio object");
      return env.Null();
    }
    
    VoiceCloningResult result = f5_tts_->clone_voice(input);
    return ConvertToJSObject(env, result);
    
  } catch (const std::exception& e) {
    ThrowError(env, std::string("Failed to clone voice: ") + e.what());
    return env.Null();
  }
}

Napi::Value VoiceCloner::CloneVoiceAsync(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (!initialized_) {
    ThrowError(env, "VoiceCloner not initialized. Call initialize() first.");
    return env.Null();
  }
  
  if (info.Length() < 3) {
    ThrowError(env, "Expected audio input, text, and callback function");
    return env.Null();
  }
  
  if (!info[info.Length() - 1].IsFunction()) {
    ThrowError(env, "Last argument must be a callback function");
    return env.Null();
  }
  
  try {
    f5_tts::VoiceCloningInput input;
    
    // Parse audio input (similar to CloneVoice but with adjusted indices)
    if (info[0].IsBuffer()) {
      // Audio buffer with sample rate and channels
      if (info.Length() < 5) {
        ThrowError(env, "Expected audio buffer, sample rate, channels, text, and callback");
        return env.Null();
      }
      
      Napi::Buffer<float> buffer = info[0].As<Napi::Buffer<float>>();
      int sample_rate = info[1].As<Napi::Number>().Int32Value();
      int channels = info[2].As<Napi::Number>().Int32Value();
      
      input.voice_sample = ConvertToAudioData(buffer, sample_rate, channels);
      input.text = info[3].As<Napi::String>().Utf8Value();
      
      // Optional parameters
      if (info.Length() > 5 && info[4].IsString()) {
        input.language = info[4].As<Napi::String>().Utf8Value();
      }
      
      if (info.Length() > 6 && info[5].IsNumber()) {
        input.speed = info[5].As<Napi::Number>().FloatValue();
      }
    }
    else if (info[0].IsString()) {
      // File path with text
      if (info.Length() < 3) {
        ThrowError(env, "Expected file path, text, and callback");
        return env.Null();
      }
      
      std::string filepath = info[0].As<Napi::String>().Utf8Value();
      input.text = info[1].As<Napi::String>().Utf8Value();
      
      // Load audio from file using audio processor
      try {
        audio::AudioProcessor processor;
        if (!processor.initialize()) {
          ThrowError(env, "Failed to initialize audio processor");
          return env.Null();
        }
        
        audio::AudioProcessingResult result = processor.load_audio(filepath);
        if (!result.success) {
          ThrowError(env, "Failed to load audio file: " + result.error_message);
          return env.Null();
        }
        
        input.voice_sample.sample_rate = result.audio.sample_rate;
        input.voice_sample.channels = result.audio.channels;
        input.voice_sample.samples = result.audio.samples;
        
      } catch (const std::exception& e) {
        ThrowError(env, std::string("Failed to load audio file: ") + e.what());
        return env.Null();
      }
      
      // Optional parameters
      if (info.Length() > 3 && info[2].IsString()) {
        input.language = info[2].As<Napi::String>().Utf8Value();
      }
      
      if (info.Length() > 4 && info[3].IsNumber()) {
        input.speed = info[3].As<Napi::Number>().FloatValue();
      }
    }
    else if (info[0].IsObject()) {
      // Audio object with text
      if (info.Length() < 3) {
        ThrowError(env, "Expected audio object, text, and callback");
        return env.Null();
      }
      
      Napi::Object audio_obj = info[0].As<Napi::Object>();
      
      if (!audio_obj.Has("samples") || !audio_obj.Has("sampleRate") || !audio_obj.Has("channels")) {
        ThrowError(env, "Audio object must have samples, sampleRate, and channels properties");
        return env.Null();
      }
      
      Napi::Buffer<float> buffer = audio_obj.Get("samples").As<Napi::Buffer<float>>();
      int sample_rate = audio_obj.Get("sampleRate").As<Napi::Number>().Int32Value();
      int channels = audio_obj.Get("channels").As<Napi::Number>().Int32Value();
      
      input.voice_sample = ConvertToAudioData(buffer, sample_rate, channels);
      input.text = info[1].As<Napi::String>().Utf8Value();
      
      // Optional parameters
      if (info.Length() > 3 && info[2].IsString()) {
        input.language = info[2].As<Napi::String>().Utf8Value();
      }
      
      if (info.Length() > 4 && info[3].IsNumber()) {
        input.speed = info[3].As<Napi::Number>().FloatValue();
      }
    }
    else {
      ThrowError(env, "Expected audio buffer, file path string, or audio object");
      return env.Null();
    }
    
    // Get callback function
    Napi::Function callback = info[info.Length() - 1].As<Napi::Function>();
    
    // Create and queue async worker
    AsyncWorker* worker = new AsyncWorker(callback, this, input);
    worker->Queue();
    
    return env.Undefined();
    
  } catch (const std::exception& e) {
    ThrowError(env, std::string("Failed to start async voice cloning: ") + e.what());
    return env.Null();
  }
}

Napi::Value VoiceCloner::GetMemoryUsage(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  try {
    size_t memory_usage = f5_tts_->get_memory_usage();
    return Napi::Number::New(env, static_cast<double>(memory_usage));
    
  } catch (const std::exception& e) {
    ThrowError(env, std::string("Failed to get memory usage: ") + e.what());
    return env.Null();
  }
}

Napi::Value VoiceCloner::ClearCache(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  try {
    f5_tts_->clear_cache();
    return env.Undefined();
    
  } catch (const std::exception& e) {
    ThrowError(env, std::string("Failed to clear cache: ") + e.what());
    return env.Null();
  }
}

Napi::Value VoiceCloner::GetVersion(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  std::string version = F5TTSWrapper::get_version();
  return Napi::String::New(env, version);
}

// Helper method implementations

f5_tts::AudioData VoiceCloner::ConvertToAudioData(const Napi::Buffer<float>& buffer, 
                                                 int sample_rate, int channels) {
  f5_tts::AudioData audio;
  audio.sample_rate = sample_rate;
  audio.channels = channels;
  
  size_t length = buffer.Length();
  audio.samples.resize(length);
  
  float* data = buffer.Data();
  for (size_t i = 0; i < length; ++i) {
    audio.samples[i] = data[i];
  }
  
  return audio;
}

Napi::Object VoiceCloner::ConvertToJSObject(Napi::Env env, const f5_tts::VoiceCloningResult& result) {
  Napi::Object obj = Napi::Object::New(env);
  
  obj.Set("success", Napi::Boolean::New(env, result.success));
  obj.Set("similarityScore", Napi::Number::New(env, result.similarity_score));
  obj.Set("processingTimeMs", Napi::Number::New(env, result.processing_time_ms));
  obj.Set("errorMessage", Napi::String::New(env, result.error_message));
  
  if (result.success) {
    obj.Set("audio", ConvertToJSObject(env, result.audio));
    obj.Set("embedding", ConvertToJSObject(env, result.embedding));
  }
  
  return obj;
}

Napi::Object VoiceCloner::ConvertToJSObject(Napi::Env env, const f5_tts::VoiceEmbedding& embedding) {
  Napi::Object obj = Napi::Object::New(env);
  
  obj.Set("dimension", Napi::Number::New(env, embedding.dimension));
  
  Napi::Array embedding_array = Napi::Array::New(env, embedding.embedding.size());
  for (size_t i = 0; i < embedding.embedding.size(); ++i) {
    embedding_array[i] = Napi::Number::New(env, embedding.embedding[i]);
  }
  obj.Set("embedding", embedding_array);
  
  return obj;
}

Napi::Object VoiceCloner::ConvertToJSObject(Napi::Env env, const f5_tts::AudioData& audio) {
  Napi::Object obj = Napi::Object::New(env);
  
  obj.Set("sampleRate", Napi::Number::New(env, audio.sample_rate));
  obj.Set("channels", Napi::Number::New(env, audio.channels));
  
  Napi::ArrayBuffer buffer = Napi::ArrayBuffer::New(env, audio.samples.size() * sizeof(float));
  float* data = static_cast<float*>(buffer.Data());
  for (size_t i = 0; i < audio.samples.size(); ++i) {
    data[i] = audio.samples[i];
  }
  
  obj.Set("samples", buffer);
  return obj;
}

// Error handling

void VoiceCloner::ThrowError(Napi::Env env, const std::string& message) {
  Napi::Error::New(env, message).ThrowAsJavaScriptException();
}

Napi::Error VoiceCloner::CreateError(Napi::Env env, const std::string& message) {
  return Napi::Error::New(env, message);
}