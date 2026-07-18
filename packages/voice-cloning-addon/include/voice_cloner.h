#ifndef VOICE_CLONER_H
#define VOICE_CLONER_H

#include <napi.h>
#include <memory>
#include <string>

// Forward declaration
namespace f5_tts {
class F5TTSWrapper;
struct F5TTSConfig;
struct AudioData;
struct VoiceEmbedding;
struct VoiceCloningInput;
struct VoiceCloningResult;
}

class VoiceCloner : public Napi::ObjectWrap<VoiceCloner> {
public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  static Napi::Function GetClass(Napi::Env env);
  
  VoiceCloner(const Napi::CallbackInfo& info);
  ~VoiceCloner();
  
  // Public methods exposed to JavaScript
  Napi::Value Initialize(const Napi::CallbackInfo& info);
  Napi::Value IsInitialized(const Napi::CallbackInfo& info);
  Napi::Value LoadModel(const Napi::CallbackInfo& info);
  Napi::Value LoadVocoder(const Napi::CallbackInfo& info);
  Napi::Value ExtractVoiceEmbedding(const Napi::CallbackInfo& info);
  Napi::Value SynthesizeSpeech(const Napi::CallbackInfo& info);
  Napi::Value CloneVoice(const Napi::CallbackInfo& info);
  Napi::Value GetMemoryUsage(const Napi::CallbackInfo& info);
  Napi::Value ClearCache(const Napi::CallbackInfo& info);
  Napi::Value GetVersion(const Napi::CallbackInfo& info);
  
private:
  // Helper methods
  f5_tts::AudioData ConvertToAudioData(const Napi::Buffer<float>& buffer, int sample_rate, int channels);
  Napi::Object ConvertToJSObject(Napi::Env env, const f5_tts::VoiceCloningResult& result);
  Napi::Object ConvertToJSObject(Napi::Env env, const f5_tts::VoiceEmbedding& embedding);
  Napi::Object ConvertToJSObject(Napi::Env env, const f5_tts::AudioData& audio);
  
  // Error handling
  void ThrowError(Napi::Env env, const std::string& message);
  Napi::Error CreateError(Napi::Env env, const std::string& message);
  
  // Private members
  std::unique_ptr<f5_tts::F5TTSWrapper> f5_tts_;
  f5_tts::F5TTSConfig config_;
  bool initialized_;
  
  // Async worker for long-running operations
  class AsyncWorker;
};

#endif // VOICE_CLONER_H