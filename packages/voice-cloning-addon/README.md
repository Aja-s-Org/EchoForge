# Voice Cloning Addon

A Node.js C++ addon for voice cloning using the f5-tts library. This package provides voice cloning functionality within the EchoForge monorepo.

## Overview

The voice cloning addon enables text-to-speech synthesis using voice samples. It allows users to provide a voice sample and text, and generates synthetic speech that mimics the provided voice characteristics.

## Features

- Voice embedding extraction from audio samples
- Text-to-speech synthesis with voice cloning
- Support for WAV, MP3, and OGG audio formats
- TypeScript interfaces for easy integration
- Async/Promise-based API
- Comprehensive error handling

## Architecture

This package is implemented as a Node.js C++ addon using N-API for integration with the f5-tts library. The architecture consists of:

1. **C++ Core**: Native implementation using f5-tts for voice processing
2. **Node.js Bindings**: N-API bindings to expose C++ functionality to JavaScript
3. **TypeScript Interface**: Clean, typed API for integration with backend services

## Installation

This package is part of the EchoForge Nx monorepo. It will be built and included automatically when building the monorepo.

### Prerequisites

Before building this package, ensure you have the following system dependencies installed:

#### macOS
```bash
# Install using Homebrew
brew install libsndfile portaudio cmake
```

#### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install -y libsndfile1-dev portaudio19-dev cmake g++ make
```

#### Windows
Install via Chocolatey or manually:
- libsndfile
- portaudio
- CMake
- Visual Studio Build Tools

### Installing Dependencies

1. **Initialize f5-tts submodule**:
   ```bash
   git submodule update --init --recursive
   ```

2. **Install Node.js dependencies**:
   ```bash
   npm install
   ```

3. **Verify installation**:
   ```bash
   ./scripts/verify-deps.sh
   ```

4. **Build the addon**:
   ```bash
   npm run build:cpp
   ```

For detailed installation instructions, see [INSTALL.md](INSTALL.md).

## Usage

```typescript
import { VoiceCloner } from '@echoforge/voice-cloning-addon';

// The actual implementation will be added in subsequent tasks
// const voiceCloner = new VoiceCloner();
// const embedding = await voiceCloner.extractVoiceEmbedding(audioBuffer);
// const synthesizedAudio = await voiceCloner.synthesizeSpeech(embedding, "Hello world");
```

## Development

### Building

```bash
nx build @echoforge/voice-cloning-addon
```

### Testing

```bash
nx test @echoforge/voice-cloning-addon
```

### Code Coverage

```bash
nx coverage @echoforge/voice-cloning-addon
```

## Directory Structure

```
packages/voice-cloning-addon/
├── src/
│   ├── types/           # TypeScript type definitions
│   ├── cpp/            # C++ source code (to be added)
│   └── index.ts        # Main entry point
├── include/            # C++ headers (to be added)
├── tests/             # Test files (to be added)
├── models/            # Model storage (to be added)
├── package.json       # Package metadata
├── project.json       # Nx project configuration
└── README.md          # This file
```

## Dependencies

### System Dependencies
- libsndfile
- portaudio
- CMake
- g++/clang++

### Node.js Dependencies
- node-gyp
- @types/node

### External Library
- f5-tts (https://github.com/swivid/f5-tts)

## Status

This package is under active development as part of the EchoForge voice cloning feature implementation.