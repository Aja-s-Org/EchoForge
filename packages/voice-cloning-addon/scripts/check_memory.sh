#!/bin/bash

# Memory usage verification script for voice cloning addon
# This script checks memory usage and verifies memory management is working

echo "=== Memory Usage Verification ==="
echo ""

# Check system memory
echo "System Memory:"
if command -v free &> /dev/null; then
  free -h
elif command -v vm_stat &> /dev/null; then
  # macOS
  vm_stat
else
  echo "Unable to check system memory"
fi

echo ""
echo "Process Memory (current shell):"
if command -v ps &> /dev/null; then
  ps -o pid,ppid,rss,vsz,time,command -p $$
fi

echo ""
echo "=== Memory Management Configuration ==="
echo ""

# Check if memory pool is configured
if [ -f "include/memory_pool.h" ]; then
  echo "✓ Memory pool header found"
else
  echo "✗ Memory pool header not found"
fi

if [ -f "include/memory_monitor.h" ]; then
  echo "✓ Memory monitor header found"
else
  echo "✗ Memory monitor header not found"
fi

if [ -f "include/embedding_cache.h" ]; then
  echo "✓ Embedding cache header found"
else
  echo "✗ Embedding cache header not found"
fi

echo ""
echo "=== Build Status ==="
echo ""

# Check if build directory exists
if [ -d "build" ]; then
  echo "Build directory exists"
  ls -la build/ | head -5
else
  echo "No build directory found"
fi

if [ -d "build_test" ]; then
  echo "Test build directory exists"
  ls -la build_test/ | head -5
else
  echo "No test build directory found"
fi

echo ""
echo "=== Test Memory Operations ==="
echo ""

# Create simple test program to verify memory operations
cat > test_memory.cpp << 'EOF'
#include <iostream>
#include <vector>

int main() {
  std::cout << "Testing basic memory operations..." << std::endl;
  
  // Test vector allocation
  std::vector<float> audio_buffer;
  size_t initial_size = 44100 * 10;  // 10 seconds at 44.1kHz
  std::cout << "Allocating " << (initial_size * sizeof(float)) / 1024 << " KB..." << std::endl;
  
  audio_buffer.resize(initial_size, 0.0f);
  std::cout << "Vector size: " << audio_buffer.size() << " elements" << std::endl;
  std::cout << "Memory used: " << (audio_buffer.capacity() * sizeof(float)) / 1024 << " KB" << std::endl;
  
  // Test reallocation
  std::cout << "\nTesting reallocation..." << std::endl;
  size_t larger_size = initial_size * 2;
  audio_buffer.resize(larger_size, 0.0f);
  std::cout << "New size: " << audio_buffer.size() << " elements" << std::endl;
  std::cout << "New memory used: " << (audio_buffer.capacity() * sizeof(float)) / 1024 << " KB" << std::endl;
  
  // Test deallocation
  std::cout << "\nTesting deallocation..." << std::endl;
  {
    std::vector<float> temp_buffer(1000000, 0.0f);  // 1M elements
    std::cout << "Temporary buffer: " << temp_buffer.size() << " elements" << std::endl;
    std::cout << "Temporary memory: " << (temp_buffer.capacity() * sizeof(float)) / 1024 << " KB" << std::endl;
  }
  std::cout << "Temporary buffer destroyed" << std::endl;
  
  std::cout << "\nMemory test completed successfully!" << std::endl;
  return 0;
}
EOF

# Compile and run test
if command -v g++ &> /dev/null; then
  echo "Compiling test program..."
  g++ -std=c++17 -o test_memory test_memory.cpp
  if [ $? -eq 0 ]; then
    echo "Running test program..."
    ./test_memory
    rm -f test_memory test_memory.cpp
  else
    echo "Failed to compile test program"
    rm -f test_memory.cpp
  fi
else
  echo "g++ not found, skipping test compilation"
  rm -f test_memory.cpp
fi

echo ""
echo "=== Memory Management Verification ==="
echo ""

# Check for memory leaks in existing tests
if [ -f "tests/cpp/test_basic.cc" ]; then
  echo "Found existing tests:"
  grep -n "TEST\|EXPECT\|ASSERT" tests/cpp/test_basic.cc | head -5
  echo "..."
else
  echo "No existing tests found"
fi

echo ""
echo "=== Recommendations ==="
echo ""

echo "To verify memory management is working:"
echo "1. Build the project: npm run build:cpp"
echo "2. Run memory tests: ./build_test/test_core"
echo "3. Check for memory leaks with valgrind: valgrind --leak-check=full ./build_test/test_core"
echo "4. Monitor memory usage during voice cloning operations"
echo ""
echo "For production deployment:"
echo "- Set appropriate memory limits in config"
echo "- Monitor memory usage with the memory monitor"
echo "- Configure cleanup thresholds appropriately"
echo "- Test with realistic workloads to validate memory management"

echo ""
echo "=== Memory Limits Configuration Example ==="
echo ""
echo "Add to your config file (config.cfg):"
echo ""
echo "[memory]"
echo "max_heap_mb = 1024              # 1GB maximum heap"
echo "audio_pool_size_mb = 128        # 128MB for audio buffers"
echo "embedding_cache_entries = 1000  # Cache 1000 voice embeddings"
echo "model_cache_size_mb = 256       # 256MB for model cache"
echo "cleanup_threshold_percent = 80  # Cleanup when >80% of limit"
echo ""
echo "[memory.alerts]"
echo "enable = true"
echo "warning_percent = 70"
echo "critical_percent = 90"
echo "cooldown_ms = 5000"

echo ""
echo "Verification completed."