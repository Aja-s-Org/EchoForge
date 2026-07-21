#ifndef RESOURCE_CLEANUP_H
#define RESOURCE_CLEANUP_H

#include <vector>
#include <string>
#include <memory>
#include <mutex>
#include <chrono>
#include <functional>
#include <unordered_map>
#include <queue>
#include "logger.h"

namespace resource {

/**
 * @brief Resource types
 */
enum class ResourceType {
  AUDIO_BUFFER,
  VOICE_EMBEDDING,
  MODEL_DATA,
  GPU_MEMORY,
  TEMP_FILE,
  NETWORK_CONNECTION,
  THREAD_POOL,
  CACHE_ENTRY,
  OTHER
};

/**
 * @brief Resource cleanup priority
 */
enum class CleanupPriority {
  CRITICAL,    // Must be cleaned up immediately
  HIGH,        // Should be cleaned up soon
  MEDIUM,      // Can be cleaned up when convenient
  LOW          // Can be cleaned up during idle time
};

/**
 * @brief Resource descriptor
 */
struct ResourceDescriptor {
  ResourceType type;
  std::string id;
  size_t size_bytes;
  CleanupPriority priority;
  std::chrono::steady_clock::time_point creation_time;
  std::chrono::steady_clock::time_point last_access_time;
  std::function<bool()> cleanup_function;
  std::function<void()> on_cleanup_callback;
  bool requires_confirmation;
  std::string description;
  
  ResourceDescriptor() : type(ResourceType::OTHER), size_bytes(0),
                        priority(CleanupPriority::MEDIUM),
                        requires_confirmation(false) {}
  
  ResourceDescriptor(ResourceType t, const std::string& i, size_t s,
                     CleanupPriority p, std::function<bool()> cf)
    : type(t), id(i), size_bytes(s), priority(p), creation_time(std::chrono::steady_clock::now()),
      last_access_time(creation_time), cleanup_function(cf), requires_confirmation(false) {}
  
  bool is_valid() const { return !id.empty() && cleanup_function; }
  
  void update_access() {
    last_access_time = std::chrono::steady_clock::now();
  }
  
  size_t get_age_ms() const {
    auto now = std::chrono::steady_clock::now();
    return std::chrono::duration_cast<std::chrono::milliseconds>(
      now - creation_time).count();
  }
  
  size_t get_idle_time_ms() const {
    auto now = std::chrono::steady_clock::now();
    return std::chrono::duration_cast<std::chrono::milliseconds>(
      now - last_access_time).count();
  }
};

/**
 * @brief Cleanup statistics
 */
struct CleanupStats {
  size_t total_resources_cleaned;
  size_t total_bytes_freed;
  size_t failed_cleanups;
  size_t pending_cleanups;
  std::chrono::milliseconds total_cleanup_time;
  std::chrono::steady_clock::time_point last_cleanup_time;
  
  CleanupStats() : total_resources_cleaned(0), total_bytes_freed(0),
                  failed_cleanups(0), pending_cleanups(0),
                  total_cleanup_time(0) {}
  
  void reset() {
    total_resources_cleaned = 0;
    total_bytes_freed = 0;
    failed_cleanups = 0;
    pending_cleanups = 0;
    total_cleanup_time = std::chrono::milliseconds(0);
  }
};

/**
 * @brief Cleanup policy configuration
 */
struct CleanupPolicyConfig {
  size_t max_idle_time_ms;           // Max idle time before cleanup
  size_t max_age_ms;                 // Max age before cleanup
  size_t max_total_memory_bytes;     // Max total memory before cleanup
  size_t cleanup_batch_size;         // Max resources to clean in one batch
  bool enable_auto_cleanup;          // Enable automatic cleanup
  size_t auto_cleanup_interval_ms;   // Auto cleanup interval
  bool cleanup_on_shutdown;          // Cleanup on process shutdown
  bool cleanup_on_low_memory;        // Cleanup when system memory is low
  float low_memory_threshold_percent; // Threshold for low memory cleanup
  
  CleanupPolicyConfig() : 
    max_idle_time_ms(5 * 60 * 1000),      // 5 minutes
    max_age_ms(30 * 60 * 1000),           // 30 minutes
    max_total_memory_bytes(2 * 1024 * 1024 * 1024), // 2 GB
    cleanup_batch_size(10),
    enable_auto_cleanup(true),
    auto_cleanup_interval_ms(30 * 1000),  // 30 seconds
    cleanup_on_shutdown(true),
    cleanup_on_low_memory(true),
    low_memory_threshold_percent(20.0f) {} // 20% free memory
};

/**
 * @brief Resource cleanup manager for voice cloning system
 */
class ResourceCleanupManager {
public:
  /**
   * @brief Get singleton instance
   * @return Reference to singleton instance
   */
  static ResourceCleanupManager& get_instance();
  
  /**
   * @brief Initialize cleanup manager
   * @param config Cleanup policy configuration
   * @return true if initialized successfully, false otherwise
   */
  bool initialize(const CleanupPolicyConfig& config = CleanupPolicyConfig());
  
  /**
   * @brief Register resource for cleanup tracking
   * @param resource Resource descriptor
   * @return true if registered successfully, false otherwise
   */
  bool register_resource(const ResourceDescriptor& resource);
  
  /**
   * @brief Unregister resource from cleanup tracking
   * @param resource_id Resource ID
   * @return true if unregistered successfully, false otherwise
   */
  bool unregister_resource(const std::string& resource_id);
  
  /**
   * @brief Update resource access time
   * @param resource_id Resource ID
   * @return true if updated successfully, false otherwise
   */
  bool update_resource_access(const std::string& resource_id);
  
  /**
   * @brief Cleanup specific resource
   * @param resource_id Resource ID
   * @param force Force cleanup even if requires confirmation
   * @return true if cleaned successfully, false otherwise
   */
  bool cleanup_resource(const std::string& resource_id, bool force = false);
  
  /**
   * @brief Cleanup resources by type
   * @param type Resource type
   * @param max_count Maximum number of resources to clean
   * @return Number of resources cleaned
   */
  size_t cleanup_resources_by_type(ResourceType type, size_t max_count = 0);
  
  /**
   * @brief Cleanup resources by priority
   * @param priority Cleanup priority
   * @param max_count Maximum number of resources to clean
   * @return Number of resources cleaned
   */
  size_t cleanup_resources_by_priority(CleanupPriority priority, size_t max_count = 0);
  
  /**
   * @brief Cleanup idle resources
   * @param max_idle_time_ms Maximum idle time in milliseconds
   * @param max_count Maximum number of resources to clean
   * @return Number of resources cleaned
   */
  size_t cleanup_idle_resources(size_t max_idle_time_ms = 0, size_t max_count = 0);
  
  /**
   * @brief Cleanup old resources
   * @param max_age_ms Maximum age in milliseconds
   * @param max_count Maximum number of resources to clean
   * @return Number of resources cleaned
   */
  size_t cleanup_old_resources(size_t max_age_ms = 0, size_t max_count = 0);
  
  /**
   * @brief Perform automatic cleanup based on policy
   * @return Number of resources cleaned
   */
  size_t perform_automatic_cleanup();
  
  /**
   * @brief Cleanup all resources (shutdown)
   * @param force Force cleanup even if requires confirmation
   * @return Number of resources cleaned
   */
  size_t cleanup_all_resources(bool force = false);
  
  /**
   * @brief Get cleanup statistics
   * @return Cleanup statistics
   */
  CleanupStats get_stats() const;
  
  /**
   * @brief Get resource count by type
   * @param type Resource type
   * @return Number of resources of specified type
   */
  size_t get_resource_count_by_type(ResourceType type) const;
  
  /**
   * @brief Get total memory usage by resource type
   * @param type Resource type
   * @return Total memory usage in bytes
   */
  size_t get_memory_usage_by_type(ResourceType type) const;
  
  /**
   * @brief Get total memory usage across all resources
   * @return Total memory usage in bytes
   */
  size_t get_total_memory_usage() const;
  
  /**
   * @brief Get pending cleanup count
   * @return Number of resources pending cleanup
   */
  size_t get_pending_cleanup_count() const;
  
  /**
   * @brief Check if resource exists
   * @param resource_id Resource ID
   * @return true if exists, false otherwise
   */
  bool has_resource(const std::string& resource_id) const;
  
  /**
   * @brief Get resource descriptor
   * @param resource_id Resource ID
   * @return Resource descriptor if exists, empty descriptor otherwise
   */
  ResourceDescriptor get_resource(const std::string& resource_id) const;
  
  /**
   * @brief Get all resource IDs
   * @return Vector of resource IDs
   */
  std::vector<std::string> get_all_resource_ids() const;
  
  /**
   * @brief Get resources by type
   * @param type Resource type
   * @return Vector of resource descriptors
   */
  std::vector<ResourceDescriptor> get_resources_by_type(ResourceType type) const;
  
  /**
   * @brief Update cleanup policy configuration
   * @param config New configuration
   * @return true if updated successfully, false otherwise
   */
  bool update_policy_config(const CleanupPolicyConfig& config);
  
  /**
   * @brief Get current cleanup policy configuration
   * @return Current configuration
   */
  CleanupPolicyConfig get_policy_config() const;
  
  /**
   * @brief Check if cleanup is needed based on policy
   * @return true if cleanup needed, false otherwise
   */
  bool is_cleanup_needed() const;
  
  /**
   * @brief Generate cleanup report
   * @param detailed Include detailed resource info
   * @return Report string
   */
  std::string generate_report(bool detailed = false) const;
  
  /**
   * @brief Set cleanup confirmation callback
   * @param callback Function to call when confirmation is required
   */
  void set_confirmation_callback(std::function<bool(const ResourceDescriptor&)> callback);
  
  /**
   * @brief Set low memory callback
   * @param callback Function to call when low memory is detected
   */
  void set_low_memory_callback(std::function<void()> callback);
  
  /**
   * @brief Perform shutdown cleanup
   * @return Number of resources cleaned during shutdown
   */
  size_t perform_shutdown_cleanup();
  
private:
  ResourceCleanupManager();
  ~ResourceCleanupManager();
  
  // Disable copying
  ResourceCleanupManager(const ResourceCleanupManager&) = delete;
  ResourceCleanupManager& operator=(const ResourceCleanupManager&) = delete;
  
  mutable std::mutex mutex_;
  std::unordered_map<std::string, ResourceDescriptor> resources_;
  CleanupStats stats_;
  CleanupPolicyConfig policy_config_;
  std::atomic<bool> initialized_;
  std::atomic<bool> shutdown_initiated_;
  std::chrono::steady_clock::time_point last_auto_cleanup_time_;
  
  // Callbacks
  std::function<bool(const ResourceDescriptor&)> confirmation_callback_;
  std::function<void()> low_memory_callback_;
  
  // Helper methods
  bool should_cleanup_resource(const ResourceDescriptor& resource) const;
  size_t cleanup_resources_internal(const std::vector<std::string>& resource_ids, bool force);
  std::vector<std::string> find_resources_to_cleanup() const;
  void check_low_memory_condition();
  
  // Auto cleanup thread
  std::thread auto_cleanup_thread_;
  std::atomic<bool> auto_cleanup_running_;
  std::condition_variable auto_cleanup_cv_;
  
  void auto_cleanup_thread_func();
  void start_auto_cleanup_thread();
  void stop_auto_cleanup_thread();
  
  // Get logger instance
  logging::Logger& get_logger() const {
    static logging::Logger& logger = logging::Logger::get_instance("resource_cleanup_manager");
    return logger;
  }
};

/**
 * @brief RAII wrapper for resource cleanup registration
 */
class ScopedResourceCleanup {
public:
  /**
   * @brief Constructor
   * @param resource Resource descriptor
   */
  explicit ScopedResourceCleanup(const ResourceDescriptor& resource);
  
  /**
   * @brief Destructor (automatically unregisters resource)
   */
  ~ScopedResourceCleanup();
  
  /**
   * @brief Update resource access time
   */
  void update_access();
  
  /**
   * @brief Get resource ID
   * @return Resource ID
   */
  std::string get_resource_id() const;
  
  /**
   * @brief Early cleanup of resource
   * @return true if cleaned successfully, false otherwise
   */
  bool cleanup_early();
  
  // Disable copying
  ScopedResourceCleanup(const ScopedResourceCleanup&) = delete;
  ScopedResourceCleanup& operator=(const ScopedResourceCleanup&) = delete;
  
  // Allow moving
  ScopedResourceCleanup(ScopedResourceCleanup&& other) noexcept;
  ScopedResourceCleanup& operator=(ScopedResourceCleanup&& other) noexcept;
  
private:
  std::string resource_id_;
  bool cleaned_;
  
  // Get cleanup manager instance
  static ResourceCleanupManager& get_cleanup_manager() {
    return ResourceCleanupManager::get_instance();
  }
};

/**
 * @brief Helper functions for common resource types
 */
namespace cleanup_helpers {
  
  /**
   * @brief Create audio buffer resource descriptor
   * @param buffer_id Buffer ID
   * @param buffer_ptr Pointer to audio buffer
   * @param buffer_size Buffer size in bytes
   * @param cleanup_function Function to clean up buffer
   * @return Resource descriptor
   */
  ResourceDescriptor create_audio_buffer_resource(
    const std::string& buffer_id,
    void* buffer_ptr,
    size_t buffer_size,
    std::function<bool()> cleanup_function);
  
  /**
   * @brief Create voice embedding resource descriptor
   * @param embedding_id Embedding ID
   * @param embedding_ptr Pointer to embedding data
   * @param embedding_size Embedding size in bytes
   * @param cleanup_function Function to clean up embedding
   * @return Resource descriptor
   */
  ResourceDescriptor create_voice_embedding_resource(
    const std::string& embedding_id,
    void* embedding_ptr,
    size_t embedding_size,
    std::function<bool()> cleanup_function);
  
  /**
   * @brief Create model data resource descriptor
   * @param model_id Model ID
   * @param model_ptr Pointer to model data
   * @param model_size Model size in bytes
   * @param cleanup_function Function to clean up model
   * @return Resource descriptor
   */
  ResourceDescriptor create_model_data_resource(
    const std::string& model_id,
    void* model_ptr,
    size_t model_size,
    std::function<bool()> cleanup_function);
  
  /**
   * @brief Create temporary file resource descriptor
   * @param filepath File path
   * @param file_size File size in bytes
   * @param cleanup_function Function to clean up file
   * @return Resource descriptor
   */
  ResourceDescriptor create_temp_file_resource(
    const std::string& filepath,
    size_t file_size,
    std::function<bool()> cleanup_function);
  
} // namespace cleanup_helpers

} // namespace resource

#endif // RESOURCE_CLEANUP_H