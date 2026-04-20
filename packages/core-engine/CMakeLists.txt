cmake_minimum_required(VERSION 3.15)
project(echoforge_core)

# 1. Include the Node-API (N-API) headers
# node-addon-api is the C++ wrapper that makes N-API easier to use
add_definitions(-DNAPI_VERSION=9)

# 2. Find the required Node.js headers and libraries
# cmake-js provides these automatically when called
include_directories(${CMAKE_JS_INC})

# 3. Define the source files
file(GLOB SOURCE_FILES "src/*.cpp" "src/*.h")

# 4. Create the .node binary
add_library(${PROJECT_NAME} SHARED ${SOURCE_FILES} ${CMAKE_JS_SRC})
set_target_properties(${PROJECT_NAME} PROPERTIES PREFIX "" SUFFIX ".node")

# 5. Link the node-addon-api
# This is usually provided by the npm package 'node-addon-api'
target_link_libraries(${PROJECT_NAME} ${CMAKE_JS_LIB})