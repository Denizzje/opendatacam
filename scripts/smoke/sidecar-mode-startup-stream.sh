#!/usr/bin/env bash
set -euo pipefail

APP_BASE_URL="${APP_BASE_URL:-http://127.0.0.1:8080}"
START_TIMEOUT_SECONDS="${START_TIMEOUT_SECONDS:-30}"
START_PAYLOAD="${START_PAYLOAD:-{}}"
START_PAYLOAD_FILE="${START_PAYLOAD_FILE:-}"

fail() {
  echo "[sidecar-smoke] ERROR: $*" >&2
  exit 1
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "required command not found: $1"
  fi
}

wait_for_session_start() {
  local started=0
  local attempt
  local max_attempts
  local status_json

  max_attempts=$((START_TIMEOUT_SECONDS * 2))
  for attempt in $(seq 1 "$max_attempts"); do
    status_json="$(curl -fsS "${APP_BASE_URL}/api/v2/runtime/status" || true)"
    if [[ "$status_json" == *"\"session_started\":true"* ]]; then
      started=1
      break
    fi
    sleep 0.5
  done

  if [[ "$started" -ne 1 ]]; then
    fail "runtime session did not reach session_started=true within ${START_TIMEOUT_SECONDS}s"
  fi
}

require_command curl

echo "[sidecar-smoke] Checking runtime health..."
curl -fsS "${APP_BASE_URL}/api/v2/runtime/health" >/dev/null

echo "[sidecar-smoke] Starting runtime session..."
if [[ -n "$START_PAYLOAD_FILE" ]]; then
  if [[ ! -f "$START_PAYLOAD_FILE" ]]; then
    fail "START_PAYLOAD_FILE does not exist: $START_PAYLOAD_FILE"
  fi

  curl -fsS \
    -X POST \
    -H 'Content-Type: application/json' \
    --data-binary "@${START_PAYLOAD_FILE}" \
    "${APP_BASE_URL}/api/v2/runtime/session/start" >/dev/null
else
  curl -fsS \
    -X POST \
    -H 'Content-Type: application/json' \
    -d "${START_PAYLOAD}" \
    "${APP_BASE_URL}/api/v2/runtime/session/start" >/dev/null
fi

wait_for_session_start

status_json="$(curl -fsS "${APP_BASE_URL}/api/v2/runtime/status")"
if [[ "$status_json" != *"\"detectionsSource\":\"sidecar\""* ]]; then
  fail "expected detectionsSource to be sidecar"
fi
if [[ "$status_json" != *"\"running\":true"* ]]; then
  fail "expected detections stream running=true in runtime status"
fi

echo "[sidecar-smoke] Verifying detections stream..."
detections_sample="$(
  curl -fsS --max-time 10 -N "${APP_BASE_URL}/api/v2/stream/detections" 2>/dev/null \
    | head -n 8 || true
)"
if [[ "$detections_sample" != *"data:"* ]]; then
  fail "detections stream did not return SSE payload"
fi

echo "[sidecar-smoke] Verifying MJPEG stream endpoint..."
mjpeg_headers="$(
  curl -s --max-time 10 -D - -o /dev/null "${APP_BASE_URL}/api/v2/stream/mjpeg" || true
)"
if ! grep -qi "content-type: multipart/x-mixed-replace" <<<"$mjpeg_headers"; then
  fail "MJPEG endpoint did not return multipart/x-mixed-replace"
fi

echo "[sidecar-smoke] Stopping runtime session..."
curl -fsS -X POST "${APP_BASE_URL}/api/v2/runtime/session/stop" >/dev/null

echo "[sidecar-smoke] OK"
