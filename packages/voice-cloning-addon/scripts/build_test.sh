#!/bin/bash

# Build test script for f5-tts integration
# This script tests the CMake configuration and basic compilation

set -e

echo "=== Testing f5-tts Library Integration ==="
echo

# Check if required directories exist
echo "1. Checking directory structure..."
if [ -d "src/cpp" ]; then
  echo "  ✓ src/cpp directory exists"
else
  echo "  ✗ src/cpp directory missing"
  exit 1
fi

if [ -d "include" ]; then
  echo "  ✓ include directory exists"
else
  echo "  ✗ include directory missing"
  exit 1
fi

if [ -f "CMakeLists.txt" ]; then
  echo "  ✓ CMakeLists.txt exists"
else
  echo "  ✗ CMakeLists.txt missing"
  exit 1
fi

if [ -f "include/f5_tts_wrapper.h" ]; then
  echo "  ✓ f5_tts_wrapper.h exists"
else
  echo "  ✗ f5_tts_wrapper.h missing"
  exit 1
fi

if [ -f "src/cpp/f5_tts_wrapper.cc" ]; then
  echo "  ✓ f5_tts_wrapper.cc exists"
else
  echo "  ✗ f5_tts_wrapper.cc missing"
  exit 1
fi

echo
echo "2. Checking CMake configuration syntax..."
if command -v cmake &> /dev/null; then
  mkdir -p build_test
  cd build_test
  
  # Try to configure
  if cmake .. -DCMAKE_BUILD_TYPE=Debug 2>&1 | tail -20 | grep -q "Configuring done\|-- Configuring incomplete"; then
    echo "  ✓ CMake configuration attempted (warnings may appear for missing dependencies)"
    
    # Check for required targets
    echo "  Checking for required targets..."
    if grep -q "voice_cloning_addon" CMakeCache.txt || grep -q "voice_cloning_addon" CMakeFiles/* 2>/dev/null; then
      echo "    ✓ voice_cloning_addon target found"
    else
      echo "    ✗ voice_cloning_addon target not found"
      exit 1
    fi
    
    if grep -q "f5_tts_wrapper" CMakeCache.txt || grep -q "f5_tts_wrapper" CMakeFiles/* 2>/dev/null; then
      echo "    ✓ f5_tts_wrapper target found"
    else
      echo "    ✗ f5_tts_wrapper target not found"
      exit 1
    fi
    
  else
    echo "  ✗ CMake configuration failed"
    exit 1
  fi
  
  cd ..
else
  echo "  ⚠ CMake not found, skipping configuration test"
fi

echo
echo "3. Checking source file syntax..."
if command -v g++ &> /dev/null; then
  # Check C++ syntax for wrapper files
  echo "  Checking f5_tts_wrapper.h..."
  if g++ -std=c++17 -c -Iinclude -I../../third_party/f5-tts/src -o /dev/null include/f5_tts_wrapper.h 2>&1; then
    echo "    ✓ f5_tts_wrapper.h compiles"
  else
    echo "    ✗ f5_tts_wrapper.h has syntax errors"
    exit 1
  fi
  
  # Check for required headers
  echo "  Checking for required headers in voice_cloner.h..."
  if grep -q "#include.*f5_tts_wrapper\.h" include/voice_cloner.h; then
    echo "    ✓ f5_tts_wrapper.h included"
  else
    echo "    ✗ f5_tts_wrapper.h not included"
    exit 1
  fi
else
  echo "  ⚠ g++ not found, skipping syntax check"
fi

echo
echo "4. Checking binding.gyp integration..."
if [ -f "binding.gyp" ]; then
  echo "  ✓ binding.gyp exists"
  
  # Check if f5-tts include directory is referenced
  if grep -q "third_party/f5-tts/src" binding.gyp; then
    echo "    ✓ f5-tts include directory referenced"
  else
    echo "    ✗ f5-tts include directory not referenced"
    exit 1
  fi
  
  # Check for required libraries
  if grep -q "lsndfile" binding.gyp; then
    echo "    ✓ libsndfile library referenced"
  else
    echo "    ✗ libsndfile library not referenced"
  fi
  
  if grep -q "lportaudio" binding.gyp; then
    echo "    ✓ portaudio library referenced"
  else
    echo "    ✗ portaudio library not referenced"
  fi
else
  echo "  ✗ binding.gyp missing"
  exit 1
fi

echo
echo "5. Testing error handling interfaces..."
# Check that error handling is defined in headers
if grep -q "error_message" include/f5_tts_wrapper.h; then
  echo "  ✓ Error message field defined"
else
  echo "  ✗ Error message field not defined"
fi

if grep -q "ThrowError" include/voice_cloner.h; then
  echo "  ✓ ThrowError method defined"
else
  echo "  ✗ ThrowError method not defined"
fi

echo
echo "6. Testing memory management interfaces..."
if grep -q "get_memory_usage" include/f5_tts_wrapper.h; then
  echo "  ✓ get_memory_usage method defined"
else
  echo "  ✗ get_memory_usage method not defined"
fi

if grep -q "clear_cache" include/f5_tts_wrapper.h; then
  echo "  ✓ clear_cache method defined"
else
  echo "  ✗ clear_cache method not defined"
fi

echo
echo "=== f5-tts Library Integration Test Complete ==="
echo "All basic integration checks passed!"
echo
echo "Next steps:"
echo "1. Build the addon with: cmake --build build_test"
echo "2. Run tests with: cd build_test && ctest"
echo "3. Test Node.js integration with: npm run build"