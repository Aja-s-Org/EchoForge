cmake_minimum_required(VERSION 3.14)
project(voice_cloning_addon VERSION 1.0.0 LANGUAGES C CXX)

# Set C++ standard
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Build type
if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE Release)
endif()

# Output directories
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)
set(CMAKE_LIBRARY_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/lib)
set(CMAKE_ARCHIVE_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/lib)

# Include directories
include_directories(
  ${CMAKE_CURRENT_SOURCE_DIR}/include
  ${CMAKE_CURRENT_SOURCE_DIR}/src/cpp
  ${CMAKE_CURRENT_SOURCE_DIR}/../../third_party/f5-tts/src
)

# F5-TTS library configuration
set(F5_TTS_SOURCE_DIR ${CMAKE_CURRENT_SOURCE_DIR}/../../third_party/f5-tts)
set(F5_TTS_INCLUDE_DIR ${F5_TTS_SOURCE_DIR}/src)

# Find required libraries
find_package(PortAudio QUIET)
find_package(SndFile QUIET)
find_package(jsoncpp QUIET)

if(NOT PortAudio_FOUND)
  message(WARNING "PortAudio not found. Audio playback may not work.")
  # Create dummy target for PortAudio
  add_library(PortAudio INTERFACE)
  set(PortAudio_LIBRARIES PortAudio)
endif()

if(NOT SndFile_FOUND)
  message(WARNING "libsndfile not found. Audio file I/O may not work.")
  # Create dummy target for SndFile
  add_library(SndFile INTERFACE)
  set(SndFile_LIBRARIES SndFile)
endif()

if(NOT jsoncpp_FOUND)
  message(WARNING "jsoncpp not found. Install with: sudo apt-get install libjsoncpp-dev or brew install jsoncpp")
  # Create dummy target for jsoncpp
  add_library(jsoncpp INTERFACE)
  set(jsoncpp_LIBRARIES jsoncpp)
endif()

# Node.js Addon API
if(NOT DEFINED NODE_ADDON_API_DIR)
  # Try to find node-addon-api
  execute_process(
    COMMAND node -p "require('node-addon-api').include"
    OUTPUT_VARIABLE NODE_ADDON_API_INCLUDE
    OUTPUT_STRIP_TRAILING_WHITESPACE
  )
  if(NODE_ADDON_API_INCLUDE)
    set(NODE_ADDON_API_DIR ${NODE_ADDON_API_INCLUDE})
  endif()
endif()

if(NOT NODE_ADDON_API_DIR)
  message(WARNING "node-addon-api not found. Install with: npm install node-addon-api")
else()
  include_directories(${NODE_ADDON_API_DIR})
endif()

# Addon source files
set(ADDON_SOURCES
  src/cpp/addon.cc
  src/cpp/voice_cloner.cc
  src/cpp/audio_processor.cc
  src/cpp/python_service_client.cc
)

# Create shared library for Node.js addon
add_library(voice_cloning_addon SHARED ${ADDON_SOURCES})

# Link libraries
target_link_libraries(voice_cloning_addon
  PRIVATE
    ${PortAudio_LIBRARIES}
    ${SndFile_LIBRARIES}
    ${jsoncpp_LIBRARIES}
)

# Set properties for Node.js addon
set_target_properties(voice_cloning_addon PROPERTIES
  PREFIX ""
  SUFFIX ".node"
  OUTPUT_NAME "voice_cloning_addon"
)

# Installation
install(TARGETS voice_cloning_addon
  LIBRARY DESTINATION lib
  ARCHIVE DESTINATION lib
)

# F5-TTS wrapper library (if we build f5-tts as C++ library)
# For now, we'll create a placeholder
add_library(f5_tts_wrapper STATIC
  src/cpp/f5_tts_wrapper.cc
)

target_include_directories(f5_tts_wrapper
  PRIVATE
    ${F5_TTS_INCLUDE_DIR}
    ${CMAKE_CURRENT_SOURCE_DIR}/include
)

target_link_libraries(f5_tts_wrapper
  PRIVATE
    ${jsoncpp_LIBRARIES}
)

# Tests
if(BUILD_TESTING)
  enable_testing()
  
  # Add Google Test
  include(FetchContent)
  FetchContent_Declare(
    googletest
    URL https://github.com/google/googletest/archive/refs/tags/v1.14.0.tar.gz
  )
  
  set(gtest_force_shared_crt ON CACHE BOOL "" FORCE)
  FetchContent_MakeAvailable(googletest)
  
  # Test executable
  add_executable(voice_cloning_tests
    tests/cpp/test_voice_cloner.cc
    tests/cpp/test_audio_processor.cc
    tests/cpp/test_basic.cc
    tests/cpp/test_end_to_end.cc
  )
  
  target_link_libraries(voice_cloning_tests
    PRIVATE
      GTest::gtest_main
      voice_cloning_addon
      f5_tts_wrapper
      ${PortAudio_LIBRARIES}
      ${SndFile_LIBRARIES}
  )
  
  include(GoogleTest)
  gtest_discover_tests(voice_cloning_tests)
endif()

# Set compiler flags
if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
  target_compile_options(voice_cloning_addon PRIVATE -Wall -Wextra -Werror)
  target_compile_options(f5_tts_wrapper PRIVATE -Wall -Wextra -Werror)
endif()

# Platform-specific settings
if(APPLE)
  find_library(COREFOUNDATION CoreFoundation)
  find_library(AUDIOTOOLBOX AudioToolbox)
  target_link_libraries(voice_cloning_addon PRIVATE ${COREFOUNDATION} ${AUDIOTOOLBOX})
endif()

if(WIN32)
  target_compile_definitions(voice_cloning_addon PRIVATE _WIN32_WINNT=0x0A00)
endif()

# Memory management components
set(MEMORY_MANAGEMENT_SOURCES
  src/cpp/memory_pool.cc
  src/cpp/memory_monitor.cc
)

# Check if memory management files exist
foreach(SOURCE ${MEMORY_MANAGEMENT_SOURCES})
  if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/${SOURCE}")
    message(STATUS "Found memory management source: ${SOURCE}")
  else
    message(STATUS "Memory management source not found (will be created): ${SOURCE}")
    # Create empty file if it doesn't exist
    file(WRITE "${CMAKE_CURRENT_SOURCE_DIR}/${SOURCE}" "// Memory management implementation\n")
  endif()
endforeach()

# Addon source files (updated with memory management)
set(ADDON_SOURCES
  src/cpp/addon.cc
  src/cpp/voice_cloner.cc
  src/cpp/audio_processor.cc
  src/cpp/f5_tts_wrapper.cc
  src/cpp/python_service_client.cc
  ${MEMORY_MANAGEMENT_SOURCES}
)

# Create shared library for Node.js addon
add_library(voice_cloning_addon SHARED ${ADDON_SOURCES})

# Link libraries
target_link_libraries(voice_cloning_addon
  PRIVATE
    ${PortAudio_LIBRARIES}
    ${SndFile_LIBRARIES}
    ${JSONCPP_LIBRARIES}
)

# Set properties for Node.js addon
set_target_properties(voice_cloning_addon PROPERTIES
  PREFIX ""
  SUFFIX ".node"
  OUTPUT_NAME "voice_cloning_addon"
)

# Installation
install(TARGETS voice_cloning_addon
  LIBRARY DESTINATION lib
  ARCHIVE DESTINATION lib
)

# Test executable
if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/tests/cpp/test_basic.cc")
  add_executable(test_core
    tests/cpp/test_basic.cc
    ${ADDON_SOURCES}
  )
  
  target_link_libraries(test_core
    PRIVATE
      ${PortAudio_LIBRARIES}
      ${SndFile_LIBRARIES}
      ${JSONCPP_LIBRARIES}
      GTest::gtest
      GTest::gtest_main
  )
  
  set_target_properties(test_core PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/tests
  )
endif()

message(STATUS "Memory management components added to build")
message(STATUS "Total source files: ${ADDON_SOURCES}")