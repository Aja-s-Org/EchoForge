#include "config_manager.h"
#include <sstream>
#include <algorithm>
#include <cctype>
#include <iomanip>

namespace config {

ConfigManager::ConfigManager() {
  load_defaults();
}

bool ConfigManager::load_config(const std::string& filepath) {
  std::lock_guard<std::mutex> lock(config_mutex_);
  
  std::ifstream file(filepath);
  if (!file.is_open()) {
    set_error("Failed to open configuration file: " + filepath);
    return false;
  }
  
  std::string current_section = "default";
  std::string line;
  int line_number = 0;
  
  while (std::getline(file, line)) {
    ++line_number;
    
    std::string trimmed = trim(line);
    
    // Skip empty lines and comments
    if (trimmed.empty() || trimmed[0] == '#' || trimmed[0] == ';') {
      continue;
    }
    
    // Check for section
    if (is_section_line(trimmed)) {
      current_section = extract_section_name(trimmed);
      continue;
    }
    
    // Parse key-value pair
    std::string key;
    ConfigValue value;
    
    if (!parse_config_line(trimmed, current_section, key, value)) {
      set_error("Failed to parse line " + std::to_string(line_number) + ": " + line);
      return false;
    }
    
    config_[current_section][key] = value;
  }
  
  return true;
}

bool ConfigManager::save_config(const std::string& filepath) {
  std::lock_guard<std::mutex> lock(config_mutex_);
  
  std::ofstream file(filepath);
  if (!file.is_open()) {
    set_error("Failed to create configuration file: " + filepath);
    return false;
  }
  
  // Write configuration to file
  for (const auto& section_pair : config_) {
    const std::string& section_name = section_pair.first;
    const ConfigSection& section = section_pair.second;
    
    if (section.empty()) {
      continue;
    }
    
    file << "[" << section_name << "]" << std::endl;
    
    for (const auto& key_pair : section) {
      const std::string& key = key_pair.first;
      const ConfigValue& value = key_pair.second;
      
      file << key << " = " << value.to_string() << std::endl;
    }
    
    file << std::endl;
  }
  
  return true;
}

ConfigValue ConfigManager::get_value(const std::string& section, const std::string& key, 
                                    const ConfigValue& default_value) const {
  std::lock_guard<std::mutex> lock(config_mutex_);
  
  auto section_it = config_.find(section);
  if (section_it == config_.end()) {
    return default_value;
  }
  
  auto key_it = section_it->second.find(key);
  if (key_it == section_it->second.end()) {
    return default_value;
  }
  
  return key_it->second;
}

void ConfigManager::set_value(const std::string& section, const std::string& key, 
                             const ConfigValue& value) {
  std::lock_guard<std::mutex> lock(config_mutex_);
  config_[section][key] = value;
}

std::string ConfigManager::get_string(const std::string& section, const std::string& key, 
                                     const std::string& default_value) const {
  ConfigValue value = get_value(section, key, ConfigValue(default_value));
  return value.to_string();
}

int ConfigManager::get_int(const std::string& section, const std::string& key, int default_value) const {
  ConfigValue value = get_value(section, key, ConfigValue(default_value));
  return value.to_int();
}

float ConfigManager::get_float(const std::string& section, const std::string& key, float default_value) const {
  ConfigValue value = get_value(section, key, ConfigValue(default_value));
  return value.to_float();
}

bool ConfigManager::get_bool(const std::string& section, const std::string& key, bool default_value) const {
  ConfigValue value = get_value(section, key, ConfigValue(default_value));
  return value.to_bool();
}

void ConfigManager::set_string(const std::string& section, const std::string& key, 
                              const std::string& value) {
  set_value(section, key, ConfigValue(value));
}

void ConfigManager::set_int(const std::string& section, const std::string& key, int value) {
  set_value(section, key, ConfigValue(value));
}

void ConfigManager::set_float(const std::string& section, const std::string& key, float value) {
  set_value(section, key, ConfigValue(value));
}

void ConfigManager::set_bool(const std::string& section, const std::string& key, bool value) {
  set_value(section, key, ConfigValue(value));
}

bool ConfigManager::has_section(const std::string& section) const {
  std::lock_guard<std::mutex> lock(config_mutex_);
  return config_.find(section) != config_.end();
}

bool ConfigManager::has_key(const std::string& section, const std::string& key) const {
  std::lock_guard<std::mutex> lock(config_mutex_);
  
  auto section_it = config_.find(section);
  if (section_it == config_.end()) {
    return false;
  }
  
  return section_it->second.find(key) != section_it->second.end();
}

bool ConfigManager::remove_key(const std::string& section, const std::string& key) {
  std::lock_guard<std::mutex> lock(config_mutex_);
  
  auto section_it = config_.find(section);
  if (section_it == config_.end()) {
    return false;
  }
  
  return section_it->second.erase(key) > 0;
}

bool ConfigManager::remove_section(const std::string& section) {
  std::lock_guard<std::mutex> lock(config_mutex_);
  return config_.erase(section) > 0;
}

std::vector<std::string> ConfigManager::get_sections() const {
  std::lock_guard<std::mutex> lock(config_mutex_);
  
  std::vector<std::string> sections;
  sections.reserve(config_.size());
  
  for (const auto& section_pair : config_) {
    sections.push_back(section_pair.first);
  }
  
  return sections;
}

std::vector<std::string> ConfigManager::get_keys(const std::string& section) const {
  std::lock_guard<std::mutex> lock(config_mutex_);
  
  std::vector<std::string> keys;
  auto section_it = config_.find(section);
  
  if (section_it != config_.end()) {
    keys.reserve(section_it->second.size());
    
    for (const auto& key_pair : section_it->second) {
      keys.push_back(key_pair.first);
    }
  }
  
  return keys;
}

void ConfigManager::clear() {
  std::lock_guard<std::mutex> lock(config_mutex_);
  config_.clear();
  load_defaults();
}

std::string ConfigManager::to_string() const {
  std::lock_guard<std::mutex> lock(config_mutex_);
  
  std::ostringstream oss;
  
  for (const auto& section_pair : config_) {
    const std::string& section_name = section_pair.first;
    const ConfigSection& section = section_pair.second;
    
    if (section.empty()) {
      continue;
    }
    
    oss << "[" << section_name << "]" << std::endl;
    
    for (const auto& key_pair : section) {
      const std::string& key = key_pair.first;
      const ConfigValue& value = key_pair.second;
      
      oss << "  " << key << " = " << value.to_string() << std::endl;
    }
    
    oss << std::endl;
  }
  
  return oss.str();
}

void ConfigManager::load_defaults() {
  std::lock_guard<std::mutex> lock(config_mutex_);
  
  // Clear existing config
  config_.clear();
  
  // Audio processing defaults
  ConfigSection audio_section;
  audio_section["target_sample_rate"] = ConfigValue(22050);
  audio_section["target_channels"] = ConfigValue(1);
  audio_section["normalization_threshold"] = ConfigValue(0.95f);
  audio_section["enable_noise_reduction"] = ConfigValue(false);
  audio_section["enable_compression"] = ConfigValue(false);
  audio_section["compression_ratio"] = ConfigValue(2.0f);
  audio_section["enhancement_strength"] = ConfigValue(0.5f);
  audio_section["max_audio_duration"] = ConfigValue(30.0f);
  audio_section["min_audio_duration"] = ConfigValue(1.0f);
  config_["audio"] = audio_section;
  
  // Voice cloning defaults
  ConfigSection voice_section;
  voice_section["embedding_dimension"] = ConfigValue(256);
  voice_section["similarity_threshold"] = ConfigValue(0.7f);
  voice_section["max_concurrent_requests"] = ConfigValue(5);
  voice_section["timeout_seconds"] = ConfigValue(30.0f);
  voice_section["use_gpu"] = ConfigValue(true);
  voice_section["model_path"] = ConfigValue("./models/f5-tts");
  voice_section["vocoder_path"] = ConfigValue("./models/vocoder");
  config_["voice_cloning"] = voice_section;
  
  // Logging defaults
  ConfigSection logging_section;
  logging_section["level"] = ConfigValue("info");
  logging_section["file_path"] = ConfigValue("./logs/voice_cloning.log");
  logging_section["max_file_size"] = ConfigValue(10485760);  // 10 MB
  logging_section["max_backup_files"] = ConfigValue(5);
  logging_section["enable_console"] = ConfigValue(true);
  config_["logging"] = logging_section;
  
  // Performance defaults
  ConfigSection performance_section;
  performance_section["cache_enabled"] = ConfigValue(true);
  performance_section["cache_ttl_seconds"] = ConfigValue(3600);  // 1 hour
  performance_section["max_cache_size"] = ConfigValue(1073741824);  // 1 GB
  performance_section["preload_models"] = ConfigValue(false);
  config_["performance"] = performance_section;
  
  // System defaults
  ConfigSection system_section;
  system_section["platform"] = 
#ifdef __APPLE__
    ConfigValue("macos");
#elif defined(__linux__)
    ConfigValue("linux");
#elif defined(_WIN32)
    ConfigValue("windows");
#else
    ConfigValue("unknown");
#endif
  system_section["version"] = ConfigValue("1.0.0");
  config_["system"] = system_section;
}

std::string ConfigManager::get_error() const {
  std::lock_guard<std::mutex> lock(config_mutex_);
  return last_error_;
}

// Helper methods

void ConfigManager::set_error(const std::string& error) {
  last_error_ = error;
}

bool ConfigManager::parse_config_line(const std::string& line, std::string& current_section,
                                     std::string& key, ConfigValue& value) {
  size_t equals_pos = line.find('=');
  if (equals_pos == std::string::npos) {
    return false;
  }
  
  key = trim(line.substr(0, equals_pos));
  std::string value_str = trim(line.substr(equals_pos + 1));
  
  if (key.empty()) {
    return false;
  }
  
  // Try to determine value type
  if (value_str == "true" || value_str == "false") {
    value = ConfigValue(value_str == "true");
  } else if (value_str.find('.') != std::string::npos) {
    try {
      float float_val = std::stof(value_str);
      value = ConfigValue(float_val);
    } catch (...) {
      value = ConfigValue(value_str);
    }
  } else {
    try {
      int int_val = std::stoi(value_str);
      value = ConfigValue(int_val);
    } catch (...) {
      value = ConfigValue(value_str);
    }
  }
  
  return true;
}

std::string ConfigManager::trim(const std::string& str) const {
  size_t start = 0;
  size_t end = str.length();
  
  while (start < end && std::isspace(str[start])) {
    ++start;
  }
  
  while (end > start && std::isspace(str[end - 1])) {
    --end;
  }
  
  return str.substr(start, end - start);
}

bool ConfigManager::is_section_line(const std::string& line) const {
  return line.length() >= 2 && line[0] == '[' && line[line.length() - 1] == ']';
}

std::string ConfigManager::extract_section_name(const std::string& line) const {
  if (!is_section_line(line)) {
    return "";
  }
  
  return trim(line.substr(1, line.length() - 2));
}

std::pair<std::string, ConfigValue> ConfigManager::parse_key_value(const std::string& line) const {
  std::pair<std::string, ConfigValue> result;
  
  size_t equals_pos = line.find('=');
  if (equals_pos == std::string::npos) {
    return result;
  }
  
  result.first = trim(line.substr(0, equals_pos));
  std::string value_str = trim(line.substr(equals_pos + 1));
  
  // Simple type detection
  if (value_str == "true" || value_str == "false") {
    result.second = ConfigValue(value_str == "true");
  } else if (value_str.find('.') != std::string::npos) {
    try {
      result.second = ConfigValue(std::stof(value_str));
    } catch (...) {
      result.second = ConfigValue(value_str);
    }
  } else {
    try {
      result.second = ConfigValue(std::stoi(value_str));
    } catch (...) {
      result.second = ConfigValue(value_str);
    }
  }
  
  return result;
}

} // namespace config