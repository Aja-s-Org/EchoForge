#include "memory_pool.h"
#include <cstdlib>
#include <cstring>
#include <algorithm>
#include <stdexcept>
#include <sstream>
#include <iomanip>
#include <cmath>

#ifdef _WIN32
#include <malloc.h>
#else
#include <cstdlib>
#endif

namespace memory {

// AudioBufferPool implementation

AudioBufferPool::AudioBufferPool(size_t max_pool_size, size_t preallocate_size)
  : max_pool_size_(max_pool_size), preallocated_size_(preallocate_size),
    enabled_(true), allocation_failure_callback_(nullptr) {
  
  get_logger().info("Creating AudioBufferPool with max size: " + 
                   std::to_string(max_pool_size) + " bytes");
  
  // Preallocate blocks if requested
  if (preallocated_size_ > 0 && preallocated_size_ <= max_pool_size_) {
    try {
      size_t block_size = 1024 * 1024;  // 1 MB blocks
      size_t num_blocks = preallocated_size_ / block_size;
      
      for (size_t i = 0; i < num_blocks; ++i) {
        auto block = std::make_unique<char[]>(block_size);
        void* ptr = block.get();
        free_blocks_.push(ptr);
        preallocated_blocks_.push_back(std::move(block));
        
        BlockDescriptor desc;
        desc.size = block_size;
        desc.alignment = 1;  // Default alignment for preallocated blocks
        desc.in_use = false;
        blocks_[ptr] = desc;
        
        get_logger().debug("Preallocated block " + std::to_string(i + 1) + 
                          "/" + std::to_string(num_blocks) + 
                          " (" + std::to_string(block_size) + " bytes)");
      }
      
      get_logger().info("Preallocated " + std::to_string(num_blocks) + 
                       " blocks (" + std::to_string(preallocated_size_) + " bytes total)");
    } catch (const std::bad_alloc& e) {
      get_logger().warn("Failed to preallocate blocks: " + std::string(e.what()));
    }
  }
}

AudioBufferPool::~AudioBufferPool() {
  std::lock_guard<std::mutex> lock(mutex_);
  
  // Free all allocated blocks
  size_t leaked_count = 0;
  size_t leaked_size = 0;
  
  for (auto& pair : blocks_) {
    if (pair.second.in_use) {
      leaked_count++;
      leaked_size += pair.second.size;
      free_to_system(pair.first);
    }
  }
  
  blocks_.clear();
  free_blocks_ = std::queue<void*>();
  preallocated_blocks_.clear();
  
  if (leaked_count > 0) {
    get_logger().warn("AudioBufferPool destroyed with " + 
                     std::to_string(leaked_count) + 
                     " leaked blocks (" + 
                     std::to_string(leaked_size) + " bytes)");
  }
  
  get_logger().info("AudioBufferPool destroyed");
}

void* AudioBufferPool::allocate(size_t size, size_t alignment) {
  if (!enabled_ || size == 0) {
    return nullptr;
  }
  
  std::lock_guard<std::mutex> lock(mutex_);
  
  // Check if we have capacity
  if (!can_allocate(size)) {
    get_logger().warn("Cannot allocate " + std::to_string(size) + 
                     " bytes: pool capacity exceeded");
    if (allocation_failure_callback_) {
      allocation_failure_callback_(size);
    }
    return nullptr;
  }
  
  // Try to reuse existing block first
  void* ptr = reuse_block(size, alignment);
  if (ptr) {
    update_stats_allocated(size);
    get_logger().debug("Reused block for " + std::to_string(size) + 
                      " bytes (alignment: " + std::to_string(alignment) + ")");
    return ptr;
  }
  
  // Allocate new block
  ptr = allocate_from_system(size, alignment);
  if (ptr) {
    BlockDescriptor desc;
    desc.size = size;
    desc.alignment = alignment;
    desc.in_use = true;
    desc.allocated_time = std::chrono::steady_clock::now();
    blocks_[ptr] = desc;
    
    update_stats_allocated(size);
    get_logger().debug("Allocated new block for " + std::to_string(size) + 
                      " bytes (alignment: " + std::to_string(alignment) + ")");
    return ptr;
  }
  
  get_logger().error("Failed to allocate " + std::to_string(size) + 
                    " bytes (alignment: " + std::to_string(alignment) + ")");
  if (allocation_failure_callback_) {
    allocation_failure_callback_(size);
  }
  return nullptr;
}

bool AudioBufferPool::free(void* ptr) {
  if (!ptr || !enabled_) {
    return false;
  }
  
  std::lock_guard<std::mutex> lock(mutex_);
  
  auto it = blocks_.find(ptr);
  if (it == blocks_.end()) {
    get_logger().warn("Attempt to free unknown pointer: " + 
                     std::to_string(reinterpret_cast<uintptr_t>(ptr)));
    return false;
  }
  
  if (!it->second.in_use) {
    get_logger().warn("Attempt to free already freed pointer: " + 
                     std::to_string(reinterpret_cast<uintptr_t>(ptr)));
    return false;
  }
  
  size_t size = it->second.size;
  it->second.in_use = false;
  
  // Add to free blocks queue for reuse
  free_blocks_.push(ptr);
  
  update_stats_freed(size);
  get_logger().debug("Freed block of " + std::to_string(size) + " bytes");
  
  return true;
}

float* AudioBufferPool::allocate_audio_buffer(size_t num_samples, size_t channels) {
  size_t total_samples = num_samples * channels;
  size_t size_bytes = total_samples * sizeof(float);
  
  // Align for SIMD operations (16 bytes for SSE, 32 bytes for AVX)
  size_t alignment = 32;
  
  void* ptr = allocate(size_bytes, alignment);
  if (!ptr) {
    return nullptr;
  }
  
  // Initialize to zero for safety
  std::memset(ptr, 0, size_bytes);
  
  return static_cast<float*>(ptr);
}

bool AudioBufferPool::free_audio_buffer(float* buffer) {
  return free(static_cast<void*>(buffer));
}

PoolStats AudioBufferPool::get_stats() const {
  std::lock_guard<std::mutex> lock(mutex_);
  return stats_;
}

void AudioBufferPool::clear() {
  std::lock_guard<std::mutex> lock(mutex_);
  
  size_t freed_count = 0;
  size_t freed_size = 0;
  
  for (auto& pair : blocks_) {
    if (pair.second.in_use) {
      free_to_system(pair.first);
      freed_count++;
      freed_size += pair.second.size;
      pair.second.in_use = false;
    }
  }
  
  // Clear free blocks queue (they're already in blocks_ map)
  free_blocks_ = std::queue<void*>();
  
  // Reset stats
  stats_.reset();
  
  get_logger().info("Cleared pool, freed " + std::to_string(freed_count) + 
                   " blocks (" + std::to_string(freed_size) + " bytes)");
}

size_t AudioBufferPool::get_current_usage() const {
  std::lock_guard<std::mutex> lock(mutex_);
  return stats_.current_usage;
}

size_t AudioBufferPool::get_peak_usage() const {
  std::lock_guard<std::mutex> lock(mutex_);
  return stats_.peak_usage;
}

bool AudioBufferPool::can_allocate(size_t size) const {
  std::lock_guard<std::mutex> lock(mutex_);
  return (stats_.current_usage + size) <= max_pool_size_;
}

void AudioBufferPool::set_max_pool_size(size_t max_size) {
  std::lock_guard<std::mutex> lock(mutex_);
  max_pool_size_ = max_size;
  get_logger().info("Set max pool size to " + std::to_string(max_size) + " bytes");
}

size_t AudioBufferPool::get_max_pool_size() const {
  std::lock_guard<std::mutex> lock(mutex_);
  return max_pool_size_;
}

size_t AudioBufferPool::collect_garbage() {
  std::lock_guard<std::mutex> lock(mutex_);
  
  size_t collected_count = 0;
  size_t collected_size = 0;
  
  // Collect blocks that have been free for a while
  // For simplicity, we'll free all unused blocks except preallocated ones
  for (auto it = blocks_.begin(); it != blocks_.end(); ) {
    if (!it->second.in_use) {
      // Check if this is a preallocated block
      bool is_preallocated = false;
      for (const auto& block : preallocated_blocks_) {
        if (block.get() == it->first) {
          is_preallocated = true;
          break;
        }
      }
      
      if (!is_preallocated) {
        collected_count++;
        collected_size += it->second.size;
        free_to_system(it->first);
        it = blocks_.erase(it);
      } else {
        ++it;
      }
    } else {
      ++it;
    }
  }
  
  // Clear free blocks queue (they've been freed)
  free_blocks_ = std::queue<void*>();
  
  if (collected_count > 0) {
    get_logger().info("Garbage collected " + std::to_string(collected_count) + 
                     " blocks (" + std::to_string(collected_size) + " bytes)");
  }
  
  return collected_count;
}

void AudioBufferPool::set_enabled(bool enabled) {
  std::lock_guard<std::mutex> lock(mutex_);
  enabled_ = enabled;
  get_logger().info("Pool " + std::string(enabled ? "enabled" : "disabled"));
}

bool AudioBufferPool::is_enabled() const {
  std::lock_guard<std::mutex> lock(mutex_);
  return enabled_;
}

void AudioBufferPool::set_allocation_failure_callback(std::function<void(size_t)> callback) {
  std::lock_guard<std::mutex> lock(mutex_);
  allocation_failure_callback_ = callback;
}

// Private helper methods

void* AudioBufferPool::allocate_from_system(size_t size, size_t alignment) {
#ifdef _WIN32
  return _aligned_malloc(size, alignment);
#else
  void* ptr = nullptr;
  if (posix_memalign(&ptr, alignment, size) != 0) {
    return nullptr;
  }
  return ptr;
#endif
}

void AudioBufferPool::free_to_system(void* ptr) {
#ifdef _WIN32
  _aligned_free(ptr);
#else
  free(ptr);
#endif
}

void* AudioBufferPool::reuse_block(size_t size, size_t alignment) {
  // Try to find a free block that matches our requirements
  std::queue<void*> temp_queue;
  void* found_block = nullptr;
  
  while (!free_blocks_.empty()) {
    void* block = free_blocks_.front();
    free_blocks_.pop();
    
    auto it = blocks_.find(block);
    if (it != blocks_.end() && !it->second.in_use) {
      // Check if block meets size and alignment requirements
      if (it->second.size >= size && 
          (it->second.alignment >= alignment || alignment == 1)) {
        found_block = block;
        it->second.in_use = true;
        it->second.allocated_time = std::chrono::steady_clock::now();
        stats_.cache_hits++;
        break;
      }
    }
    
    // Block doesn't meet requirements, keep it in temp queue
    temp_queue.push(block);
  }
  
  // Put remaining blocks back in queue
  while (!temp_queue.empty()) {
    free_blocks_.push(temp_queue.front());
    temp_queue.pop();
  }
  
  if (!found_block) {
    stats_.cache_misses++;
  }
  
  return found_block;
}

void AudioBufferPool::update_stats_allocated(size_t size) {
  stats_.total_allocated += size;
  stats_.current_usage += size;
  stats_.allocation_count++;
  
  if (stats_.current_usage > stats_.peak_usage) {
    stats_.peak_usage = stats_.current_usage;
  }
}

void AudioBufferPool::update_stats_freed(size_t size) {
  stats_.total_freed += size;
  stats_.current_usage -= size;
  stats_.free_count++;
}

// AudioBufferPoolManager implementation

AudioBufferPoolManager& AudioBufferPoolManager::get_instance() {
  static AudioBufferPoolManager instance;
  return instance;
}

AudioBufferPoolManager::AudioBufferPoolManager() 
  : global_memory_limit_(2 * 1024 * 1024 * 1024) {  // 2 GB default
  
  get_logger().info("AudioBufferPoolManager created");
  
  // Create default pool
  default_pool_ = std::make_unique<AudioBufferPool>();
}

AudioBufferPoolManager::~AudioBufferPoolManager() {
  std::lock_guard<std::mutex> lock(mutex_);
  
  // Clear all pools
  pools_.clear();
  default_pool_.reset();
  
  get_logger().info("AudioBufferPoolManager destroyed");
}

AudioBufferPool& AudioBufferPoolManager::get_default_pool() {
  std::lock_guard<std::mutex> lock(mutex_);
  return *default_pool_;
}

AudioBufferPool& AudioBufferPoolManager::create_pool(const std::string& name, 
                                                    size_t max_pool_size,
                                                    size_t preallocate_size) {
  std::lock_guard<std::mutex> lock(mutex_);
  
  if (pools_.find(name) != pools_.end()) {
    get_logger().warn("Pool '" + name + "' already exists, returning existing pool");
    return *pools_[name];
  }
  
  auto pool = std::make_unique<AudioBufferPool>(max_pool_size, preallocate_size);
  auto& pool_ref = *pool;
  pools_[name] = std::move(pool);
  
  get_logger().info("Created pool '" + name + "' with max size " + 
                   std::to_string(max_pool_size) + " bytes");
  
  return pool_ref;
}

AudioBufferPool& AudioBufferPoolManager::get_pool(const std::string& name) {
  std::lock_guard<std::mutex> lock(mutex_);
  
  auto it = pools_.find(name);
  if (it == pools_.end()) {
    throw std::runtime_error("Pool '" + name + "' not found");
  }
  
  return *it->second;
}

bool AudioBufferPoolManager::has_pool(const std::string& name) const {
  std::lock_guard<std::mutex> lock(mutex_);
  return pools_.find(name) != pools_.end();
}

bool AudioBufferPoolManager::destroy_pool(const std::string& name) {
  std::lock_guard<std::mutex> lock(mutex_);
  
  auto it = pools_.find(name);
  if (it == pools_.end()) {
    get_logger().warn("Attempt to destroy non-existent pool '" + name + "'");
    return false;
  }
  
  // Clear pool before destruction
  it->second->clear();
  pools_.erase(it);
  
  get_logger().info("Destroyed pool '" + name + "'");
  return true;
}

std::vector<std::string> AudioBufferPoolManager::get_pool_names() const {
  std::lock_guard<std::mutex> lock(mutex_);
  
  std::vector<std::string> names;
  for (const auto& pair : pools_) {
    names.push_back(pair.first);
  }
  
  return names;
}

size_t AudioBufferPoolManager::get_total_memory_usage() const {
  std::lock_guard<std::mutex> lock(mutex_);
  
  size_t total = 0;
  
  // Include default pool
  if (default_pool_) {
    total += default_pool_->get_current_usage();
  }
  
  // Include named pools
  for (const auto& pair : pools_) {
    total += pair.second->get_current_usage();
  }
  
  return total;
}

size_t AudioBufferPoolManager::get_peak_memory_usage() const {
  std::lock_guard<std::mutex> lock(mutex_);
  
  size_t peak = 0;
  
  // Include default pool
  if (default_pool_) {
    peak += default_pool_->get_peak_usage();
  }
  
  // Include named pools (sum of peaks may not be accurate but gives an estimate)
  for (const auto& pair : pools_) {
    peak += pair.second->get_peak_usage();
  }
  
  return peak;
}

void AudioBufferPoolManager::clear_all_pools() {
  std::lock_guard<std::mutex> lock(mutex_);
  
  if (default_pool_) {
    default_pool_->clear();
  }
  
  for (auto& pair : pools_) {
    pair.second->clear();
  }
  
  get_logger().info("Cleared all pools");
}

size_t AudioBufferPoolManager::collect_garbage_all_pools() {
  std::lock_guard<std::mutex> lock(mutex_);
  
  size_t total_collected = 0;
  
  if (default_pool_) {
    total_collected += default_pool_->collect_garbage();
  }
  
  for (auto& pair : pools_) {
    total_collected += pair.second->collect_garbage();
  }
  
  if (total_collected > 0) {
    get_logger().info("Garbage collected " + std::to_string(total_collected) + 
                     " blocks from all pools");
  }
  
  return total_collected;
}

void AudioBufferPoolManager::set_global_memory_limit(size_t limit) {
  std::lock_guard<std::mutex> lock(mutex_);
  global_memory_limit_ = limit;
  get_logger().info("Set global memory limit to " + std::to_string(limit) + " bytes");
}

size_t AudioBufferPoolManager::get_global_memory_limit() const {
  std::lock_guard<std::mutex> lock(mutex_);
  return global_memory_limit_;
}

bool AudioBufferPoolManager::is_global_memory_limit_exceeded() const {
  std::lock_guard<std::mutex> lock(mutex_);
  return get_total_memory_usage() > global_memory_limit_;
}

} // namespace memory