cmake_minimum_required(VERSION 3.14)
project(voice_cloning_core_test VERSION 1.0.0 LANGUAGES C CXX)

# Set C++ standard
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Build type
if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE Debug)
endif()

# Include directories
include_directories(
  ${CMAKE_CURRENT_SOURCE_DIR}/../include
  ${CMAKE_CURRENT_SOURCE_DIR}/../src/cpp
)

# Find required libraries
find_package(SndFile QUIET)
find_package(jsoncpp QUIET)

if(NOT SndFile_FOUND)
  message(WARNING "libsndfile not found. Some audio tests may be limited.")
  # Create dummy target for SndFile
  add_library(SndFile INTERFACE)
  set(SndFile_LIBRARIES SndFile)
endif()

if(NOT jsoncpp_FOUND)
  message(WARNING "jsoncpp not found. Python service client tests may fail.")
  # Create dummy target for jsoncpp
  add_library(jsoncpp INTERFACE)
  set(jsoncpp_LIBRARIES jsoncpp)
endif()

# Source files for core library (excluding Node.js dependencies)
set(CORE_SOURCES
  ../src/cpp/audio_processor.cc
  ../src/cpp/config_manager.cc
  ../src/cpp/f5_tts_wrapper.cc
  # ../src/cpp/python_service_client.cc  # Requires JSON library
)

# Create static library for core components
add_library(voice_cloning_core STATIC ${CORE_SOURCES})

target_include_directories(voice_cloning_core
  PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/../include
)

target_link_libraries(voice_cloning_core
  PRIVATE
    ${SndFile_LIBRARIES}
    # ${jsoncpp_LIBRARIES}  # Temporarily disabled for testing
)

# Test executable
add_executable(test_core
  test_core.cc
)

target_link_libraries(test_core
  PRIVATE
    voice_cloning_core
    ${SndFile_LIBRARIES}
    # ${jsoncpp_LIBRARIES}  # Temporarily disabled
)

# Set compiler flags
if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
  target_compile_options(voice_cloning_core PRIVATE -Wall -Wextra)
  target_compile_options(test_core PRIVATE -Wall -Wextra)
endif()