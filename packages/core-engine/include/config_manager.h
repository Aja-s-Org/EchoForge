#ifndef CONFIG_MANAGER_H
#define CONFIG_MANAGER_H

#include <string>
#include <unordered_map>
#include <memory>
#include <mutex>
#include <fstream>
#include <iostream>

namespace config {

/**
 * @brief Configuration value types
 */
enum class ConfigValueType {
  STRING,
  INTEGER,
  FLOAT,
  BOOLEAN,
  ARRAY,
  OBJECT
};

/**
 * @brief Configuration value container
 */
struct ConfigValue {
  ConfigValueType type;
  std::string string_value;
  int int_value;
  float float_value;
  bool bool_value;
  
  ConfigValue() : type(ConfigValueType::STRING), int_value(0), float_value(0.0f), bool_value(false) {}
  
  ConfigValue(const std::string& val) : type(ConfigValueType::STRING), string_value(val), int_value(0), float_value(0.0f), bool_value(false) {}
  ConfigValue(int val) : type(ConfigValueType::INTEGER), int_value(val), float_value(0.0f), bool_value(false) {}
  ConfigValue(float val) : type(ConfigValueType::FLOAT), float_value(val), int_value(0), bool_value(false) {}
  ConfigValue(bool val) : type(ConfigValueType::BOOLEAN), bool_value(val), int_value(0), float_value(0.0f) {}
  
  std::string to_string() const {
    switch (type) {
      case ConfigValueType::STRING: return string_value;
      case ConfigValueType::INTEGER: return std::to_string(int_value);
      case ConfigValueType::FLOAT: return std::to_string(float_value);
      case ConfigValueType::BOOLEAN: return bool_value ? "true" : "false";
      default: return "";
    }
  }
  
  int to_int() const {
    switch (type) {
      case ConfigValueType::STRING: return std::stoi(string_value);
      case ConfigValueType::INTEGER: return int_value;
      case ConfigValueType::FLOAT: return static_cast<int>(float_value);
      case ConfigValueType::BOOLEAN: return bool_value ? 1 : 0;
      default: return 0;
    }
  }
  
  float to_float() const {
    switch (type) {
      case ConfigValueType::STRING: return std::stof(string_value);
      case ConfigValueType::INTEGER: return static_cast<float>(int_value);
      case ConfigValueType::FLOAT: return float_value;
      case ConfigValueType::BOOLEAN: return bool_value ? 1.0f : 0.0f;
      default: return 0.0f;
    }
  }
  
  bool to_bool() const {
    switch (type) {
      case ConfigValueType::STRING: return string_value == "true" || string_value == "1";
      case ConfigValueType::INTEGER: return int_value != 0;
      case ConfigValueType::FLOAT: return float_value != 0.0f;
      case ConfigValueType::BOOLEAN: return bool_value;
      default: return false;
    }
  }
};

/**
 * @brief Configuration section
 */
using ConfigSection = std::unordered_map<std::string, ConfigValue>;

/**
 * @brief Configuration manager
 */
class ConfigManager {
public:
  /**
   * @brief Get singleton instance
   */
  static ConfigManager& get_instance() {
    static ConfigManager instance;
    return instance;
  }
  
  /**
   * @brief Load configuration from file
   * @param filepath Path to configuration file
   * @return true if loaded successfully, false otherwise
   */
  bool load_config(const std::string& filepath);
  
  /**
   * @brief Save configuration to file
   * @param filepath Path to configuration file
   * @return true if saved successfully, false otherwise
   */
  bool save_config(const std::string& filepath);
  
  /**
   * @brief Get configuration value
   * @param section Configuration section
   * @param key Configuration key
   * @param default_value Default value if not found
   * @return Configuration value
   */
  ConfigValue get_value(const std::string& section, const std::string& key, 
                       const ConfigValue& default_value = ConfigValue()) const;
  
  /**
   * @brief Set configuration value
   * @param section Configuration section
   * @param key Configuration key
   * @param value Configuration value
   */
  void set_value(const std::string& section, const std::string& key, const ConfigValue& value);
  
  /**
   * @brief Get string configuration value
   * @param section Configuration section
   * @param key Configuration key
   * @param default_value Default value if not found
   * @return String value
   */
  std::string get_string(const std::string& section, const std::string& key, 
                        const std::string& default_value = "") const;
  
  /**
   * @brief Get integer configuration value
   * @param section Configuration section
   * @param key Configuration key
   * @param default_value Default value if not found
   * @return Integer value
   */
  int get_int(const std::string& section, const std::string& key, int default_value = 0) const;
  
  /**
   * @brief Get float configuration value
   * @param section Configuration section
   * @param key Configuration key
   * @param default_value Default value if not found
   * @return Float value
   */
  float get_float(const std::string& section, const std::string& key, float default_value = 0.0f) const;
  
  /**
   * @brief Get boolean configuration value
   * @param section Configuration section
   * @param key Configuration key
   * @param default_value Default value if not found
   * @return Boolean value
   */
  bool get_bool(const std::string& section, const std::string& key, bool default_value = false) const;
  
  /**
   * @brief Set string configuration value
   * @param section Configuration section
   * @param key Configuration key
   * @param value String value
   */
  void set_string(const std::string& section, const std::string& key, const std::string& value);
  
  /**
   * @brief Set integer configuration value
   * @param section Configuration section
   * @param key Configuration key
   * @param value Integer value
   */
  void set_int(const std::string& section, const std::string& key, int value);
  
  /**
   * @brief Set float configuration value
   * @param section Configuration section
   * @param key Configuration key
   * @param value Float value
   */
  void set_float(const std::string& section, const std::string& key, float value);
  
  /**
   * @brief Set boolean configuration value
   * @param section Configuration section
   * @param key Configuration key
   * @param value Boolean value
   */
  void set_bool(const std::string& section, const std::string& key, bool value);
  
  /**
   * @brief Check if configuration section exists
   * @param section Configuration section
   * @return true if section exists, false otherwise
   */
  bool has_section(const std::string& section) const;
  
  /**
   * @brief Check if configuration key exists
   * @param section Configuration section
   * @param key Configuration key
   * @return true if key exists, false otherwise
   */
  bool has_key(const std::string& section, const std::string& key) const;
  
  /**
   * @brief Remove configuration key
   * @param section Configuration section
   * @param key Configuration key
   * @return true if key was removed, false if not found
   */
  bool remove_key(const std::string& section, const std::string& key);
  
  /**
   * @brief Remove configuration section
   * @param section Configuration section
   * @return true if section was removed, false if not found
   */
  bool remove_section(const std::string& section);
  
  /**
   * @brief Get all sections
   * @return List of section names
   */
  std::vector<std::string> get_sections() const;
  
  /**
   * @brief Get all keys in section
   * @param section Configuration section
   * @return List of key names
   */
  std::vector<std::string> get_keys(const std::string& section) const;
  
  /**
   * @brief Clear all configuration
   */
  void clear();
  
  /**
   * @brief Get configuration as string
   * @return Configuration string representation
   */
  std::string to_string() const;
  
  /**
   * @brief Load default configuration
   */
  void load_defaults();
  
  /**
   * @brief Get error message
   * @return Last error message
   */
  std::string get_error() const;
  
private:
  ConfigManager();
  ~ConfigManager() = default;
  
  // Prevent copying
  ConfigManager(const ConfigManager&) = delete;
  ConfigManager& operator=(const ConfigManager&) = delete;
  
  // Configuration storage
  std::unordered_map<std::string, ConfigSection> config_;
  mutable std::mutex config_mutex_;
  std::string last_error_;
  
  // Helper methods
  void set_error(const std::string& error);
  bool parse_config_line(const std::string& line, std::string& current_section, 
                        std::string& key, ConfigValue& value);
  std::string trim(const std::string& str) const;
  bool is_section_line(const std::string& line) const;
  std::string extract_section_name(const std::string& line) const;
  std::pair<std::string, ConfigValue> parse_key_value(const std::string& line) const;
};

} // namespace config

#endif // CONFIG_MANAGER_H