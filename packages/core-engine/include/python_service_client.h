#ifndef PYTHON_SERVICE_CLIENT_H
#define PYTHON_SERVICE_CLIENT_H

#include <string>
#include <vector>
#include <memory>
#include <json/json.h>

namespace python {

/**
 * @brief Client for communicating with Python voice cloning service
 */
class PythonServiceClient {
public:
  /**
   * @brief Constructor
   * @param python_path Path to Python executable
   * @param service_path Path to Python service script
   */
  PythonServiceClient(const std::string& python_path = "python3",
                     const std::string& service_path = "");
  
  /**
   * @brief Destructor
   */
  ~PythonServiceClient();
  
  /**
   * @brief Start the Python service
   * @return true if service started successfully, false otherwise
   */
  bool start_service();
  
  /**
   * @brief Stop the Python service
   * @return true if service stopped successfully, false otherwise
   */
  bool stop_service();
  
  /**
   * @brief Check if service is running
   * @return true if service is running, false otherwise
   */
  bool is_service_running() const;
  
  /**
   * @brief Call a method on the Python service
   * @param method Method name
   * @param params Method parameters
   * @return JSON response from service
   */
  Json::Value call_service(const std::string& method, const Json::Value& params);
  
  /**
   * @brief Initialize the voice cloning model
   * @param model_path Path to model files
   * @return JSON response
   */
  Json::Value initialize_model(const std::string& model_path);
  
  /**
   * @brief Extract voice embedding from audio samples
   * @param audio_samples Audio samples (float values, typically in range [-1, 1])
   * @param sample_rate Audio sample rate in Hz
   * @return JSON response containing voice embedding
   */
  Json::Value extract_voice_embedding(const std::vector<float>& audio_samples, int sample_rate);
  
  /**
   * @brief Synthesize speech with cloned voice
   * @param embedding Voice embedding vector
   * @param text Text to synthesize
   * @param language Language code (e.g., "en", "es")
   * @param speed Speech speed (1.0 = normal, <1.0 = slower, >1.0 = faster)
   * @return JSON response containing synthesized audio
   */
  Json::Value synthesize_speech(const std::vector<float>& embedding, 
                               const std::string& text,
                               const std::string& language = "en",
                               float speed = 1.0f);
  
  /**
   * @brief Get Python version
   * @return Python version string
   */
  std::string get_python_version() const;
  
  /**
   * @brief Get last error message
   * @return Last error message
   */
  std::string get_last_error() const;
  
private:
  // Private implementation
  class Impl;
  std::unique_ptr<Impl> impl_;
  
  // Error handling
  mutable std::string last_error_;
  void set_last_error(const std::string& error) const;
};

} // namespace python

#endif // PYTHON_SERVICE_CLIENT_H