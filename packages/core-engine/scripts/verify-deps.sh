#!/bin/bash

# Verification script for voice cloning addon dependencies
echo "Verifying voice cloning addon dependencies..."

# Check OS
OS=$(uname -s)
echo "Operating System: $OS"

# Check system dependencies
echo ""
echo "=== System Dependencies ==="

# Check Homebrew
if command -v brew &> /dev/null; then
    echo "✓ Homebrew installed"
else
    echo "✗ Homebrew not found"
fi

# Check audio libraries
echo ""
echo "Audio Libraries:"
if [ -d "/opt/homebrew/Cellar/libsndfile" ] || [ -d "/usr/local/Cellar/libsndfile" ]; then
    echo "✓ libsndfile installed"
else
    echo "✗ libsndfile not found"
fi

if [ -d "/opt/homebrew/Cellar/portaudio" ] || [ -d "/usr/local/Cellar/portaudio" ]; then
    echo "✓ portaudio installed"
else
    echo "✗ portaudio not found"
fi

# Check build tools
echo ""
echo "Build Tools:"
if command -v cmake &> /dev/null; then
    cmake_version=$(cmake --version | head -n1 | awk '{print $3}')
    echo "✓ CMake $cmake_version installed"
else
    echo "✗ CMake not found"
fi

if command -v make &> /dev/null; then
    make_version=$(make --version | head -n1 | awk '{print $3}')
    echo "✓ Make $make_version installed"
else
    echo "✗ Make not found"
fi

if command -v g++ &> /dev/null; then
    gpp_version=$(g++ --version | head -n1)
    echo "✓ g++: $gpp_version"
elif command -v clang++ &> /dev/null; then
    clang_version=$(clang++ --version | head -n1)
    echo "✓ clang++: $clang_version"
else
    echo "✗ C++ compiler not found"
fi

# Check Python
echo ""
echo "=== Python Dependencies ==="
if command -v python3 &> /dev/null; then
    python_version=$(python3 --version | awk '{print $2}')
    echo "✓ Python $python_version installed"
    
    # Check major and minor version
    major=$(echo $python_version | cut -d. -f1)
    minor=$(echo $python_version | cut -d. -f2)
    
    if [ $major -eq 3 ] && [ $minor -ge 10 ]; then
        echo "✓ Python version 3.10+ (compatible with f5-tts)"
    else
        echo "⚠ Python version $python_version may not be compatible with f5-tts (requires 3.10+)"
    fi
    
    if python3 -m pip --version &> /dev/null; then
        echo "✓ pip installed"
    else
        echo "✗ pip not found"
    fi
else
    echo "✗ Python 3 not found"
fi

# Check f5-tts submodule
echo ""
echo "=== f5-tts Submodule ==="
if [ -d "../../third_party/f5-tts" ] && [ -d "../../third_party/f5-tts/.git" ]; then
    echo "✓ f5-tts submodule initialized (at monorepo root)"
    
    # Check if submodule is at correct commit
    if [ -f "../../.gitmodules" ]; then
        echo "✓ .gitmodules file exists"
    else
        echo "⚠ .gitmodules file not found"
    fi
else
    echo "✗ f5-tts submodule not found"
    echo "  Run from monorepo root: git submodule update --init --recursive"
fi

# Check Node.js dependencies
echo ""
echo "=== Node.js Dependencies ==="
if command -v node &> /dev/null; then
    node_version=$(node --version)
    echo "✓ Node.js $node_version installed"
    
    if command -v npm &> /dev/null; then
        npm_version=$(npm --version)
        echo "✓ npm $npm_version installed"
        
        # Check if package dependencies are installed
        if [ -d "node_modules" ]; then
            echo "✓ node_modules directory exists"
        else
            echo "⚠ node_modules not found, run: npm install"
        fi
    else
        echo "✗ npm not found"
    fi
else
    echo "✗ Node.js not found"
fi

# Check node-gyp
echo ""
echo "=== Node.js Native Addon Tools ==="
if [ -f "package.json" ]; then
    if grep -q "node-gyp" package.json; then
        echo "✓ node-gyp in package.json"
    else
        echo "✗ node-gyp not in package.json"
    fi
    
    if grep -q "@types/node" package.json; then
        echo "✓ @types/node in package.json"
    else
        echo "✗ @types/node not in package.json"
    fi
fi

# Test compilation
echo ""
echo "=== Compilation Test ==="
echo "Creating test compilation..."
cat > test_compile.cpp << 'EOF'
#include <iostream>
#include <sndfile.h>
#include <portaudio.h>

int main() {
    std::cout << "Test compilation successful!" << std::endl;
    return 0;
}
EOF

if [ "$OS" = "Darwin" ]; then
    # macOS specific paths
    if [ -d "/opt/homebrew/Cellar/libsndfile" ]; then
        SNDFILE_INC="/opt/homebrew/Cellar/libsndfile/$(ls /opt/homebrew/Cellar/libsndfile | head -n1)/include"
        SNDFILE_LIB="/opt/homebrew/Cellar/libsndfile/$(ls /opt/homebrew/Cellar/libsndfile | head -n1)/lib"
    fi
    
    if [ -d "/opt/homebrew/Cellar/portaudio" ]; then
        PORTAUDIO_INC="/opt/homebrew/Cellar/portaudio/$(ls /opt/homebrew/Cellar/portaudio | head -n1)/include"
        PORTAUDIO_LIB="/opt/homebrew/Cellar/portaudio/$(ls /opt/homebrew/Cellar/portaudio | head -n1)/lib"
    fi
    
    if [ -n "$SNDFILE_INC" ] && [ -n "$PORTAUDIO_INC" ]; then
        if clang++ -std=c++17 -I$SNDFILE_INC -I$PORTAUDIO_INC -L$SNDFILE_LIB -L$PORTAUDIO_LIB -lsndfile -lportaudio -o test_compile test_compile.cpp 2>/dev/null; then
            echo "✓ Test compilation successful"
            rm -f test_compile test_compile.cpp
        else
            echo "✗ Test compilation failed"
        fi
    else
        echo "⚠ Skipping compilation test (library paths not found)"
    fi
else
    echo "⚠ Compilation test only implemented for macOS"
fi

echo ""
echo "=== Summary ==="
echo "If all checks pass with ✓, your environment is ready for voice cloning addon development."
echo ""
echo "Next steps:"
echo "1. Install missing dependencies using: ./scripts/setup-macos.sh"
echo "2. Initialize submodule: git submodule update --init --recursive"
echo "3. Install Node.js dependencies: npm install"
echo "4. Build the addon: npm run build:cpp"
echo "5. Run tests: npm test"