#!/bin/bash

# Build script for N-API Voice Cloning Addon
# This script builds the native Node.js addon using node-gyp

set -e

echo "=== Building N-API Voice Cloning Addon ==="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
  echo "Error: This script must be run from the core-engine package directory"
  echo "Current directory: $(pwd)"
  exit 1
fi

# Check for node-gyp
if ! command -v node-gyp &> /dev/null; then
  echo "Error: node-gyp is not installed"
  echo "Install it with: npm install -g node-gyp"
  exit 1
fi

# Check for required build tools
echo "Checking build tools..."
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  if ! command -v clang++ &> /dev/null; then
    echo "Error: Xcode command line tools not installed"
    echo "Install with: xcode-select --install"
    exit 1
  fi
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  # Linux
  if ! command -v g++ &> /dev/null; then
    echo "Error: g++ not installed"
    echo "Install with: sudo apt-get install g++"
    exit 1
  fi
  if ! command -v make &> /dev/null; then
    echo "Error: make not installed"
    echo "Install with: sudo apt-get install make"
    exit 1
  fi
else
  echo "Warning: Unsupported OS: $OSTYPE"
  echo "Build may fail on this platform"
fi

# Check for audio libraries
echo "Checking audio libraries..."
if [[ "$OSTYPE" == "darwin"* ]]; then
  # Check for libsndfile on macOS
  if ! brew list libsndfile &> /dev/null; then
    echo "Warning: libsndfile not found via Homebrew"
    echo "Install with: brew install libsndfile"
  fi
  
  # Check for portaudio on macOS
  if ! brew list portaudio &> /dev/null; then
    echo "Warning: portaudio not found via Homebrew"
    echo "Install with: brew install portaudio"
  fi
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  # Check for libsndfile on Linux
  if ! dpkg -l | grep -q libsndfile1; then
    echo "Warning: libsndfile not installed"
    echo "Install with: sudo apt-get install libsndfile1"
  fi
  
  # Check for portaudio on Linux
  if ! dpkg -l | grep -q portaudio19-dev; then
    echo "Warning: portaudio not installed"
    echo "Install with: sudo apt-get install portaudio19-dev"
  fi
fi

echo ""
echo "Starting build process..."

# Clean previous builds
echo "1. Cleaning previous builds..."
rm -rf build/

# Install dependencies if needed
echo "2. Installing Node.js dependencies..."
npm install

# Configure build
echo "3. Configuring build..."
node-gyp configure

# Build the addon
echo "4. Building addon..."
node-gyp build

# Check if build succeeded
if [ -f "build/Release/voice_cloning_addon.node" ]; then
  echo ""
  echo "✅ Build successful!"
  echo "Addon location: $(pwd)/build/Release/voice_cloning_addon.node"
  
  # Test the addon
  echo ""
  echo "5. Testing addon..."
  if [ -f "src/lib/napi-binding.test.ts" ]; then
    echo "Running TypeScript tests..."
    npx tsx src/lib/napi-binding.test.ts || echo "Test output above"
  else
    echo "Creating simple test..."
    cat > test-addon.js << 'EOF'
const path = require('path');

try {
  const addonPath = path.join(__dirname, 'build/Release/voice_cloning_addon.node');
  console.log(`Trying to load addon from: ${addonPath}`);
  
  const addon = require(addonPath);
  console.log('✅ Addon loaded successfully!');
  
  if (addon.getVersion) {
    console.log(`Version: ${addon.getVersion()}`);
  }
  
  if (addon.checkSystemRequirements) {
    const reqs = addon.checkSystemRequirements();
    console.log('System requirements:', JSON.stringify(reqs, null, 2));
  }
  
} catch (error) {
  console.error('❌ Failed to load addon:', error.message);
  process.exit(1);
}
EOF
    node test-addon.js
    rm -f test-addon.js
  fi
else
  echo ""
  echo "❌ Build failed!"
  echo "Check the build output above for errors."
  exit 1
fi

echo ""
echo "=== Build completed ==="
echo ""
echo "To use the addon in your code:"
echo "1. Import the N-API bindings:"
echo "   import { NativeVoiceCloner } from './src/lib/napi-binding'"
echo ""
echo "2. Create a voice cloner instance:"
echo "   const voiceCloner = new NativeVoiceCloner(config)"
echo ""
echo "3. Initialize and use:"
echo "   await voiceCloner.initialize()"
echo "   const embedding = await voiceCloner.extractVoiceEmbedding(audioBuffer)"