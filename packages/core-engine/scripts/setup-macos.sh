#!/bin/bash

# Setup script for voice cloning addon on macOS
echo "Setting up voice cloning addon dependencies on macOS..."

# Check if Homebrew is installed
if ! command -v brew &> /dev/null; then
    echo "Homebrew not found. Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# Update Homebrew
echo "Updating Homebrew..."
brew update

# Install audio libraries
echo "Installing audio processing libraries..."
brew install libsndfile portaudio

# Install build tools
echo "Installing build tools..."
brew install cmake node-gyp

# Check for CUDA for GPU support (optional)
if brew list --cask | grep -q cuda; then
    echo "CUDA detected for GPU acceleration"
else
    echo "CUDA not installed. GPU acceleration will not be available."
    echo "To install CUDA: brew install --cask cuda"
fi

# Verify installations
echo "Verifying installations..."
cmake --version
node-gyp --version

echo ""
echo "System dependencies installation complete!"
echo ""
echo "Next steps:"
echo "1. Initialize git submodule: git submodule update --init --recursive"
echo "2. Install Node.js dependencies: npm install"
echo "3. Build the addon: npm run build:cpp"
# Install Python dependencies (if using Python integration)
echo "Checking Python environment..."
if command -v python3 &> /dev/null; then
    python_version=$(python3 --version | cut -d' ' -f2)
    echo "Python $python_version detected"
    
    # Check if virtual environment should be created
    read -p "Create Python virtual environment? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Creating Python virtual environment..."
        python3 -m venv venv
        source venv/bin/activate
        echo "Virtual environment activated. Run 'source venv/bin/activate' in future sessions."
    fi
    
    echo "Note: Python dependencies for f5-tts will be installed when building the addon."
    echo "Run 'npm run setup:python' to install f5-tts Python package."
else
    echo "Python 3 not found. Please install Python 3.10+ from https://www.python.org/"
fi