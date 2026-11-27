# Installation Guide for Voice Cloning Addon

## System Dependencies

### macOS (Homebrew)

```bash
# Install audio processing libraries
brew install libsndfile portaudio cmake

# Install build tools
brew install node-gyp

# For GPU support (optional)
brew install cuda  # Requires NVIDIA GPU
```

### Ubuntu/Debian

```bash
# Install audio processing libraries
sudo apt-get update
sudo apt-get install -y libsndfile1-dev portaudio19-dev cmake g++ make

# Install Node.js development tools
sudo apt-get install -y node-gyp

# For GPU support (optional)
sudo apt-get install -y nvidia-cuda-toolkit
```

### Common Build Tools

The following build tools are required for building the C++ addon:

1. **CMake** (≥ 3.10) - For building f5-tts library
2. **g++** (≥ 7.0) or **clang** (≥ 5.0) - C++ compiler with C++17 support
3. **make** or **ninja** - Build system
4. **node-gyp** - Node.js native addon build tool

## Node.js Dependencies

The Node.js dependencies are managed through npm/yarn and will be installed automatically when you run:

```bash
# From the monorepo root
npm install

# Or from the package directory
cd packages/voice-cloning-addon
npm install
```

## f5-tts Library

F5-TTS runs in the separate voice inference service (`apps/voice-inference`), which pins the
release in `apps/voice-inference/f5-tts.json` and builds it with its `fetch-f5-tts` /
`build-f5-tts` Nx targets. This addon doesn't need it to build or test.

```bash
# From the monorepo root
npx nx run voice-inference:build-f5-tts
```

## Building the Addon

After installing all dependencies, build the addon:

```bash
cd packages/voice-cloning-addon
npm run build:native
```

## Verification

To verify that all dependencies are installed correctly:

```bash
# Run verification script
cd packages/voice-cloning-addon
./scripts/verify-deps.sh

# Or manually check
cmake --version
clang++ --version  # or g++ --version
node-gyp --version

# Test build
npm run build:native
```

## Troubleshooting

### Common Issues

1. **Missing libsndfile/portaudio**: Ensure the development packages are installed (not just runtime)
2. **Node-gyp permissions**: May need to run with sudo on Linux
3. **Python version**: Node-gyp requires Python 3.6+
4. **CUDA not found**: GPU support is optional, the addon will fall back to CPU

### macOS Specific

- Xcode Command Line Tools are required: `xcode-select --install`
- If using ARM64 (Apple Silicon), ensure Homebrew is in `/opt/homebrew`
- **Common Issue**: Library paths may differ. If build fails, check:
  ```bash
  # Find libsndfile path
  find /opt/homebrew -name "libsndfile.dylib" 2>/dev/null
  find /usr/local -name "libsndfile.dylib" 2>/dev/null
  
  # Find portaudio path  
  find /opt/homebrew -name "libportaudio.dylib" 2>/dev/null
  find /usr/local -name "libportaudio.dylib" 2>/dev/null
  ```

### Linux Specific

- May need to install additional packages: `build-essential`, `python3`
- Ensure `/usr/local/lib` is in the library path
- Add to `/etc/ld.so.conf` or set `LD_LIBRARY_PATH` if libraries are not found

### Setting Library Paths

If the build fails with "library not found" errors, you may need to set environment variables:

#### macOS
```bash
# For Homebrew on Apple Silicon
export CPATH="/opt/homebrew/include:$CPATH"
export LIBRARY_PATH="/opt/homebrew/lib:$LIBRARY_PATH"
export LD_LIBRARY_PATH="/opt/homebrew/lib:$LD_LIBRARY_PATH"

# For Homebrew on Intel
export CPATH="/usr/local/include:$CPATH"
export LIBRARY_PATH="/usr/local/lib:$LIBRARY_PATH"
export LD_LIBRARY_PATH="/usr/local/lib:$LD_LIBRARY_PATH"
```

#### Linux
```bash
export CPATH="/usr/local/include:$CPATH"
export LIBRARY_PATH="/usr/local/lib:$LIBRARY_PATH"
export LD_LIBRARY_PATH="/usr/local/lib:$LD_LIBRARY_PATH"
```

## Development Environment

For development, also install:

```bash
# Testing frameworks
npm install --save-dev jest @types/jest ts-jest fast-check

# TypeScript
npm install --save-dev typescript @types/node

# Linting
npm install --save-dev eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser prettier
```

## Docker Development

For containerized development, see the Dockerfile in the package directory.
## Python Dependencies

The f5-tts library requires Python 3.10+ and PyTorch. To install Python dependencies:

```bash
# Create and activate Python virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Build the pinned f5-tts wheel and install it with its dependencies
# (from the monorepo root)
node apps/voice-inference/scripts/f5-tts.mjs install

# For GPU support, install the PyTorch build for your CUDA version first
# See f5-tts README for detailed instructions
```

### Python Development Environment

For development with Python integration:

```bash
# Install additional Python packages for development
pip install pybind11 numpy scipy librosa soundfile
```

## Architecture Considerations

Since f5-tts is a Python/PyTorch library, the voice cloning addon uses one of these integration patterns:

1. **Python Service Pattern**: Python service exposes REST/gRPC API, C++ addon communicates via HTTP
2. **Pybind11 Pattern**: Embed Python interpreter in C++ using Pybind11
3. **Python Shell Pattern**: Use python-shell to call Python scripts from Node.js

The current implementation uses the Python Shell pattern for simplicity, but can be upgraded to Pybind11 for better performance.