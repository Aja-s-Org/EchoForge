#!/usr/bin/env bash
# Build and run the addon's C++ unit tests (GoogleTest + CTest).
# Run from anywhere; build output goes to dist/tests/voice-cloning-addon-cpp.
set -euo pipefail

package_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
workspace_dir="$(cd "$package_dir/../.." && pwd)"
build_dir="$workspace_dir/dist/tests/voice-cloning-addon-cpp"

cmake -S "$package_dir/tests/cpp" -B "$build_dir" -DCMAKE_BUILD_TYPE=Debug
cmake --build "$build_dir" --parallel
ctest --test-dir "$build_dir" --output-on-failure
