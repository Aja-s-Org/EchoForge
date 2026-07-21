#ifndef MEMORY_POOL_H
#define MEMORY_POOL_H

#include <memory>
#include <vector>
#include <mutex>
#include <queue>
#include <cstddef>
#include <string>

namespace memory {

/**
 * @brief Audio buffer wrapper with size information
 */
struct AudioBuffer {
  std::vector<float> data;
  size_t size_bytes;
  size_t capacity_bytes;
  
  AudioBuffer(size_t capacity = 0) 
    : size_bytes(0), capacity_bytes(capacity) {
    if (capacity > 0) {
      data.resize(capacity / sizeof(float));
    }
  }
  
  void resize(size_t new_capacity) {
    capacity_bytes = new_capacity;
    data.resize(new_capacity / sizeof(float));
  }
  
  size_t available() const { return capacity_bytes - size_bytes; }
};

/**
 * @brief Thread-safe memory pool for audio buffers
 * 
 * This pool manages pre-allocated audio buffers to reduce
 * memory fragmentation and allocation overhead.
 */
class AudioMemoryPool {
public:
  /**
   * @brief Configuration for memory pool
   */
  struct Config {
    size_t max_total_memory_mb = 128;  // Maximum pool size in MB
    size_t buffer_size_kb = 16;        // Size of each buffer in KB
    size_t initial_buffers = 64;       // Initial number of buffers
    bool enable_logging = true;        // Enable logging of pool operations
  };
  
  /**
   * @brief Constructor
   * @param config Pool configuration
   */
  explicit AudioMemoryPool(const Config& config = Config());
  
  /**
   * @brief Destructor - frees all buffers
   */
  ~AudioMemoryPool();
  
  /**
   * @brief Initialize the memory pool
   * @return true if initialization succeeded, false otherwise
   */
  bool initialize();
  
  /**
   * @brief Allocate an audio buffer from the pool
   * @param size_bytes Required buffer size in bytes
   * @return Shared pointer to audio buffer, or nullptr if allocation failed
   */
  std::shared_ptr<AudioBuffer> allocate(size_t size_bytes);
  
  /**
   * @brief Return a buffer to the pool
   * @param buffer Buffer to return
   */
  void deallocate(const std::shared_ptr<AudioBuffer>& buffer);
  
  /**
   * @brief Get current statistics
   */
  struct Statistics {
    size_t total_buffers;          // Total buffers in pool
    size_t allocated_buffers;      // Currently allocated buffers
    size_t free_buffers;           // Currently free buffers
    size_t total_memory_bytes;     // Total memory managed by pool
    size_t used_memory_bytes;      // Memory currently in use
    size_t allocation_count;       // Total allocations
    size_t deallocation_count;     // Total deallocations
    size_t hit_count;              // Times buffer was available in pool
    size_t miss_count;             // Times new buffer had to be created
    size_t eviction_count;         // Times buffer was evicted (freed)
    
    double hit_rate() const {
      if (allocation_count == 0) return 0.0;
      return static_cast<double>(hit_count) / allocation_count;
    }
    
    double usage_rate() const {
      if (total_memory_bytes == 0) return 0.0;
      return static_cast<double>(used_memory_bytes) / total_memory_bytes;
    }
  };
  
  /**
   * @brief Get pool statistics
   * @return Current pool statistics
   */
  Statistics get_statistics() const;
  
  /**
   * @brief Clear all buffers from pool
   */
  void clear();
  
  /**
   * @brief Check if pool is initialized
   * @return true if initialized, false otherwise
   */
  bool is_initialized() const { return initialized_; }
  
  /**
   * @brief Get pool configuration
   * @return Current configuration
   */
  const Config& get_config() const { return config_; }
  
  /**
   * @brief Update pool configuration
   * @param new_config New configuration
   * @return true if configuration updated successfully, false otherwise
   */
  bool update_config(const Config& new_config);
  
private:
  Config config_;
  bool initialized_ = false;
  
  // Pool storage
  std::vector<std::shared_ptr<AudioBuffer>> buffers_;
  std::queue<std::shared_ptr<AudioBuffer>> free_buffers_;
  
  // Statistics
  mutable Statistics stats_;
  
  // Thread safety
  mutable std::mutex mutex_;
  
  // Private methods
  std::shared_ptr<AudioBuffer> create_buffer(size_t size_bytes);
  void cleanup_expired_buffers();
  void update_statistics_hit(bool hit);
  void log_pool_operation(const std::string& operation, size_t size_bytes);
};

/**
 * @brief Singleton manager for memory pools
 */
class MemoryPoolManager {
public:
  /**
   * @brief Get singleton instance
   * @return Reference to singleton instance
   */
  static MemoryPoolManager& get_instance();
  
  /**
   * @brief Create a named memory pool
   * @param name Pool name
   * @param config Pool configuration
   * @return Shared pointer to created pool, or nullptr if failed
   */
  std::shared_ptr<AudioMemoryPool> create_pool(
    const std::string& name,
    const AudioMemoryPool::Config& config = AudioMemoryPool::Config());
  
  /**
   * @brief Get a named memory pool
   * @param name Pool name
   * @return Shared pointer to pool, or nullptr if not found
   */
  std::shared_ptr<AudioMemoryPool> get_pool(const std::string& name);
  
  /**
   * @brief Destroy a named memory pool
   * @param name Pool name
   * @return true if pool destroyed, false if not found
   */
  bool destroy_pool(const std::string& name);
  
  /**
   * @brief Get all pool names
   * @return Vector of pool names
   */
  std::vector<std::string> get_pool_names() const;
  
  /**
   * @brief Get global memory statistics
   * @return Combined statistics from all pools
   */
  AudioMemoryPool::Statistics get_global_statistics() const;
  
  /**
   * @brief Clear all pools
   */
  void clear_all_pools();
  
  /**
   * @brief Check memory usage against global limits
   * @param limit_mb Memory limit in MB
   * @return true if within limits, false if exceeded
   */
  bool check_memory_limit(size_t limit_mb) const;
  
private:
  MemoryPoolManager() = default;
  ~MemoryPoolManager() = default;
  
  // Prevent copying
  MemoryPoolManager(const MemoryPoolManager&) = delete;
  MemoryPoolManager& operator=(const MemoryPoolManager&) = delete;
  
  // Pool storage
  std::unordered_map<std::string, std::shared_ptr<AudioMemoryPool>> pools_;
  mutable std::mutex mutex_;
  
  // Global configuration
  size_t global_memory_limit_mb_ = 1024;  // 1GB default
};

} // namespace memory

#endif // MEMORY_POOL_H