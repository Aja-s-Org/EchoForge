#ifndef MEMORY_MONITOR_H
#define MEMORY_MONITOR_H

#include <vector>
#include <string>
#include <memory>
#include <mutex>
#include <chrono>
#include <atomic>
#include <functional>
#include <unordered_map>
#include "logger.h"

namespace memory {

/**
 * @brief Memory usage statistics for a component
 */
struct ComponentMemoryStats {
  std::string component_name;
  size_t current_usage;
  size_t peak_usage;
  size_t allocation_count;
  size_t free_count;
  size_t leak_count;
  std::chrono::steady_clock::time_point last_update;
  
  ComponentMemoryStats() : component_name(""), current_usage(0), peak_usage(0),
                          allocation_count(0), free_count(0), leak_count(0) {}
  
  ComponentMemoryStats(const std::string& name) : component_name(name),
    current_usage(0), peak_usage(0), allocation_count(0), free_count(0),
    leak_count(0) {
    last_update = std::chrono::steady_clock::now();
  }
  
  void update_peak() {
    if (current_usage > peak_usage) {
      peak_usage = current_usage;
    }
  }
  
  void reset() {
    current_usage = 0;
    peak_usage = 0;
    allocation_count = 0;
    free_count = 0;
    leak_count = 0;
    last_update = std::chrono::steady_clock::now();
  }
  
  bool has_leaks() const {
    return allocation_count > free_count;
  }
  
  size_t estimated_leak_size() const {
    if (allocation_count > free_count) {
      return (allocation_count - free_count) * (current_usage / (allocation_count > 0 ? allocation_count : 1));
    }
    return 0;
  }
};

/**
 * @brief Memory usage trend analysis
 */
struct MemoryTrend {
  std::vector<size_t> usage_samples;
  std::vector<std::chrono::steady_clock::time_point> sample_times;
  double growth_rate_per_minute;
  size_t predicted_peak_in_minutes;
  bool is_stable;
  bool is_growing;
  
  MemoryTrend() : growth_rate_per_minute(0.0), 
                 predicted_peak_in_minutes(0),
                 is_stable(false), is_growing(false) {}
  
  void clear() {
    usage_samples.clear();
    sample_times.clear();
    growth_rate_per_minute = 0.0;
    predicted_peak_in_minutes = 0;
    is_stable = false;
    is_growing = false;
  }
  
  void add_sample(size_t usage) {
    usage_samples.push_back(usage);
    sample_times.push_back(std::chrono::steady_clock::now());
    
    // Keep only last 100 samples
    if (usage_samples.size() > 100) {
      usage_samples.erase(usage_samples.begin());
      sample_times.erase(sample_times.begin());
    }
    
    update_trend_analysis();
  }
  
  void update_trend_analysis() {
    if (usage_samples.size() < 2) {
      growth_rate_per_minute = 0.0;
      predicted_peak_in_minutes = 0;
      is_stable = true;
      is_growing = false;
      return;
    }
    
    // Calculate growth rate
    size_t num_samples = usage_samples.size();
    size_t first = usage_samples[0];
    size_t last = usage_samples[num_samples - 1];
    
    auto time_diff = std::chrono::duration_cast<std::chrono::minutes>(
      sample_times[num_samples - 1] - sample_times[0]).count();
    
    if (time_diff > 0) {
      growth_rate_per_minute = static_cast<double>(last - first) / time_diff;
    } else {
      growth_rate_per_minute = 0.0;
    }
    
    // Determine if stable or growing
    is_growing = growth_rate_per_minute > 100.0;  // > 100 bytes/minute
    is_stable = std::abs(growth_rate_per_minute) < 10.0;  // < 10 bytes/minute
    
    // Predict when we might hit a limit (assuming 2GB limit)
    if (is_growing && growth_rate_per_minute > 0.0) {
      size_t limit = 2 * 1024 * 1024 * 1024;  // 2GB
      if (last < limit) {
        predicted_peak_in_minutes = static_cast<size_t>((limit - last) / growth_rate_per_minute);
      } else {
        predicted_peak_in_minutes = 0;
      }
    } else {
      predicted_peak_in_minutes = 0;
    }
  }
};

/**
 * @brief Memory alert configuration
 */
struct MemoryAlertConfig {
  size_t warning_threshold_bytes;
  size_t critical_threshold_bytes;
  size_t check_interval_ms;
  size_t consecutive_checks_for_alert;
  std::function<void(const std::string&, size_t)> warning_callback;
  std::function<void(const std::string&, size_t)> critical_callback;
  
  MemoryAlertConfig() : 
    warning_threshold_bytes(1024 * 1024 * 1024),  // 1 GB
    critical_threshold_bytes(1536 * 1024 * 1024), // 1.5 GB
    check_interval_ms(5000),                      // 5 seconds
    consecutive_checks_for_alert(3) {}
};

/**
 * @brief Memory alert state
 */
struct MemoryAlertState {
  bool warning_active;
  bool critical_active;
  size_t consecutive_warning_checks;
  size_t consecutive_critical_checks;
  std::chrono::steady_clock::time_point last_warning_time;
  std::chrono::steady_clock::time_point last_critical_time;
  
  MemoryAlertState() : warning_active(false), critical_active(false),
                      consecutive_warning_checks(0), consecutive_critical_checks(0) {}
  
  void reset() {
    warning_active = false;
    critical_active = false;
    consecutive_warning_checks = 0;
    consecutive_critical_checks = 0;
  }
};

/**
 * @brief System-wide memory monitor for voice cloning components
 */
class MemoryMonitor {
public:
  /**
   * @brief Get singleton instance
   * @return Reference to singleton instance
   */
  static MemoryMonitor& get_instance();
  
  /**
   * @brief Initialize memory monitor
   * @param config Alert configuration
   * @return true if initialized successfully, false otherwise
   */
  bool initialize(const MemoryAlertConfig& config = MemoryAlertConfig());
  
  /**
   * @brief Register component for memory monitoring
   * @param component_name Name of component
   * @return true if registered successfully, false otherwise
   */
  bool register_component(const std::string& component_name);
  
  /**
   * @brief Unregister component from memory monitoring
   * @param component_name Name of component
   * @return true if unregistered successfully, false otherwise
   */
  bool unregister_component(const std::string& component_name);
  
  /**
   * @brief Update memory usage for component
   * @param component_name Name of component
   * @param delta_bytes Change in memory usage (positive for allocation, negative for free)
   * @return true if updated successfully, false otherwise
   */
  bool update_component_usage(const std::string& component_name, ssize_t delta_bytes);
  
  /**
   * @brief Set component usage directly
   * @param component_name Name of component
   * @param usage_bytes Current memory usage
   * @return true if set successfully, false otherwise
   */
  bool set_component_usage(const std::string& component_name, size_t usage_bytes);
  
  /**
   * @brief Get component memory statistics
   * @param component_name Name of component
   * @return Component memory stats
   */
  ComponentMemoryStats get_component_stats(const std::string& component_name) const;
  
  /**
   * @brief Get all component statistics
   * @return Vector of component stats
   */
  std::vector<ComponentMemoryStats> get_all_component_stats() const;
  
  /**
   * @brief Get total memory usage across all components
   * @return Total memory usage in bytes
   */
  size_t get_total_memory_usage() const;
  
  /**
   * @brief Get peak memory usage across all components
   * @return Peak memory usage in bytes
   */
  size_t get_peak_memory_usage() const;
  
  /**
   * @brief Get memory trend analysis
   * @return Memory trend analysis
   */
  MemoryTrend get_memory_trend() const;
  
  /**
   * @brief Check for memory leaks
   * @return Vector of components with suspected leaks
   */
  std::vector<std::string> check_for_leaks() const;
  
  /**
   * @brief Perform periodic memory check
   * @return true if check performed, false otherwise
   */
  bool perform_periodic_check();
  
  /**
   * @brief Get alert configuration
   * @return Current alert configuration
   */
  MemoryAlertConfig get_alert_config() const;
  
  /**
   * @brief Update alert configuration
   * @param config New configuration
   * @return true if updated successfully, false otherwise
   */
  bool update_alert_config(const MemoryAlertConfig& config);
  
  /**
   * @brief Check if any alerts are active
   * @return true if alerts active, false otherwise
   */
  bool has_active_alerts() const;
  
  /**
   * @brief Get active alerts
   * @return Vector of alert messages
   */
  std::vector<std::string> get_active_alerts() const;
  
  /**
   * @brief Clear all alerts
   */
  void clear_alerts();
  
  /**
   * @brief Generate memory usage report
   * @param detailed Include detailed component info
   * @return Report string
   */
  std::string generate_report(bool detailed = false) const;
  
  /**
   * @brief Save memory usage history to file
   * @param filepath Path to save file
   * @return true if saved successfully, false otherwise
   */
  bool save_history_to_file(const std::string& filepath) const;
  
  /**
   * @brief Load memory usage history from file
   * @param filepath Path to load file from
   * @return true if loaded successfully, false otherwise
   */
  bool load_history_from_file(const std::string& filepath);
  
  /**
   * @brief Reset all statistics
   */
  void reset_statistics();
  
  /**
   * @brief Get system memory info (platform-specific)
   * @param total_memory Output: total system memory in bytes
   * @param free_memory Output: free system memory in bytes
   * @param process_memory Output: process memory usage in bytes
   * @return true if info retrieved successfully, false otherwise
   */
  static bool get_system_memory_info(size_t& total_memory, 
                                     size_t& free_memory,
                                     size_t& process_memory);
  
  /**
   * @brief Get GPU memory info (if available)
   * @param total_memory Output: total GPU memory in bytes
   * @param free_memory Output: free GPU memory in bytes
   * @param used_memory Output: used GPU memory in bytes
   * @return true if GPU info retrieved successfully, false otherwise
   */
  static bool get_gpu_memory_info(size_t& total_memory,
                                  size_t& free_memory,
                                  size_t& used_memory);
  
  /**
   * @brief Check if system memory is low
   * @param threshold_percent Threshold percentage (0-100)
   * @return true if memory is low, false otherwise
   */
  static bool is_system_memory_low(float threshold_percent = 10.0f);
  
  /**
   * @brief Check if GPU memory is low
   * @param threshold_percent Threshold percentage (0-100)
   * @return true if GPU memory is low, false otherwise
   */
  static bool is_gpu_memory_low(float threshold_percent = 10.0f);
  
  /**
   * @brief Force garbage collection (calls system malloc_trim if available)
   * @return Amount of memory reclaimed in bytes
   */
  static size_t force_garbage_collection();
  
private:
  MemoryMonitor();
  ~MemoryMonitor();
  
  // Disable copying
  MemoryMonitor(const MemoryMonitor&) = delete;
  MemoryMonitor& operator=(const MemoryMonitor&) = delete;
  
  mutable std::mutex mutex_;
  std::unordered_map<std::string, ComponentMemoryStats> component_stats_;
  MemoryTrend global_trend_;
  MemoryAlertConfig alert_config_;
  MemoryAlertState alert_state_;
  std::chrono::steady_clock::time_point last_check_time_;
  std::atomic<bool> initialized_;
  std::atomic<bool> monitoring_active_;
  
  // History for reporting
  struct HistoryEntry {
    std::chrono::steady_clock::time_point timestamp;
    size_t total_usage;
    std::unordered_map<std::string, size_t> component_usages;
  };
  
  std::vector<HistoryEntry> history_;
  
  // Helper methods
  void update_global_trend();
  void check_alerts();
  void trigger_warning_alert(size_t current_usage);
  void trigger_critical_alert(size_t current_usage);
  void clear_warning_alert();
  void clear_critical_alert();
  void add_history_entry();
  
  // Get logger instance
  logging::Logger& get_logger() const {
    static logging::Logger& logger = logging::Logger::get_instance("memory_monitor");
    return logger;
  }
};

/**
 * @brief RAII wrapper for tracking memory allocations
 */
class MemoryTracker {
public:
  /**
   * @brief Constructor
   * @param component_name Name of component being tracked
   * @param allocation_size Size of allocation in bytes
   */
  MemoryTracker(const std::string& component_name, size_t allocation_size);
  
  /**
   * @brief Destructor (automatically frees tracked memory)
   */
  ~MemoryTracker();
  
  /**
   * @brief Update allocation size
   * @param new_size New allocation size in bytes
   */
  void update_size(size_t new_size);
  
  /**
   * @brief Get tracked component name
   * @return Component name
   */
  std::string get_component_name() const;
  
  /**
   * @brief Get current allocation size
   * @return Allocation size in bytes
   */
  size_t get_allocation_size() const;
  
  /**
   * @brief Manually free tracked memory (called automatically by destructor)
   */
  void free();
  
  // Disable copying
  MemoryTracker(const MemoryTracker&) = delete;
  MemoryTracker& operator=(const MemoryTracker&) = delete;
  
  // Allow moving
  MemoryTracker(MemoryTracker&& other) noexcept;
  MemoryTracker& operator=(MemoryTracker&& other) noexcept;
  
private:
  std::string component_name_;
  size_t allocation_size_;
  bool freed_;
  
  // Get memory monitor instance
  static MemoryMonitor& get_memory_monitor() {
    return MemoryMonitor::get_instance();
  }
};

/**
 * @brief Scope-based memory tracking
 */
class ScopedMemoryTracker {
public:
  /**
   * @brief Constructor
   * @param component_name Name of component
   * @param allocation_size Size of allocation in bytes
   */
  ScopedMemoryTracker(const std::string& component_name, size_t allocation_size);
  
  /**
   * @brief Destructor (automatically tracks free)
   */
  ~ScopedMemoryTracker();
  
  /**
   * @brief Update allocation size
   * @param new_size New allocation size in bytes
   */
  void update_size(size_t new_size);
  
  // Disable copying
  ScopedMemoryTracker(const ScopedMemoryTracker&) = delete;
  ScopedMemoryTracker& operator=(const ScopedMemoryTracker&) = delete;
  
  // Allow moving
  ScopedMemoryTracker(ScopedMemoryTracker&& other) noexcept;
  ScopedMemoryTracker& operator=(ScopedMemoryTracker&& other) noexcept;
  
private:
  std::unique_ptr<MemoryTracker> tracker_;
};

} // namespace memory

#endif // MEMORY_MONITOR_H