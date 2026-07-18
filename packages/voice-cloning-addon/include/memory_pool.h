#ifndef MEMORY_POOL_H
#define MEMORY_POOL_H

#include <vector>
#include <memory>
#include <mutex>
#include <atomic>
#include <functional>
#include <iostream>
#include <queue>
#include <unordered_map>
#include "logger.h"

namespace memory {

/**
 * @brief Memory pool statistics
 */
struct PoolStats {
  size_t total_allocated;
  size_t total_freed;
  size_t current_usage;
  size_t peak_usage;
  size_t allocation_count;
  size_t free_count;
  size_t cache_hits;
  size_t cache_misses;
  
  PoolStats() : total_allocated(0), total_freed(0), current_usage(0),
               peak_usage(0), allocation_count(0), free_count(0),
               cache_hits(0), cache_misses(0) {}
  
  void reset() {
    total_allocated = 0;
    total_freed = 0;
    current_usage = 0;
    peak_usage = 0;
    allocation_count = 0;
    free_count = 0;
    cache_hits = 0;
    cache_misses = 0;
  }
};

/**
 * @brief Memory block descriptor
 */
struct MemoryBlock {
  void* ptr;
  size_t size;
  size_t alignment;
  bool in_use;
  std::chrono::steady_clock::time_point allocated_time;
  
  MemoryBlock() : ptr(nullptr), size(0), alignment(0), in_use(false) {}
  MemoryBlock(void* p, size_t s, size_t a) : 
    ptr(p), size(s), alignment(a), in_use(true) {
    allocated_time = std::chrono::steady_clock::now();
  }
  
  bool is_valid() const { return ptr != nullptr; }
  
  size_t get_age_ms() const {
    auto now = std::chrono::steady_clock::now();
    return std::chrono::duration_cast<std::chrono::milliseconds>(
      now - allocated_time).count();
  }
};

/**
 * @brief Audio buffer memory pool for efficient audio data management
 */
class AudioBufferPool {
public:
  /**
   * @brief Constructor
   * @param max_pool_size Maximum total size of pool in bytes
   * @param preallocate_size Size to preallocate in bytes
   */
  explicit AudioBufferPool(size_t max_pool_size = 256 * 1024 * 1024, // 256 MB
                           size_t preallocate_size = 64 * 1024 * 1024); // 64 MB
  
  /**
   * @brief Destructor
   */
  ~AudioBufferPool();
  
  /**
   * @brief Allocate audio buffer
   * @param size Size in bytes
   * @param alignment Memory alignment (must be power of 2)
   * @return Pointer to allocated memory, or nullptr if failed
   */
  void* allocate(size_t size, size_t alignment = 64);
  
  /**
   * @brief Free audio buffer
   * @param ptr Pointer to memory to free
   * @return true if successful, false otherwise
   */
  bool free(void* ptr);
  
  /**
   * @brief Allocate aligned audio buffer for float samples
   * @param num_samples Number of float samples
   * @param channels Number of channels
   * @return Pointer to allocated float array, or nullptr if failed
   */
  float* allocate_audio_buffer(size_t num_samples, size_t channels = 1);
  
  /**
   * @brief Free audio buffer allocated with allocate_audio_buffer
   * @param buffer Pointer to float buffer to free
   * @return true if successful, false otherwise
   */
  bool free_audio_buffer(float* buffer);
  
  /**
   * @brief Get pool statistics
   * @return Pool statistics
   */
  PoolStats get_stats() const;
  
  /**
   * @brief Clear all memory blocks in pool
   */
  void clear();
  
  /**
   * @brief Get current memory usage in bytes
   * @return Current usage
   */
  size_t get_current_usage() const;
  
  /**
   * @brief Get peak memory usage in bytes
   * @return Peak usage
   */
  size_t get_peak_usage() const;
  
  /**
   * @brief Check if pool has capacity for allocation
   * @param size Size in bytes
   * @return true if can allocate, false otherwise
   */
  bool can_allocate(size_t size) const;
  
  /**
   * @brief Set maximum pool size
   * @param max_size Maximum size in bytes
   */
  void set_max_pool_size(size_t max_size);
  
  /**
   * @brief Get maximum pool size
   * @return Maximum size in bytes
   */
  size_t get_max_pool_size() const;
  
  /**
   * @brief Collect unused memory blocks
   * @return Number of blocks collected
   */
  size_t collect_garbage();
  
  /**
   * @brief Enable/disable pooling
   * @param enabled true to enable, false to disable
   */
  void set_enabled(bool enabled);
  
  /**
   * @brief Check if pooling is enabled
   * @return true if enabled, false otherwise
   */
  bool is_enabled() const;
  
  /**
   * @brief Set callback for allocation failure
   * @param callback Function to call when allocation fails
   */
  void set_allocation_failure_callback(std::function<void(size_t)> callback);
  
private:
  struct BlockDescriptor {
    size_t size;
    size_t alignment;
    bool in_use;
    std::chrono::steady_clock::time_point allocated_time;
  };
  
  mutable std::mutex mutex_;
  std::unordered_map<void*, BlockDescriptor> blocks_;
  std::queue<void*> free_blocks_;  // LRU queue of freed blocks
  PoolStats stats_;
  size_t max_pool_size_;
  size_t preallocated_size_;
  std::vector<std::unique_ptr<char[]>> preallocated_blocks_;
  bool enabled_;
  std::function<void(size_t)> allocation_failure_callback_;
  
  // Helper methods
  void* allocate_from_system(size_t size, size_t alignment);
  void free_to_system(void* ptr);
  void* reuse_block(size_t size, size_t alignment);
  void update_stats_allocated(size_t size);
  void update_stats_freed(size_t size);
  
  // Get logger instance
  logging::Logger& get_logger() const {
    static logging::Logger& logger = logging::Logger::get_instance("audio_buffer_pool");
    return logger;
  }
};

/**
 * @brief Singleton manager for audio buffer pools
 */
class AudioBufferPoolManager {
public:
  /**
   * @brief Get singleton instance
   * @return Reference to singleton instance
   */
  static AudioBufferPoolManager& get_instance();
  
  /**
   * @brief Get default audio buffer pool
   * @return Reference to default audio buffer pool
   */
  AudioBufferPool& get_default_pool();
  
  /**
   * @brief Create named audio buffer pool
   * @param name Pool name
   * @param max_pool_size Maximum pool size in bytes
   * @param preallocate_size Preallocation size in bytes
   * @return Reference to created pool
   */
  AudioBufferPool& create_pool(const std::string& name, 
                               size_t max_pool_size = 256 * 1024 * 1024,
                               size_t preallocate_size = 64 * 1024 * 1024);
  
  /**
   * @brief Get named audio buffer pool
   * @param name Pool name
   * @return Reference to pool if exists, throws std::runtime_error otherwise
   */
  AudioBufferPool& get_pool(const std::string& name);
  
  /**
   * @brief Check if named pool exists
   * @param name Pool name
   * @return true if exists, false otherwise
   */
  bool has_pool(const std::string& name) const;
  
  /**
   * @brief Destroy named audio buffer pool
   * @param name Pool name
   * @return true if destroyed, false if pool didn't exist
   */
  bool destroy_pool(const std::string& name);
  
  /**
   * @brief Get all pool names
   * @return Vector of pool names
   */
  std::vector<std::string> get_pool_names() const;
  
  /**
   * @brief Get total memory usage across all pools
   * @return Total usage in bytes
   */
  size_t get_total_memory_usage() const;
  
  /**
   * @brief Get peak memory usage across all pools
   * @return Peak usage in bytes
   */
  size_t get_peak_memory_usage() const;
  
  /**
   * @brief Clear all pools
   */
  void clear_all_pools();
  
  /**
   * @brief Collect garbage from all pools
   * @return Total number of blocks collected
   */
  size_t collect_garbage_all_pools();
  
  /**
   * @brief Set global memory limit
   * @param limit Memory limit in bytes
   */
  void set_global_memory_limit(size_t limit);
  
  /**
   * @brief Get global memory limit
   * @return Memory limit in bytes
   */
  size_t get_global_memory_limit() const;
  
  /**
   * @brief Check if global memory limit is exceeded
   * @return true if exceeded, false otherwise
   */
  bool is_global_memory_limit_exceeded() const;
  
private:
  AudioBufferPoolManager();
  ~AudioBufferPoolManager();
  
  // Disable copying
  AudioBufferPoolManager(const AudioBufferPoolManager&) = delete;
  AudioBufferPoolManager& operator=(const AudioBufferPoolManager&) = delete;
  
  mutable std::mutex mutex_;
  std::unordered_map<std::string, std::unique_ptr<AudioBufferPool>> pools_;
  std::unique_ptr<AudioBufferPool> default_pool_;
  size_t global_memory_limit_;
  
  // Get logger instance
  logging::Logger& get_logger() const {
    static logging::Logger& logger = logging::Logger::get_instance("audio_buffer_pool_manager");
    return logger;
  }
};

} // namespace memory

#endif // MEMORY_POOL_H