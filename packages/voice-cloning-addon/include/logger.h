#ifndef LOGGER_H
#define LOGGER_H

#include <string>
#include <memory>
#include <mutex>
#include <fstream>
#include <iostream>
#include <sstream>
#include <iomanip>
#include <chrono>
#include <ctime>
#include <vector>

namespace logging {

/**
 * @brief Log levels
 */
enum class LogLevel {
  TRACE,
  DEBUG,
  INFO,
  WARN,
  ERROR,
  FATAL,
  OFF
};

/**
 * @brief Log entry
 */
struct LogEntry {
  LogLevel level;
  std::string message;
  std::string timestamp;
  std::string source;
  int line;
  
  LogEntry() : level(LogLevel::INFO), line(0) {}
  LogEntry(LogLevel lvl, const std::string& msg, const std::string& src, int ln)
    : level(lvl), message(msg), source(src), line(ln) {
    update_timestamp();
  }
  
  void update_timestamp() {
    auto now = std::chrono::system_clock::now();
    auto time_t = std::chrono::system_clock::to_time_t(now);
    auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(
      now.time_since_epoch()) % 1000;
    
    std::tm tm;
#ifdef _WIN32
    localtime_s(&tm, &time_t);
#else
    localtime_r(&time_t, &tm);
#endif
    
    std::ostringstream oss;
    oss << std::put_time(&tm, "%Y-%m-%d %H:%M:%S") << '.' 
        << std::setfill('0') << std::setw(3) << ms.count();
    
    timestamp = oss.str();
  }
  
  std::string to_string() const {
    std::string level_str;
    switch (level) {
      case LogLevel::TRACE: level_str = "TRACE"; break;
      case LogLevel::DEBUG: level_str = "DEBUG"; break;
      case LogLevel::INFO:  level_str = "INFO";  break;
      case LogLevel::WARN:  level_str = "WARN";  break;
      case LogLevel::ERROR: level_str = "ERROR"; break;
      case LogLevel::FATAL: level_str = "FATAL"; break;
      default:              level_str = "UNKNOWN"; break;
    }
    
    std::ostringstream oss;
    oss << "[" << timestamp << "] "
        << "[" << level_str << "] ";
    
    if (!source.empty()) {
      oss << "[" << source;
      if (line > 0) {
        oss << ":" << line;
      }
      oss << "] ";
    }
    
    oss << message;
    return oss.str();
  }
};

/**
 * @brief Log sink interface
 */
class LogSink {
public:
  virtual ~LogSink() = default;
  virtual void write(const LogEntry& entry) = 0;
  virtual void flush() = 0;
  virtual void close() = 0;
};

/**
 * @brief Console log sink
 */
class ConsoleSink : public LogSink {
public:
  ConsoleSink(bool use_colors = true) : use_colors_(use_colors) {}
  
  void write(const LogEntry& entry) override {
    std::lock_guard<std::mutex> lock(mutex_);
    
    if (use_colors_) {
      set_color(entry.level);
    }
    
    std::cout << entry.to_string() << std::endl;
    
    if (use_colors_) {
      reset_color();
    }
  }
  
  void flush() override {
    std::cout.flush();
  }
  
  void close() override {
    // Nothing to close for console
  }
  
private:
  bool use_colors_;
  std::mutex mutex_;
  
  void set_color(LogLevel level) {
#ifdef _WIN32
    HANDLE hConsole = GetStdHandle(STD_OUTPUT_HANDLE);
    WORD color = FOREGROUND_RED | FOREGROUND_GREEN | FOREGROUND_BLUE;  // Default white
    
    switch (level) {
      case LogLevel::TRACE: color = FOREGROUND_INTENSITY; break;
      case LogLevel::DEBUG: color = FOREGROUND_BLUE | FOREGROUND_GREEN; break;
      case LogLevel::INFO:  color = FOREGROUND_GREEN; break;
      case LogLevel::WARN:  color = FOREGROUND_RED | FOREGROUND_GREEN; break;
      case LogLevel::ERROR: color = FOREGROUND_RED; break;
      case LogLevel::FATAL: color = FOREGROUND_RED | FOREGROUND_INTENSITY; break;
      default: break;
    }
    
    SetConsoleTextAttribute(hConsole, color);
#else
    // ANSI color codes
    const char* color_code = "";
    
    switch (level) {
      case LogLevel::TRACE: color_code = "\033[37m"; break;  // White
      case LogLevel::DEBUG: color_code = "\033[36m"; break;  // Cyan
      case LogLevel::INFO:  color_code = "\033[32m"; break;  // Green
      case LogLevel::WARN:  color_code = "\033[33m"; break;  // Yellow
      case LogLevel::ERROR: color_code = "\033[31m"; break;  // Red
      case LogLevel::FATAL: color_code = "\033[35m"; break;  // Magenta
      default: break;
    }
    
    std::cout << color_code;
#endif
  }
  
  void reset_color() {
#ifdef _WIN32
    HANDLE hConsole = GetStdHandle(STD_OUTPUT_HANDLE);
    SetConsoleTextAttribute(hConsole, 
      FOREGROUND_RED | FOREGROUND_GREEN | FOREGROUND_BLUE);
#else
    std::cout << "\033[0m";
#endif
  }
};

/**
 * @brief File log sink
 */
class FileSink : public LogSink {
public:
  FileSink(const std::string& filepath, size_t max_file_size = 10485760, 
          int max_backup_files = 5)
    : filepath_(filepath), max_file_size_(max_file_size), 
      max_backup_files_(max_backup_files), current_size_(0) {
    open_file();
  }
  
  ~FileSink() {
    close();
  }
  
  void write(const LogEntry& entry) override {
    std::lock_guard<std::mutex> lock(mutex_);
    
    if (!file_.is_open()) {
      open_file();
    }
    
    std::string log_line = entry.to_string() + "\n";
    
    // Check if we need to rotate
    if (current_size_ + log_line.size() > max_file_size_) {
      rotate_files();
    }
    
    file_ << log_line;
    file_.flush();
    current_size_ += log_line.size();
  }
  
  void flush() override {
    std::lock_guard<std::mutex> lock(mutex_);
    if (file_.is_open()) {
      file_.flush();
    }
  }
  
  void close() override {
    std::lock_guard<std::mutex> lock(mutex_);
    if (file_.is_open()) {
      file_.close();
    }
  }
  
private:
  std::string filepath_;
  size_t max_file_size_;
  int max_backup_files_;
  std::ofstream file_;
  std::mutex mutex_;
  size_t current_size_;
  
  void open_file() {
    file_.open(filepath_, std::ios::app);
    if (file_.is_open()) {
      // Get current file size
      file_.seekp(0, std::ios::end);
      current_size_ = file_.tellp();
    }
  }
  
  void rotate_files() {
    file_.close();
    
    // Rotate backup files
    for (int i = max_backup_files_ - 1; i >= 0; --i) {
      std::string old_file = i == 0 ? filepath_ : filepath_ + "." + std::to_string(i);
      std::string new_file = filepath_ + "." + std::to_string(i + 1);
      
      if (std::ifstream(old_file).good()) {
        std::rename(old_file.c_str(), new_file.c_str());
      }
    }
    
    // Open new file
    open_file();
  }
};

/**
 * @brief Logger class
 */
class Logger {
public:
  /**
   * @brief Get logger instance
   * @param name Logger name
   * @return Logger instance
   */
  static Logger& get_instance(const std::string& name = "default") {
    static std::unordered_map<std::string, std::shared_ptr<Logger>> instances;
    static std::mutex instances_mutex;
    
    std::lock_guard<std::mutex> lock(instances_mutex);
    
    auto it = instances.find(name);
    if (it != instances.end()) {
      return *it->second;
    }
    
    auto logger = std::make_shared<Logger>(name);
    instances[name] = logger;
    return *logger;
  }
  
  /**
   * @brief Constructor
   * @param name Logger name
   */
  Logger(const std::string& name) : name_(name), level_(LogLevel::INFO) {
    // Add default console sink
    add_sink(std::make_shared<ConsoleSink>());
  }
  
  /**
   * @brief Set log level
   * @param level Log level
   */
  void set_level(LogLevel level) {
    std::lock_guard<std::mutex> lock(mutex_);
    level_ = level;
  }
  
  /**
   * @brief Get current log level
   * @return Current log level
   */
  LogLevel get_level() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return level_;
  }
  
  /**
   * @brief Add log sink
   * @param sink Log sink
   */
  void add_sink(std::shared_ptr<LogSink> sink) {
    std::lock_guard<std::mutex> lock(mutex_);
    sinks_.push_back(sink);
  }
  
  /**
   * @brief Remove all sinks
   */
  void clear_sinks() {
    std::lock_guard<std::mutex> lock(mutex_);
    sinks_.clear();
  }
  
  /**
   * @brief Log message
   * @param level Log level
   * @param message Message to log
   * @param source Source file/function
   * @param line Line number
   */
  void log(LogLevel level, const std::string& message, 
          const std::string& source = "", int line = 0) {
    if (level < level_) {
      return;
    }
    
    LogEntry entry(level, message, source, line);
    
    std::lock_guard<std::mutex> lock(mutex_);
    for (auto& sink : sinks_) {
      sink->write(entry);
    }
  }
  
  /**
   * @brief Log trace message
   */
  void trace(const std::string& message, const std::string& source = "", int line = 0) {
    log(LogLevel::TRACE, message, source, line);
  }
  
  /**
   * @brief Log debug message
   */
  void debug(const std::string& message, const std::string& source = "", int line = 0) {
    log(LogLevel::DEBUG, message, source, line);
  }
  
  /**
   * @brief Log info message
   */
  void info(const std::string& message, const std::string& source = "", int line = 0) {
    log(LogLevel::INFO, message, source, line);
  }
  
  /**
   * @brief Log warning message
   */
  void warn(const std::string& message, const std::string& source = "", int line = 0) {
    log(LogLevel::WARN, message, source, line);
  }
  
  /**
   * @brief Log error message
   */
  void error(const std::string& message, const std::string& source = "", int line = 0) {
    log(LogLevel::ERROR, message, source, line);
  }
  
  /**
   * @brief Log fatal message
   */
  void fatal(const std::string& message, const std::string& source = "", int line = 0) {
    log(LogLevel::FATAL, message, source, line);
  }
  
  /**
   * @brief Flush all sinks
   */
  void flush() {
    std::lock_guard<std::mutex> lock(mutex_);
    for (auto& sink : sinks_) {
      sink->flush();
    }
  }
  
  /**
   * @brief Close all sinks
   */
  void close() {
    std::lock_guard<std::mutex> lock(mutex_);
    for (auto& sink : sinks_) {
      sink->close();
    }
  }
  
private:
  std::string name_;
  LogLevel level_;
  std::vector<std::shared_ptr<LogSink>> sinks_;
  mutable std::mutex mutex_;
};

// Convenience macros
#define LOG_TRACE(msg) logging::Logger::get_instance().trace(msg, __FILE__, __LINE__)
#define LOG_DEBUG(msg) logging::Logger::get_instance().debug(msg, __FILE__, __LINE__)
#define LOG_INFO(msg)  logging::Logger::get_instance().info(msg, __FILE__, __LINE__)
#define LOG_WARN(msg)  logging::Logger::get_instance().warn(msg, __FILE__, __LINE__)
#define LOG_ERROR(msg) logging::Logger::get_instance().error(msg, __FILE__, __LINE__)
#define LOG_FATAL(msg) logging::Logger::get_instance().fatal(msg, __FILE__, __LINE__)

} // namespace logging

#endif // LOGGER_H