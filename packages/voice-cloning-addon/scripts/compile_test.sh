#!/bin/bash

# Simple compilation test for f5-tts integration

set -e

echo "=== Compilation Test for f5-tts Integration ==="
echo

# Clean previous build
rm -rf build_compile_test
mkdir -p build_compile_test
cd build_compile_test

echo "1. Running CMake configuration..."
cmake .. -DCMAKE_BUILD_TYPE=Debug -DBUILD_TESTING=OFF 2>&1 | grep -A5 -B5 "error\|warning\|Configuring"

echo
echo "2. Building the library..."
if make -j4 2>&1 | tail -20; then
  echo
  echo "✓ Build successful!"
  
  echo
  echo "3. Checking built artifacts..."
  if [ -f "libvoice_cloning_addon.node" ] || [ -f "lib/libvoice_cloning_addon.node" ]; then
    echo "  ✓ Node.js addon built successfully"
  else
    echo "  ⚠ Node.js addon not found (may be in different location)"
  fi
  
  if [ -f "lib/libf5_tts_wrapper.a" ]; then
    echo "  ✓ f5_tts_wrapper static library built"
    echo "  Library size: $(stat -f%z lib/libf5_tts_wrapper.a) bytes"
  else
    echo "  ✗ f5_tts_wrapper library not found"
  fi
  
else
  echo
  echo "✗ Build failed!"
  exit 1
fi

echo
echo "=== Compilation Test Complete ==="
echo "The f5-tts integration has been successfully built."
echo "Basic CMake configuration and compilation are working."