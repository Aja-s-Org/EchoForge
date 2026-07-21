#ifndef MEMORY_MONITOR_H
#define MEMORY_MONITOR_H

#include <string>
#include <unordered_map>
#include <vector>
#include <memory>
#include <mutex>
#include <chrono>
#include <functional>
#include <cstddef>

namespace memory {

/**
 * @brief Memory usage statistics for a component
 */
struct ComponentStats {
  std::string name;
  size_t current_bytes = 0;
  size_t peak_bytes = 0;
  size_t allocation_count = 0;
  size_t deallocation_count = 0;
  size_t total_allocated_bytes = 0;
  std::chrono::steady_clock::time_point last_allocation;
  std::chrono::steady_clock::time_point last_deallocation;
  
  // Derived metrics
  double average_allocation_size() const {
    if (allocation_count == 0) return 0.0;
    return static_cast<double>(total_allocated_bytes) / allocation_count;
  }
  
  size_t net_allocation() const {
    return total_allocated_bytes - (deallocation_count * average_allocation_size());
  }
  
  void update_allocation(size_t bytes) {
    current_bytes += bytes;
    total_allocated_bytes += bytes;
    allocation_count++;
    last_allocation = std::chrono::steady_clock::now();
    if (current_bytes > peak_bytes) {
      peak_bytes = current_bytes;
    }
  }
  
  void update_deallocation(size_t bytes) {
    if (current_bytes >= bytes) {
      current_bytes -= bytes;
    } else {
      current_bytes = 0;
    }
    deallocation_count++;
    last_deallocation = std::chrono::steady_clock::now();
  }
};

/**
 * @brief Memory limit configuration
 */
struct MemoryLimit {
  size_t warning_threshold_bytes = 0;
  size_t critical_threshold_bytes = 0;
  size_t hard_limit_bytes = 0;
  
  bool is_warning(size_t bytes) const {
    return warning_threshold_bytes > 0 && bytes >= warning_threshold_bytes;
  }
  
  bool is_critical(size_t bytes) const {
    return critical_threshold_bytes > 0 && bytes >= critical_threshold_bytes;
  }
  
  bool is_exceeded(size_t bytes) const {
    return hard_limit_bytes > 0 && bytes >= hard_limit_bytes;
  }
  
  double get_percentage(size_t bytes) const {
    if (hard_limit_bytes == 0) return 100.0;
    return (static_cast<double>(bytes) / hard_limit_bytes) * 100.0;
  }
};

/**
 * @brief Memory alert
 */
struct MemoryAlert {
  enum class Severity {
    INFO,
    WARNING,
    CRITICAL,
    FATAL
  };
  
  Severity severity;
  std::string component;
  std::string message;
  size_t current_bytes;
  size_t threshold_bytes;
  std::chrono::steady_clock::time_point timestamp;
  
  std::string severity_string() const {
    switch (severity) {
      case Severity::INFO: return "INFO";
      case Severity::WARNING: return "WARNING";
      case Severity::CRITICAL: return "CRITICAL";
      case Severity::FATAL: return "FATAL";
      default: return "UNKNOWN";
    }
  }
};

/**
 * @brief Memory cleanup callback
 */
using CleanupCallback = std::function<void(size_t target_bytes)>;

/**
 * @brief Real-time memory usage monitor
 * 
 * Tracks memory usage by component, enforces limits,
 * and triggers cleanup when needed.
 */
class MemoryMonitor {
public:
  /**
   * @brief Configuration for memory monitor
   */
  struct Config {
    // Global limits
    MemoryLimit global_limit;
    
    // Component-specific limits
    std::unordered_map<std::string, MemoryLimit> component_limits;
    
    // Alerting
    bool enable_alerts = true;
    size_t alert_cooldown_ms = 1000;  // Minimum time between alerts
    
    // Cleanup
    bool enable_auto_cleanup = true;
    size_t cleanup_threshold_percent = 80;  // Cleanup when >80% of limit
    size_t max_cleanup_attempts = 3;
    
    // Reporting
    bool enable_periodic_reports = false;
    size_t report_interval_ms = 60000;  // 1 minute
    
    // Performance tracking
    bool track_allocation_patterns = true;
    size_t pattern_window_size = 1000;  // Track last 1000 allocations
  };
  
  /**
   * @brief Constructor
   * @param config Monitor configuration
   */
  explicit MemoryMonitor(const Config& config = Config());
  
  /**
   * @brief Destructor
   */
  ~MemoryMonitor();
  
  /**
   * @brief Initialize the memory monitor
   * @return true if initialization succeeded, false otherwise
   */
  bool initialize();
  
  /**
   * @brief Track memory allocation for a component
   * @param component Component name
   * @param bytes Number of bytes allocated
   * @param source Optional source information (file:line)
   * @return true if allocation is allowed, false if limit exceeded
   */
  bool track_allocation(const std::string& component, size_t bytes, 
                       const std::string& source = "");
  
  /**
   * @brief Track memory deallocation for a component
   * @param component Component name
   * @param bytes Number of bytes deallocated
   */
  void track_deallocation(const std::string& component, size_t bytes);
  
  /**
   * @brief Register a component for monitoring
   * @param component Component name
   * @param limit Optional component-specific limit
   * @return true if registration succeeded, false otherwise
   */
  bool register_component(const std::string& component, 
                         const MemoryLimit& limit = MemoryLimit());
  
  /**
   * @brief Unregister a component from monitoring
   * @param component Component name
   */
  void unregister_component(const std::string& component);
  
  /**
   * @brief Get component statistics
   * @param component Component name
   * @return Component statistics, or empty stats if not found
   */
  ComponentStats get_component_stats(const std::string& component) const;
  
  /**
   * @brief Get all component statistics
   * @return Map of component name to statistics
   */
  std::unordered_map<std::string, ComponentStats> get_all_stats() const;
  
  /**
   * @brief Get global memory usage
   * @return Total memory usage across all components
   */
  size_t get_global_usage() const;
  
  /**
   * @brief Check if memory usage is within limits
   * @return true if within all limits, false otherwise
   */
  bool is_within_limits() const;
  
  /**
   * @brief Check if specific component is within limits
   * @param component Component name
   * @return true if within limits, false otherwise
   */
  bool is_component_within_limits(const std::string& component) const;
  
  /**
   * @brief Generate memory usage report
   * @param detailed Include detailed component information
   * @return Formatted report string
   */
  std::string generate_report(bool detailed = true) const;
  
  /**
   * @brief Generate memory alert report
   * @return Vector of current alerts
   */
  std::vector<MemoryAlert> get_alerts() const;
  
  /**
   * @brief Clear all alerts
   */
  void clear_alerts();
  
  /**
   * @brief Register cleanup callback
   * @param component Component name
   * @param callback Cleanup callback function
   * @return true if registration succeeded, false otherwise
   */
  bool register_cleanup_callback(const std::string& component,
                                CleanupCallback callback);
  
  /**
   * @brief Trigger manual cleanup for a component
   * @param component Component name
   * @param target_bytes Target memory reduction in bytes
   * @return Actual bytes freed
   */
  size_t trigger_cleanup(const std::string& component, size_t target_bytes);
  
  /**
   * @brief Check and trigger automatic cleanup if needed
   * @return true if cleanup was triggered, false otherwise
   */
  bool check_and_cleanup();
  
  /**
   * @brief Reset all statistics
   */
  void reset_statistics();
  
  /**
   * @brief Get monitor configuration
   * @return Current configuration
   */
  const Config& get_config() const { return config_; }
  
  /**
   * @brief Update monitor configuration
   * @param new_config New configuration
   * @return true if configuration updated successfully, false otherwise
   */
  bool update_config(const Config& new_config);
  
  /**
   * @brief Get peak memory usage
   * @return Peak memory usage in bytes
   */
  size_t get_peak_usage() const { return peak_usage_; }
  
private:
  Config config_;
  bool initialized_ = false;
  
  // Component tracking
  std::unordered_map<std::string, ComponentStats> component_stats_;
  std::unordered_map<std::string, MemoryLimit> component_limits_;
  std::unordered_map<std::string, CleanupCallback> cleanup_callbacks_;
  
  // Global tracking
  size_t global_usage_ = 0;
  size_t peak_usage_ = 0;
  size_t total_allocations_ = 0;
  size_t total_deallocations_ = 0;
  
  // Alert tracking
  std::vector<MemoryAlert> alerts_;
  std::unordered_map<std::string, std::chrono::steady_clock::time_point> last_alert_time_;
  
  // Thread safety
  mutable std::mutex mutex_;
  
  // Private methods
  bool check_limits(const std::string& component, size_t bytes);
  void add_alert(MemoryAlert::Severity severity, const std::string& component,
                const std::string& message, size_t bytes, size_t threshold);
  void check_for_alerts(const std::string& component, size_t bytes);
  void update_global_stats();
  void generate_periodic_report();
  
  // Cleanup management
  size_t perform_cleanup(const std::string& component, size_t target_bytes);
  void log_monitor_operation(const std::string& operation, 
                           const std::string& component, size_t bytes);
};

/**
 * @brief Singleton memory monitor instance
 */
class GlobalMemoryMonitor {
public:
  /**
   * @brief Get singleton instance
   * @return Reference to singleton instance
   */
  static GlobalMemoryMonitor& get_instance();
  
  /**
   * @brief Initialize global monitor
   * @param config Monitor configuration
   * @return true if initialization succeeded, false otherwise
   */
  bool initialize(const MemoryMonitor::Config& config = MemoryMonitor::Config());
  
  /**
   * @brief Get the memory monitor
   * @return Pointer to memory monitor, or nullptr if not initialized
   */
  MemoryMonitor* get_monitor();
  
  /**
   * @brief Check if monitor is initialized
   * @return true if initialized, false otherwise
   */
  bool is_initialized() const { return monitor_ != nullptr; }
  
  /**
   * @brief Shutdown the global monitor
   */
  void shutdown();
  
  /**
   * @brief Convenience method for tracking allocations
   */
  static bool track_allocation(const std::string& component, size_t bytes,
                              const std::string& source = "") {
    auto& instance = get_instance();
    if (auto monitor = instance.get_monitor()) {
      return monitor->track_allocation(component, bytes, source);
    }
    return true;  // Allow if monitor not initialized
  }
  
  /**
   * @brief Convenience method for tracking deallocations
   */
  static void track_deallocation(const std::string& component, size_t bytes) {
    auto& instance = get_instance();
    if (auto monitor = instance.get_monitor()) {
      monitor->track_deallocation(component, bytes);
    }
  }
  
private:
  GlobalMemoryMonitor() = default;
  ~GlobalMemoryMonitor();
  
  // Prevent copying
  GlobalMemoryMonitor(const GlobalMemoryMonitor&) = delete;
  GlobalMemoryMonitor& operator=(const GlobalMemoryMonitor&) = delete;
  
  std::unique_ptr<MemoryMonitor> monitor_;
};

/**
 * @brief RAII helper for tracking memory allocations
 */
class ScopedMemoryTracker {
public:
  /**
   * @brief Constructor - tracks allocation
   * @param component Component name
   * @param bytes Number of bytes allocated
   * @param source Optional source information
   */
  ScopedMemoryTracker(const std::string& component, size_t bytes,
                     const std::string& source = "")
    : component_(component), bytes_(bytes) {
    GlobalMemoryMonitor::track_allocation(component, bytes, source);
  }
  
  /**
   * @brief Destructor - tracks deallocation
   */
  ~ScopedMemoryTracker() {
    GlobalMemoryMonitor::track_deallocation(component_, bytes_);
  }
  
  // Prevent copying
  ScopedMemoryTracker(const ScopedMemoryTracker&) = delete;
  ScopedMemoryTracker& operator=(const ScopedMemoryTracker&) = delete;
  
  // Allow moving
  ScopedMemoryTracker(ScopedMemoryTracker&&) = default;
  ScopedMemoryTracker& operator=(ScopedMemoryTracker&&) = default;
  
private:
  std::string component_;
  size_t bytes_;
};

} // namespace memory

#endif // MEMORY_MONITOR_H