cmake_minimum_required(VERSION 3.15)
project(echoforge_core)

# Include the Node-API (N-API) headers
add_definitions(-DNAPI_VERSION=9)

# Find the required Node.js headers and libraries
include_directories(${CMAKE_JS_INC})

# Voice Cloning Addon Configuration
# Set C++ standard
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

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

# Voice cloning source files
set(VOICE_CLONING_SOURCES
  src/cpp/addon.cc
  src/cpp/voice_cloner.cc
  src/cpp/audio_processor.cc
  src/cpp/f5_tts_wrapper.cc
  src/cpp/python_service_client.cc
  src/cpp/memory_pool.cc
  src/cpp/memory_monitor.cc
)

# Core engine source files (existing + voice cloning)
file(GLOB CORE_SOURCE_FILES "src/lib/*.cpp" "src/lib/*.h")
set(SOURCE_FILES ${CORE_SOURCE_FILES} ${VOICE_CLONING_SOURCES})

# Create the .node binary
add_library(${PROJECT_NAME} SHARED ${SOURCE_FILES} ${CMAKE_JS_SRC})
set_target_properties(${PROJECT_NAME} PROPERTIES PREFIX "" SUFFIX ".node")

# Link the node-addon-api and voice cloning dependencies
target_link_libraries(${PROJECT_NAME} 
  ${CMAKE_JS_LIB}
  ${PortAudio_LIBRARIES}
  ${SndFile_LIBRARIES}
)

message(STATUS "Core Engine configured with voice cloning support")
message(STATUS "Total source files: ${SOURCE_FILES}")
message(STATUS "Voice cloning sources: ${VOICE_CLONING_SOURCES}")