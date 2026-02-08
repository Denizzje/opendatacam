#include <atomic>
#include <chrono>
#include <cstdlib>
#include <fstream>
#include <iostream>
#include <mutex>
#include <optional>
#include <string>
#include <thread>
#include <vector>

#include <httplib.h>
#include <nlohmann/json.hpp>

namespace {

using json = nlohmann::json;

const char * kDarknetRepo = "https://codeberg.org/CCodeRun/darknet";

std::string getEnvOrDefault(const char * name, const std::string & defaultValue) {
  const char * value = std::getenv(name);
  if (value == nullptr || std::string(value).empty()) {
    return defaultValue;
  }

  return value;
}

int getPort() {
  const std::string sidecarPort = getEnvOrDefault("SIDECAR_PORT", "9080");
  try {
    return std::stoi(sidecarPort);
  } catch (const std::exception &) {
    return 9080;
  }
}

int getPositiveIntOrDefault(const char * name, int defaultValue) {
  const std::string value = getEnvOrDefault(name, "");
  if (value.empty()) {
    return defaultValue;
  }

  try {
    const int parsed = std::stoi(value);
    if (parsed <= 0) {
      return defaultValue;
    }

    return parsed;
  } catch (const std::exception &) {
    return defaultValue;
  }
}

bool getBoolOrDefault(const char * name, bool defaultValue) {
  const std::string value = getEnvOrDefault(name, "");
  if (value.empty()) {
    return defaultValue;
  }

  if (value == "1" || value == "true" || value == "TRUE" || value == "yes" || value == "on") {
    return true;
  }

  if (value == "0" || value == "false" || value == "FALSE" || value == "no" || value == "off") {
    return false;
  }

  return defaultValue;
}

std::vector<unsigned char> loadBinaryFile(const std::string & path) {
  std::ifstream file(path, std::ios::binary);
  if (!file) {
    return {};
  }

  file.seekg(0, std::ios::end);
  const auto size = static_cast<size_t>(file.tellg());
  file.seekg(0, std::ios::beg);

  std::vector<unsigned char> content(size);
  if (size > 0) {
    file.read(reinterpret_cast<char *>(content.data()), static_cast<std::streamsize>(size));
  }

  return content;
}

std::string resolveMjpegFramePath(const std::string & configuredPath) {
  if (!configuredPath.empty()) {
    return configuredPath;
  }

  const std::vector<std::string> candidates = {
    "public/static/placeholder/frames/001.jpg",
    "services/inference-sidecar/assets/mjpeg-placeholder.jpg",
    "/opt/src/inference-sidecar/assets/mjpeg-placeholder.jpg"
  };

  for (const auto & candidate : candidates) {
    std::ifstream file(candidate, std::ios::binary);
    if (file.good()) {
      return candidate;
    }
  }

  return "";
}

std::optional<int> jsonNumberToInt(const json & value) {
  if (value.is_number_integer()) {
    return value.get<int>();
  }

  if (value.is_number_unsigned()) {
    return static_cast<int>(value.get<unsigned int>());
  }

  if (value.is_number_float()) {
    return static_cast<int>(value.get<double>());
  }

  return std::nullopt;
}

std::optional<json> extractVideoResolution(const json & payload) {
  if (!payload.is_object()) {
    return std::nullopt;
  }

  const std::vector<std::string> keys = {
    "video_resolution",
    "videoResolution",
    "resolution",
    "frame_resolution",
    "frameResolution"
  };

  for (const auto & key : keys) {
    if (!payload.contains(key)) {
      continue;
    }

    const auto & candidate = payload[key];
    if (!candidate.is_object()) {
      continue;
    }

    std::optional<int> width = std::nullopt;
    std::optional<int> height = std::nullopt;

    if (candidate.contains("w")) {
      width = jsonNumberToInt(candidate["w"]);
    } else if (candidate.contains("width")) {
      width = jsonNumberToInt(candidate["width"]);
    } else if (candidate.contains("cols")) {
      width = jsonNumberToInt(candidate["cols"]);
    }

    if (candidate.contains("h")) {
      height = jsonNumberToInt(candidate["h"]);
    } else if (candidate.contains("height")) {
      height = jsonNumberToInt(candidate["height"]);
    } else if (candidate.contains("rows")) {
      height = jsonNumberToInt(candidate["rows"]);
    }

    if (width.has_value() && height.has_value() && width.value() > 0 && height.value() > 0) {
      return json{
        {"w", width.value()},
        {"h", height.value()}
      };
    }
  }

  return std::nullopt;
}

class RuntimeState {
 public:
  RuntimeState(int defaultVideoWidth, int defaultVideoHeight)
      : videoResolution_({
          {"w", defaultVideoWidth},
          {"h", defaultVideoHeight}
        }) {}

  void start(const json & payload, bool resetFrameCounter) {
    std::lock_guard<std::mutex> lock(mutex_);
    sessionStarted_ = true;
    sessionPayload_ = payload;
    startTime_ = std::chrono::steady_clock::now();
    if (resetFrameCounter) {
      frameId_ = 0;
    }

    const auto extractedResolution = extractVideoResolution(payload);
    if (extractedResolution.has_value()) {
      videoResolution_ = extractedResolution.value();
    }
  }

  void stop() {
    std::lock_guard<std::mutex> lock(mutex_);
    sessionStarted_ = false;
    sessionPayload_.clear();
  }

  json toJson() const {
    std::lock_guard<std::mutex> lock(mutex_);

    json response;
    response["session_started"] = sessionStarted_;
    response["session_payload"] = sessionPayload_;
    response["video_resolution"] = videoResolution_;

    if (sessionStarted_) {
      const auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::steady_clock::now() - startTime_);
      response["uptime_ms"] = elapsed.count();
    } else {
      response["uptime_ms"] = 0;
    }

    return response;
  }

  json nextDetection(bool emitDemoObject) {
    std::lock_guard<std::mutex> lock(mutex_);
    frameId_ += 1;

    const auto nowTimestamp = static_cast<long long>(std::chrono::duration_cast<std::chrono::milliseconds>(
      std::chrono::system_clock::now().time_since_epoch()).count());

    json objects = json::array();
    if (sessionStarted_ && emitDemoObject) {
      // Generate one moving detection in normalized coordinates for smoke testing end-to-end flow.
      const auto phase = static_cast<double>(frameId_ % 200) / 200.0;
      const auto centerX = 0.1 + (phase * 0.8);
      const auto centerY = 0.55;
      objects.push_back({
        {"name", "demo-object"},
        {"confidence", 0.85},
        {"relative_coordinates", {
          {"center_x", centerX},
          {"center_y", centerY},
          {"width", 0.12},
          {"height", 0.18}
        }}
      });
    }

    return json{
      {"frame_id", frameId_},
      {"timestamp_ms", nowTimestamp},
      {"session_started", sessionStarted_},
      {"video_resolution", videoResolution_},
      {"objects", objects},
      {"source", "inference-sidecar-scaffold"}
    };
  }

 private:
  mutable std::mutex mutex_;
  bool sessionStarted_ = false;
  long long frameId_ = 0;
  json sessionPayload_ = json::object();
  json videoResolution_ = json::object();
  std::chrono::steady_clock::time_point startTime_ = std::chrono::steady_clock::now();
};

json parseOrEmptyObject(const std::string & body) {
  if (body.empty()) {
    return json::object();
  }

  try {
    return json::parse(body);
  } catch (const std::exception &) {
    return json::object();
  }
}

}  // namespace

int main() {
  const std::string darknetRef = getEnvOrDefault("DARKNET_REF", "master");
  const std::string darknetCommit = getEnvOrDefault("DARKNET_COMMIT", "");
  const std::string darkhelpCommit = getEnvOrDefault("DARKHELP_COMMIT", "");
  const std::string sidecarVersion = getEnvOrDefault("SIDECAR_VERSION", "0.1.0");
  const int detectionsIntervalMs = getPositiveIntOrDefault("DETECTIONS_STREAM_INTERVAL_MS", 200);
  const int defaultVideoWidth = getPositiveIntOrDefault("SIDECAR_DEFAULT_VIDEO_WIDTH", 1280);
  const int defaultVideoHeight = getPositiveIntOrDefault("SIDECAR_DEFAULT_VIDEO_HEIGHT", 720);
  const bool emitDemoDetection = getBoolOrDefault("SIDECAR_EMIT_DEMO_DETECTIONS", false);
  const bool resetFrameCounterOnStart = getBoolOrDefault("SIDECAR_RESET_FRAME_COUNTER_ON_START", true);
  const int mjpegIntervalMs = getPositiveIntOrDefault("MJPEG_STREAM_INTERVAL_MS", 200);
  const std::string mjpegBoundary = getEnvOrDefault("MJPEG_BOUNDARY", "frame");
  const std::string configuredMjpegFramePath = getEnvOrDefault("SIDECAR_MJPEG_SAMPLE_FRAME", "");
  const std::string mjpegFramePath = resolveMjpegFramePath(configuredMjpegFramePath);
  const std::vector<unsigned char> mjpegFrameBytes = loadBinaryFile(mjpegFramePath);

  RuntimeState state(defaultVideoWidth, defaultVideoHeight);
  httplib::Server server;

  server.Get("/healthz", [&](const httplib::Request &, httplib::Response & res) {
    json body = {
      {"status", "ok"},
      {"service", "inference-sidecar"}
    };
    res.set_content(body.dump(), "application/json");
  });

  server.Get("/readyz", [&](const httplib::Request &, httplib::Response & res) {
    json body = {
      {"status", "ready"},
      {"service", "inference-sidecar"},
      {"version", sidecarVersion},
      {"darknet_repo", kDarknetRepo},
      {"darknet_ref", darknetRef},
      {"darknet_commit", darknetCommit},
      {"darkhelp_commit", darkhelpCommit},
      {"mjpeg_available", !mjpegFrameBytes.empty()},
      {"mjpeg_frame_path", mjpegFramePath}
    };
    res.set_content(body.dump(), "application/json");
  });

  server.Post("/api/v1/runtime/session/start", [&](const httplib::Request & req, httplib::Response & res) {
    const json payload = parseOrEmptyObject(req.body);
    state.start(payload, resetFrameCounterOnStart);

    json body = {
      {"status", "starting"},
      {"session", state.toJson()}
    };
    res.status = 202;
    res.set_content(body.dump(), "application/json");
  });

  server.Post("/api/v1/runtime/session/stop", [&](const httplib::Request &, httplib::Response & res) {
    state.stop();
    json body = {
      {"status", "stopped"},
      {"session", state.toJson()}
    };
    res.set_content(body.dump(), "application/json");
  });

  server.Get("/api/v1/runtime/session/status", [&](const httplib::Request &, httplib::Response & res) {
    json body = {
      {"status", "ok"},
      {"session", state.toJson()}
    };
    res.set_content(body.dump(), "application/json");
  });

  server.Get("/api/v1/stream/detections", [&](const httplib::Request &, httplib::Response & res) {
    res.set_header("Cache-Control", "no-cache");
    res.set_header("Connection", "keep-alive");
    res.set_chunked_content_provider(
      "text/event-stream",
      [&](size_t, httplib::DataSink & sink) {
        if (!sink.is_writable()) {
          sink.done();
          return false;
        }

        const json detection = state.nextDetection(emitDemoDetection);
        const std::string payload = "event: detections\ndata: " + detection.dump() + "\n\n";
        if (!sink.write(payload.data(), payload.size())) {
          return false;
        }

        std::this_thread::sleep_for(std::chrono::milliseconds(detectionsIntervalMs));
        return true;
      },
      [&](bool) {}
    );
  });

  server.Get("/api/v1/stream/mjpeg", [&](const httplib::Request &, httplib::Response & res) {
    if (mjpegFrameBytes.empty()) {
      json body = {
        {"status", "not_available"},
        {"message", "No sample MJPEG frame found for sidecar stream endpoint."}
      };
      res.status = 503;
      res.set_content(body.dump(), "application/json");
      return;
    }

    const std::string contentType = "multipart/x-mixed-replace; boundary=" + mjpegBoundary;
    const std::string frameHeader = "--" + mjpegBoundary + "\r\n"
      "Content-Type: image/jpeg\r\n"
      "Content-Length: " + std::to_string(mjpegFrameBytes.size()) + "\r\n\r\n";
    const std::string frameFooter = "\r\n";

    res.set_header("Cache-Control", "no-cache");
    res.set_header("Connection", "keep-alive");
    res.set_chunked_content_provider(
      contentType,
      [&, frameHeader, frameFooter](size_t, httplib::DataSink & sink) {
        if (!sink.is_writable()) {
          sink.done();
          return false;
        }

        if (!sink.write(frameHeader.data(), frameHeader.size())) {
          return false;
        }

        if (!sink.write(reinterpret_cast<const char *>(mjpegFrameBytes.data()),
          mjpegFrameBytes.size())) {
          return false;
        }

        if (!sink.write(frameFooter.data(), frameFooter.size())) {
          return false;
        }

        std::this_thread::sleep_for(std::chrono::milliseconds(mjpegIntervalMs));
        return true;
      },
      [&](bool) {}
    );
  });

  const int port = getPort();
  std::cout << "inference-sidecar listening on 0.0.0.0:" << port << std::endl;
  server.listen("0.0.0.0", port);

  return 0;
}
