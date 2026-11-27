# Native unit tests for voice-cloning-addon.
#
# Builds the addon's core C++ (no Node-API) into a static library and runs
# GoogleTest suites against it:
#
#   cmake -S tests/cpp -B ../../dist/tests/voice-cloning-addon-cpp
#   cmake --build ../../dist/tests/voice-cloning-addon-cpp
#   ctest --test-dir ../../dist/tests/voice-cloning-addon-cpp --output-on-failure
#
# Or via Nx: nx run @echoforge/voice-cloning-addon:test-native
#
# Needs: a C++17 compiler, CMake, pkg-config, libsndfile, PortAudio and GoogleTest
# (Ubuntu: build-essential cmake pkg-config libsndfile1-dev portaudio19-dev libgtest-dev).
cmake_minimum_required(VERSION 3.16)
project(voice_cloning_addon_tests LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

set(ADDON_ROOT ${CMAKE_CURRENT_SOURCE_DIR}/../..)

find_package(GTest REQUIRED)
find_package(Threads REQUIRED)
find_package(PkgConfig REQUIRED)
pkg_check_modules(SNDFILE REQUIRED IMPORTED_TARGET sndfile)
# audio_processor.h includes <portaudio.h>.
pkg_check_modules(PORTAUDIO REQUIRED IMPORTED_TARGET portaudio-2.0)

# Core sources that don't depend on Node-API.
# memory_pool.cc is left out: it implements AudioBufferPool, which
# include/memory_pool.h doesn't declare, so it doesn't compile.
# python_service_client.cc is left out: it needs jsoncpp and isn't wired in yet.
add_library(voice_cloning_core STATIC
  ${ADDON_ROOT}/src/cpp/audio_processor.cc
  ${ADDON_ROOT}/src/cpp/config_manager.cc
  ${ADDON_ROOT}/src/cpp/f5_tts_wrapper.cc
)
target_include_directories(voice_cloning_core PUBLIC ${ADDON_ROOT}/include)
target_link_libraries(voice_cloning_core PUBLIC PkgConfig::SNDFILE PkgConfig::PORTAUDIO Threads::Threads)

add_executable(voice_cloning_tests
  test_audio_processor.cc
  test_config_manager.cc
  test_f5_tts_wrapper.cc
)
target_link_libraries(voice_cloning_tests PRIVATE voice_cloning_core GTest::gtest_main)

enable_testing()
include(GoogleTest)
# A timeout so a deadlock fails the test instead of hanging the build.
gtest_discover_tests(voice_cloning_tests PROPERTIES TIMEOUT 30)
