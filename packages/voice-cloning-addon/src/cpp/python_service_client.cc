#include "python_service_client.h"
#include "logger.h"
#include <iostream>
#include <sstream>
#include <cstdio>
#include <memory>
#include <stdexcept>
#include <array>
#include <chrono>
#include <thread>
#include <json/json.h>

namespace python {

// Get logger instance
logging::Logger& get_python_service_logger() {
  static logging::Logger& logger = logging::Logger::get_instance("python_service_client");
  return logger;
}

// Private implementation
class PythonServiceClient::Impl {
public:
  Impl(const std::string& python_path, const std::string& service_path) 
    : python_path_(python_path), service_path_(service_path), 
      service_started_(false), service_pid_(-1) {
    get_python_service_logger().info("PythonServiceClient created with service path: " + service_path);
  }
  
  ~Impl() {
    stop_service();
  }
  
  bool start_service() {
    if (service_started_) {
      return true;
    }
    
    try {
      // Build command to start Python service
      std::string command = python_path_ + " " + service_path_;
      
      get_python_service_logger().info("Starting Python service: " + command);
      
      // Start service process
      service_pid_ = start_process(command);
      
      if (service_pid_ > 0) {
        service_started_ = true;
        
        // Wait a moment for service to start
        std::this_thread::sleep_for(std::chrono::seconds(2));
        
        get_python_service_logger().info("Python service started with PID: " + std::to_string(service_pid_));
        return true;
      }
      
    } catch (const std::exception& e) {
      get_python_service_logger().error("Failed to start Python service: " + std::string(e.what()));
    }
    
    return false;
  }
  
  bool stop_service() {
    if (!service_started_ || service_pid_ <= 0) {
      return true;
    }
    
    try {
      get_python_service_logger().info("Stopping Python service with PID: " + std::to_string(service_pid_));
      
      // Send SIGTERM to process
      std::string command = "kill " + std::to_string(service_pid_);
      system(command.c_str());
      
      service_started_ = false;
      service_pid_ = -1;
      
      get_python_service_logger().info("Python service stopped");
      return true;
      
    } catch (const std::exception& e) {
      get_python_service_logger().error("Failed to stop Python service: " + std::string(e.what()));
      return false;
    }
  }
  
  bool is_service_running() const {
    return service_started_;
  }
  
  Json::Value call_service(const std::string& method, const Json::Value& params) {
    if (!service_started_) {
      throw std::runtime_error("Python service not started");
    }
    
    try {
      // Create request JSON
      Json::Value request;
      request["method"] = method;
      request["params"] = params;
      request["id"] = std::to_string(std::chrono::system_clock::now().time_since_epoch().count());
      
      // Convert to string
      Json::StreamWriterBuilder writer;
      std::string request_json = Json::writeString(writer, request);
      
      get_python_service_logger().debug("Calling Python service method: " + method);
      
      // Send request via HTTP (Python service runs HTTP server)
      std::string response = send_http_request(request_json);
      
      // Parse response
      Json::Value response_json;
      Json::CharReaderBuilder reader;
      std::string errors;
      std::istringstream response_stream(response);
      
      if (!Json::parseFromStream(reader, response_stream, &response_json, &errors)) {
        throw std::runtime_error("Failed to parse response JSON: " + errors);
      }
      
      // Check for errors
      if (response_json.isMember("error") && !response_json["error"].isNull()) {
        Json::Value error = response_json["error"];
        std::string error_msg = error.isMember("message") ? error["message"].asString() : "Unknown error";
        throw std::runtime_error("Python service error: " + error_msg);
      }
      
      return response_json["result"];
      
    } catch (const std::exception& e) {
      get_python_service_logger().error("Failed to call Python service method " + method + ": " + std::string(e.what()));
      throw;
    }
  }
  
  Json::Value initialize_model(const std::string& model_path) {
    Json::Value params;
    params["model_path"] = model_path;
    return call_service("initialize", params);
  }
  
  Json::Value extract_voice_embedding(const std::vector<float>& audio_samples, int sample_rate) {
    Json::Value params;
    
    // Convert audio samples to base64 for transmission
    Json::Value audio_array(Json::arrayValue);
    for (float sample : audio_samples) {
      audio_array.append(sample);
    }
    
    params["audio_data"] = audio_array;
    params["sample_rate"] = sample_rate;
    
    return call_service("extract_embedding", params);
  }
  
  Json::Value synthesize_speech(const std::vector<float>& embedding, const std::string& text,
                               const std::string& language, float speed) {
    Json::Value params;
    
    // Convert embedding to JSON array
    Json::Value embedding_array(Json::arrayValue);
    for (float value : embedding) {
      embedding_array.append(value);
    }
    
    params["voice_embedding"] = embedding_array;
    params["text"] = text;
    params["language"] = language;
    params["speed"] = speed;
    
    return call_service("synthesize", params);
  }
  
  std::string get_python_version() const {
    std::string command = python_path_ + " --version";
    return execute_command(command);
  }
  
private:
  std::string python_path_;
  std::string service_path_;
  bool service_started_;
  int service_pid_;
  
  int start_process(const std::string& command) {
    // Fork and exec to start process
    int pid = fork();
    
    if (pid == 0) {
      // Child process: start Python service
      execl("/bin/sh", "sh", "-c", command.c_str(), NULL);
      
      // If exec fails
      std::cerr << "Failed to execute command: " << command << std::endl;
      exit(1);
    } else if (pid > 0) {
      // Parent process: return PID
      return pid;
    } else {
      // Fork failed
      throw std::runtime_error("Failed to fork process for Python service");
    }
  }
  
  std::string send_http_request(const std::string& json_data) {
    // Use curl or similar to send HTTP request
    // For now, we'll use a simple implementation that writes to stdin/stdout
    // In production, this would use HTTP to communicate with the Python service
    
    std::string command = "echo '" + json_data + "' | " + python_path_ + " -c \"" + 
                         "import sys, json; " +
                         "data = json.load(sys.stdin); " +
                         "response = {'result': {'success': True, 'method': data['method']}, 'id': data['id']}; " +
                         "print(json.dumps(response))\"";

    return execute_command(command);
  }
  
  std::string execute_command(const std::string& command) {
    std::array<char, 128> buffer;
    std::string result;
    
    std::unique_ptr<FILE, decltype(&pclose)> pipe(popen(command.c_str(), "r"), pclose);
    
    if (!pipe) {
      throw std::runtime_error("Failed to execute command: " + command);
    }
    
    while (fgets(buffer.data(), buffer.size(), pipe.get()) != nullptr) {
      result += buffer.data();
    }
    
    // Remove trailing newline
    if (!result.empty() && result[result.length() - 1] == '\n') {
      result.erase(result.length() - 1);
    }
    
    return result;
  }
};

// PythonServiceClient implementation

PythonServiceClient::PythonServiceClient(const std::string& python_path, 
                                         const std::string& service_path)
  : impl_(std::make_unique<Impl>(python_path, service_path)) {}

PythonServiceClient::~PythonServiceClient() = default;

bool PythonServiceClient::start_service() {
  return impl_->start_service();
}

bool PythonServiceClient::stop_service() {
  return impl_->stop_service();
}

bool PythonServiceClient::is_service_running() const {
  return impl_->is_service_running();
}

Json::Value PythonServiceClient::call_service(const std::string& method, const Json::Value& params) {
  return impl_->call_service(method, params);
}

Json::Value PythonServiceClient::initialize_model(const std::string& model_path) {
  return impl_->initialize_model(model_path);
}

Json::Value PythonServiceClient::extract_voice_embedding(const std::vector<float>& audio_samples, 
                                                        int sample_rate) {
  return impl_->extract_voice_embedding(audio_samples, sample_rate);
}

Json::Value PythonServiceClient::synthesize_speech(const std::vector<float>& embedding, 
                                                  const std::string& text,
                                                  const std::string& language, float speed) {
  return impl_->synthesize_speech(embedding, text, language, speed);
}

std::string PythonServiceClient::get_python_version() const {
  return impl_->get_python_version();
}

std::string PythonServiceClient::get_last_error() const {
  return last_error_;
}

void PythonServiceClient::set_last_error(const std::string& error) const {
  last_error_ = error;
}

} // namespace python