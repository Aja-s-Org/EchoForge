#ifndef VOICE_EMBEDDING_CACHE_H
#define VOICE_EMBEDDING_CACHE_H

#include <vector>
#include <string>
#include <memory>
#include <unordered_map>
#include <list>
#include <mutex>
#include <chrono>
#include <functional>
#include <cmath>
#include "audio_processor.h"
#include "logger.h"

namespace cache {

/**
 * @brief Cache entry for voice embedding
 */
struct VoiceEmbeddingCacheEntry {
  std::vector<float> embedding;
  std::string voice_sample_hash;
  std::chrono::steady_clock::time_point created_time;
  std::chrono::steady_clock::time_point last_access_time;
  size_t access_count;
  size_t size_bytes;
  
  VoiceEmbeddingCacheEntry() : access_count(0), size_bytes(0) {}
  
  VoiceEmbeddingCacheEntry(const std::vector<float>& emb, 
                          const std::string& hash, size_t size)
    : embedding(emb), voice_sample_hash(hash), size_bytes(size), 
      access_count(1) {
    created_time = std::chrono::steady_clock::now();
    last_access_time = created_time;
  }
  
  bool is_valid() const { return !embedding.empty(); }
  
  void update_access() {
    last_access_time = std::chrono::steady_clock::now();
    ++access_count;
  }
  
  size_t get_age_ms() const {
    auto now = std::chrono::steady_clock::now();
    return std::chrono::duration_cast<std::chrono::milliseconds>(
      now - created_time).count();
  }
  
  size_t get_idle_time_ms() const {
    auto now = std::chrono::steady_clock::now();
    return std::chrono::duration_cast<std::chrono::milliseconds>(
      now - last_access_time).count();
  }
};

/**
 * @brief Cache statistics
 */
struct VoiceCacheStats {
  size_t total_entries;
  size_t hit_count;
  size_t miss_count;
  size_t eviction_count;
  size_t current_memory_usage;
  size_t peak_memory_usage;
  double hit_rate;
  
  VoiceCacheStats() : total_entries(0), hit_count(0), miss_count(0),
                     eviction_count(0), current_memory_usage(0),
                     peak_memory_usage(0), hit_rate(0.0) {}
  
  void update_hit_rate() {
    size_t total_accesses = hit_count + miss_count;
    if (total_accesses > 0) {
      hit_rate = static_cast<double>(hit_count) / total_accesses;
    }
  }
  
  void reset() {
    total_entries = 0;
    hit_count = 0;
    miss_count = 0;
    eviction_count = 0;
    current_memory_usage = 0;
    peak_memory_usage = 0;
    hit_rate = 0.0;
  }
};

/**
 * @brief Voice embedding cache policy
 */
enum class CachePolicy {
  LRU,        // Least Recently Used
  LFU,        // Least Frequently Used
  ARC,        // Adaptive Replacement Cache
  SIZE_BASED  // Evict largest entries first
};

/**
 * @brief Voice embedding cache configuration
 */
struct VoiceCacheConfig {
  size_t max_entries;
  size_t max_memory_bytes;
  size_t max_entry_age_ms;  // 0 = no age limit
  size_t max_idle_time_ms;  // 0 = no idle limit
  CachePolicy policy;
  bool enable_prefetch;
  size_t prefetch_threshold_ms;
  bool enable_compression;
  float compression_ratio;
  
  VoiceCacheConfig() : 
    max_entries(1000),
    max_memory_bytes(1024 * 1024 * 1024),  // 1 GB
    max_entry_age_ms(24 * 60 * 60 * 1000), // 24 hours
    max_idle_time_ms(60 * 60 * 1000),      // 1 hour
    policy(CachePolicy::LRU),
    enable_prefetch(false),
    prefetch_threshold_ms(5000),           // 5 seconds
    enable_compression(false),
    compression_ratio(0.5f) {}
};

/**
 * @brief Voice embedding similarity result
 */
struct SimilarityResult {
  float score;  // Cosine similarity score (0.0 to 1.0)
  std::string voice_sample_hash;
  bool is_cached;
  
  SimilarityResult() : score(0.0f), is_cached(false) {}
  SimilarityResult(float s, const std::string& h, bool c) : 
    score(s), voice_sample_hash(h), is_cached(c) {}
};

/**
 * @brief Voice embedding cache with LRU eviction policy
 */
class VoiceEmbeddingCache {
public:
  /**
   * @brief Constructor
   * @param config Cache configuration
   */
  explicit VoiceEmbeddingCache(const VoiceCacheConfig& config = VoiceCacheConfig());
  
  /**
   * @brief Destructor
   */
  ~VoiceEmbeddingCache();
  
  /**
   * @brief Initialize cache
   * @return true if successful, false otherwise
   */
  bool initialize();
  
  /**
   * @brief Store voice embedding in cache
   * @param voice_sample_hash Hash of voice sample audio data
   * @param embedding Voice embedding vector
   * @param sample_metadata Optional sample metadata for similarity matching
   * @return true if stored successfully, false otherwise
   */
  bool store(const std::string& voice_sample_hash, 
             const std::vector<float>& embedding,
             const audio::AudioData* sample_metadata = nullptr);
  
  /**
   * @brief Retrieve voice embedding from cache
   * @param voice_sample_hash Hash of voice sample audio data
   * @param embedding Output embedding vector
   * @return true if found, false otherwise
   */
  bool retrieve(const std::string& voice_sample_hash, 
                std::vector<float>& embedding);
  
  /**
   * @brief Find similar voice embedding in cache
   * @param voice_sample_hash Hash of voice sample to find similar for
   * @param embedding Input embedding to compare against
   * @param similarity_threshold Minimum similarity score (0.0 to 1.0)
   * @return Similarity result
   */
  SimilarityResult find_similar(const std::string& voice_sample_hash,
                                const std::vector<float>& embedding,
                                float similarity_threshold = 0.8f);
  
  /**
   * @brief Remove voice embedding from cache
   * @param voice_sample_hash Hash of voice sample to remove
   * @return true if removed, false if not found
   */
  bool remove(const std::string& voice_sample_hash);
  
  /**
   * @brief Clear all entries from cache
   */
  void clear();
  
  /**
   * @brief Get cache statistics
   * @return Cache statistics
   */
  VoiceCacheStats get_stats() const;
  
  /**
   * @brief Update cache configuration
   * @param config New configuration
   * @return true if updated successfully, false otherwise
   */
  bool update_config(const VoiceCacheConfig& config);
  
  /**
   * @brief Get current cache configuration
   * @return Current configuration
   */
  VoiceCacheConfig get_config() const;
  
  /**
   * @brief Perform cache maintenance (evict expired entries)
   * @return Number of entries evicted
   */
  size_t perform_maintenance();
  
  /**
   * @brief Check if cache contains voice embedding
   * @param voice_sample_hash Hash to check
   * @return true if contains, false otherwise
   */
  bool contains(const std::string& voice_sample_hash) const;
  
  /**
   * @brief Get number of entries in cache
   * @return Entry count
   */
  size_t size() const;
  
  /**
   * @brief Get current memory usage in bytes
   * @return Memory usage
   */
  size_t get_memory_usage() const;
  
  /**
   * @brief Get cache hit rate
   * @return Hit rate (0.0 to 1.0)
   */
  double get_hit_rate() const;
  
  /**
   * @brief Compute hash for audio data
   * @param audio Audio data
   * @return Hash string
   */
  static std::string compute_audio_hash(const audio::AudioData& audio);
  
  /**
   * @brief Compute hash for audio file
   * @param filepath Path to audio file
   * @return Hash string, empty if file cannot be read
   */
  static std::string compute_audio_file_hash(const std::string& filepath);
  
  /**
   * @brief Compute cosine similarity between two embeddings
   * @param emb1 First embedding
   * @param emb2 Second embedding
   * @return Similarity score (-1.0 to 1.0)
   */
  static float compute_cosine_similarity(const std::vector<float>& emb1,
                                         const std::vector<float>& emb2);
  
  /**
   * @brief Compress embedding vector
   * @param embedding Input embedding
   * @param ratio Compression ratio (0.0 to 1.0)
   * @return Compressed embedding
   */
  static std::vector<float> compress_embedding(const std::vector<float>& embedding,
                                               float ratio = 0.5f);
  
  /**
   * @brief Decompress embedding vector
   * @param compressed_embedding Compressed embedding
   * @param original_size Original embedding size
   * @return Decompressed embedding
   */
  static std::vector<float> decompress_embedding(const std::vector<float>& compressed_embedding,
                                                 size_t original_size);
  
  /**
   * @brief Save cache to disk
   * @param filepath Path to save cache
   * @return true if saved successfully, false otherwise
   */
  bool save_to_disk(const std::string& filepath);
  
  /**
   * @brief Load cache from disk
   * @param filepath Path to load cache from
   * @return true if loaded successfully, false otherwise
   */
  bool load_from_disk(const std::string& filepath);
  
private:
  struct CacheEntryWrapper {
    VoiceEmbeddingCacheEntry entry;
    std::list<std::string>::iterator lru_iterator;
    
    CacheEntryWrapper() {}
    CacheEntryWrapper(const VoiceEmbeddingCacheEntry& e) : entry(e) {}
  };
  
  VoiceCacheConfig config_;
  mutable std::mutex mutex_;
  std::unordered_map<std::string, CacheEntryWrapper> entries_;
  std::list<std::string> lru_list_;  // Most recent at front, least recent at back
  VoiceCacheStats stats_;
  bool initialized_;
  
  // Helper methods
  void evict_entries();
  void update_lru(const std::string& key);
  void remove_from_lru(const std::string& key);
  void add_to_lru(const std::string& key);
  bool check_expiration(const VoiceEmbeddingCacheEntry& entry) const;
  void update_stats_on_store(size_t entry_size);
  void update_stats_on_retrieve(bool hit);
  void update_stats_on_eviction(size_t entry_size);
  
  // Similarity indexing
  struct SimilarityIndexEntry {
    std::string hash;
    std::vector<float> compressed_embedding;
    float similarity_to_centroid;
    
    SimilarityIndexEntry(const std::string& h, const std::vector<float>& ce, float s)
      : hash(h), compressed_embedding(ce), similarity_to_centroid(s) {}
  };
  
  std::vector<SimilarityIndexEntry> similarity_index_;
  std::vector<float> centroid_embedding_;
  bool similarity_index_dirty_;
  
  void rebuild_similarity_index();
  void update_similarity_index(const std::string& hash, const std::vector<float>& embedding);
  void remove_from_similarity_index(const std::string& hash);
  
  // Get logger instance
  logging::Logger& get_logger() const {
    static logging::Logger& logger = logging::Logger::get_instance("voice_embedding_cache");
    return logger;
  }
};

/**
 * @brief Global voice embedding cache manager
 */
class VoiceEmbeddingCacheManager {
public:
  /**
   * @brief Get singleton instance
   * @return Reference to singleton instance
   */
  static VoiceEmbeddingCacheManager& get_instance();
  
  /**
   * @brief Get default voice embedding cache
   * @return Reference to default cache
   */
  VoiceEmbeddingCache& get_default_cache();
  
  /**
   * @brief Create named voice embedding cache
   * @param name Cache name
   * @param config Cache configuration
   * @return Reference to created cache
   */
  VoiceEmbeddingCache& create_cache(const std::string& name,
                                    const VoiceCacheConfig& config = VoiceCacheConfig());
  
  /**
   * @brief Get named voice embedding cache
   * @param name Cache name
   * @return Reference to cache if exists, throws std::runtime_error otherwise
   */
  VoiceEmbeddingCache& get_cache(const std::string& name);
  
  /**
   * @brief Check if named cache exists
   * @param name Cache name
   * @return true if exists, false otherwise
   */
  bool has_cache(const std::string& name) const;
  
  /**
   * @brief Destroy named voice embedding cache
   * @param name Cache name
   * @return true if destroyed, false if cache didn't exist
   */
  bool destroy_cache(const std::string& name);
  
  /**
   * @brief Get all cache names
   * @return Vector of cache names
   */
  std::vector<std::string> get_cache_names() const;
  
  /**
   * @brief Perform maintenance on all caches
   * @return Total number of entries evicted
   */
  size_t perform_maintenance_all_caches();
  
  /**
   * @brief Clear all caches
   */
  void clear_all_caches();
  
  /**
   * @brief Save all caches to disk
   * @param base_directory Base directory for cache files
   * @return true if saved successfully, false otherwise
   */
  bool save_all_caches_to_disk(const std::string& base_directory);
  
  /**
   * @brief Load all caches from disk
   * @param base_directory Base directory for cache files
   * @return true if loaded successfully, false otherwise
   */
  bool load_all_caches_from_disk(const std::string& base_directory);
  
  /**
   * @brief Get total memory usage across all caches
   * @return Total memory usage in bytes
   */
  size_t get_total_memory_usage() const;
  
  /**
   * @brief Get global hit rate across all caches
   * @return Global hit rate (weighted average)
   */
  double get_global_hit_rate() const;
  
private:
  VoiceEmbeddingCacheManager();
  ~VoiceEmbeddingCacheManager();
  
  // Disable copying
  VoiceEmbeddingCacheManager(const VoiceEmbeddingCacheManager&) = delete;
  VoiceEmbeddingCacheManager& operator=(const VoiceEmbeddingCacheManager&) = delete;
  
  mutable std::mutex mutex_;
  std::unordered_map<std::string, std::unique_ptr<VoiceEmbeddingCache>> caches_;
  std::unique_ptr<VoiceEmbeddingCache> default_cache_;
  
  // Get logger instance
  logging::Logger& get_logger() const {
    static logging::Logger& logger = logging::Logger::get_instance("voice_embedding_cache_manager");
    return logger;
  }
};

} // namespace cache

#endif // VOICE_EMBEDDING_CACHE_H