cmake_minimum_required(VERSION 3.20)
project(inference_sidecar LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
option(SIDECAR_ENABLE_DARKHELP "Enable DarkHelp inference support when dependencies are available" ON)

include(FetchContent)

FetchContent_Declare(
  cpp_httplib
  GIT_REPOSITORY https://github.com/yhirose/cpp-httplib.git
  GIT_TAG v0.16.2
)

FetchContent_Declare(
  nlohmann_json
  GIT_REPOSITORY https://github.com/nlohmann/json.git
  GIT_TAG v3.11.3
)

FetchContent_MakeAvailable(cpp_httplib nlohmann_json)

add_executable(inference-sidecar src/main.cpp)
target_link_libraries(inference-sidecar PRIVATE httplib::httplib nlohmann_json::nlohmann_json)

if (SIDECAR_ENABLE_DARKHELP)
  find_package(OpenCV QUIET COMPONENTS core imgcodecs videoio)
  find_library(DARKHELP_LIBRARY darkhelp)
  find_library(DARKNET_LIBRARY darknet)

  if (OpenCV_FOUND AND DARKHELP_LIBRARY AND DARKNET_LIBRARY)
    message(STATUS "Building inference-sidecar with DarkHelp support")
    target_compile_definitions(inference-sidecar PRIVATE SIDECAR_HAS_DARKHELP=1)
    target_include_directories(inference-sidecar PRIVATE ${OpenCV_INCLUDE_DIRS})
    target_link_libraries(inference-sidecar PRIVATE ${OpenCV_LIBS} ${DARKHELP_LIBRARY} ${DARKNET_LIBRARY})
  else()
    message(WARNING "DarkHelp/OpenCV dependencies not found, building replay-only sidecar.")
  endif()
else()
  message(STATUS "Building replay-only sidecar (SIDECAR_ENABLE_DARKHELP=OFF)")
endif()
