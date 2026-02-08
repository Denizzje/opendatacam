#include <atomic>
#include <chrono>
#include <cstdlib>
#include <iostream>
#include <mutex>
#include <string>

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

class RuntimeState {
 public:
  void start(const json & payload) {
    std::lock_guard<std::mutex> lock(mutex_);
    sessionStarted_ = true;
    sessionPayload_ = payload;
    startTime_ = std::chrono::steady_clock::now();
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

    if (sessionStarted_) {
      const auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::steady_clock::now() - startTime_);
      response["uptime_ms"] = elapsed.count();
    } else {
      response["uptime_ms"] = 0;
    }

    return response;
  }

  long long nextFrameId() {
    std::lock_guard<std::mutex> lock(mutex_);
    frameId_ += 1;
    return frameId_;
  }

 private:
  mutable std::mutex mutex_;
  bool sessionStarted_ = false;
  long long frameId_ = 0;
  json sessionPayload_ = json::object();
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

  RuntimeState state;
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
      {"darkhelp_commit", darkhelpCommit}
    };
    res.set_content(body.dump(), "application/json");
  });

  server.Post("/api/v1/runtime/session/start", [&](const httplib::Request & req, httplib::Response & res) {
    const json payload = parseOrEmptyObject(req.body);
    state.start(payload);

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
    json detection = {
      {"frame_id", state.nextFrameId()},
      {"timestamp_ms", static_cast<long long>(std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::system_clock::now().time_since_epoch()).count())},
      {"objects", json::array()},
      {"source", "inference-sidecar-scaffold"}
    };
    const std::string payload = "event: detections\ndata: " + detection.dump() + "\n\n";
    res.set_content(payload, "text/event-stream");
  });

  server.Get("/api/v1/stream/mjpeg", [&](const httplib::Request &, httplib::Response & res) {
    json body = {
      {"status", "not_implemented"},
      {"message", "MJPEG stream endpoint not implemented yet."}
    };
    res.status = 501;
    res.set_content(body.dump(), "application/json");
  });

  const int port = getPort();
  std::cout << "inference-sidecar listening on 0.0.0.0:" << port << std::endl;
  server.listen("0.0.0.0", port);

  return 0;
}
