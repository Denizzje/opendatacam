#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
APP_PORT="${APP_PORT:-8080}"
SIDECAR_PORT="${SIDECAR_PORT:-9080}"
APP_BASE_URL="${APP_BASE_URL:-http://127.0.0.1:${APP_PORT}}"
SIDECAR_BASE_URL="${SIDECAR_BASE_URL:-http://127.0.0.1:${SIDECAR_PORT}}"
LEGOGEARS_DIR="${LEGOGEARS_DIR:-${REPO_ROOT}/LegoGears_v2}"
LEGOGEARS_CFG="${LEGOGEARS_CFG:-${LEGOGEARS_DIR}/LegoGears.cfg}"
LEGOGEARS_WEIGHTS="${LEGOGEARS_WEIGHTS:-${LEGOGEARS_DIR}/LegoGears_best.weights}"
LEGOGEARS_NAMES="${LEGOGEARS_NAMES:-${LEGOGEARS_DIR}/LegoGears.names}"
LEGOGEARS_VIDEO="${LEGOGEARS_VIDEO:-${LEGOGEARS_DIR}/DSCN1580A.MOV}"
DEMO_CONFIG_PATH="${DEMO_CONFIG_PATH:-${REPO_ROOT}/config/config.v4.example.json}"
LOG_DIR="${LOG_DIR:-${REPO_ROOT}/.build/demo-logs}"
KEEP_RUNNING=0

if [[ "${1:-}" == "--keep-running" ]]; then
  KEEP_RUNNING=1
fi

mkdir -p "$LOG_DIR"

started_sidecar=0
sidecar_pid=""
started_opendatacam=0
opendatacam_pid=""

fail() {
  echo "[legogears-demo] ERROR: $*" >&2
  exit 1
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "required command not found: $1"
  fi
}

require_file() {
  if [[ ! -f "$1" ]]; then
    fail "required file not found: $1"
  fi
}

wait_for_url() {
  local url="$1"
  local label="$2"
  local max_seconds="${3:-60}"
  local attempt
  local max_attempts

  max_attempts=$((max_seconds * 2))
  for attempt in $(seq 1 "$max_attempts"); do
    if curl -fsS --max-time 2 "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.5
  done

  fail "timed out waiting for ${label} at ${url}"
}

cleanup() {
  if [[ "$KEEP_RUNNING" -eq 1 ]]; then
    return
  fi

  if [[ "$started_opendatacam" -eq 1 && -n "$opendatacam_pid" ]]; then
    kill "$opendatacam_pid" >/dev/null 2>&1 || true
  fi
  if [[ "$started_sidecar" -eq 1 && -n "$sidecar_pid" ]]; then
    kill "$sidecar_pid" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

ensure_sidecar_binary() {
  local binary_path="${REPO_ROOT}/services/inference-sidecar/build/inference-sidecar"
  if [[ -x "$binary_path" ]]; then
    return 0
  fi

  echo "[legogears-demo] Building inference sidecar binary..."
  cmake -S "${REPO_ROOT}/services/inference-sidecar" -B "${REPO_ROOT}/services/inference-sidecar/build" >/dev/null
  cmake --build "${REPO_ROOT}/services/inference-sidecar/build" -j >/dev/null
}

start_sidecar_if_needed() {
  if curl -fsS --max-time 2 "${SIDECAR_BASE_URL}/healthz" >/dev/null 2>&1; then
    echo "[legogears-demo] Reusing running sidecar at ${SIDECAR_BASE_URL}"
    return
  fi

  ensure_sidecar_binary
  echo "[legogears-demo] Starting sidecar..."
  if [[ "$KEEP_RUNNING" -eq 1 ]]; then
    (
      cd "$REPO_ROOT"
      nohup env \
        SIDECAR_PORT="$SIDECAR_PORT" \
        SIDECAR_ENABLE_DARKHELP=true \
        SIDECAR_EMIT_DEMO_DETECTIONS=false \
        "${REPO_ROOT}/services/inference-sidecar/build/inference-sidecar" \
        >>"${LOG_DIR}/inference-sidecar.log" 2>&1 < /dev/null &
      echo $! > "${LOG_DIR}/inference-sidecar.pid"
    )
    sidecar_pid="$(cat "${LOG_DIR}/inference-sidecar.pid")"
  else
    (
      cd "$REPO_ROOT"
      SIDECAR_PORT="$SIDECAR_PORT" \
      SIDECAR_ENABLE_DARKHELP=true \
      SIDECAR_EMIT_DEMO_DETECTIONS=false \
      "${REPO_ROOT}/services/inference-sidecar/build/inference-sidecar" \
        >>"${LOG_DIR}/inference-sidecar.log" 2>&1
    ) &
    sidecar_pid=$!
    started_sidecar=1
  fi
  wait_for_url "${SIDECAR_BASE_URL}/healthz" "sidecar healthz"
}

start_opendatacam_if_needed() {
  if curl -fsS --max-time 2 "${APP_BASE_URL}/api/v2/runtime/health" >/dev/null 2>&1; then
    echo "[legogears-demo] Reusing running OpenDataCam at ${APP_BASE_URL}"
    return
  fi

  echo "[legogears-demo] Starting OpenDataCam server..."
  if [[ "$KEEP_RUNNING" -eq 1 ]]; then
    (
      cd "$REPO_ROOT"
      nohup env \
        PORT="$APP_PORT" \
        NODE_ENV=development \
        OPENDATACAM_CONFIG_PATH="$DEMO_CONFIG_PATH" \
        INFERENCE_SIDECAR_URL="$SIDECAR_BASE_URL" \
        OPENDATACAM_V2_USE_SIDECAR_DETECTIONS=true \
        OPENDATACAM_V2_MJPEG_FALLBACK_LEGACY=false \
        scripts/npm/startServer.sh >>"${LOG_DIR}/opendatacam.log" 2>&1 < /dev/null &
      echo $! > "${LOG_DIR}/opendatacam.pid"
    )
    opendatacam_pid="$(cat "${LOG_DIR}/opendatacam.pid")"
  else
    (
      cd "$REPO_ROOT"
      PORT="$APP_PORT" \
      NODE_ENV=development \
      OPENDATACAM_CONFIG_PATH="$DEMO_CONFIG_PATH" \
      INFERENCE_SIDECAR_URL="$SIDECAR_BASE_URL" \
      OPENDATACAM_V2_USE_SIDECAR_DETECTIONS=true \
      OPENDATACAM_V2_MJPEG_FALLBACK_LEGACY=false \
      scripts/npm/startServer.sh >>"${LOG_DIR}/opendatacam.log" 2>&1
    ) &
    opendatacam_pid=$!
    started_opendatacam=1
  fi
  wait_for_url "${APP_BASE_URL}/api/v2/runtime/health" "runtime health" 180
}

wait_for_processed_frames() {
  local max_attempts=80
  local attempt
  local readiness_json

  for attempt in $(seq 1 "$max_attempts"); do
    readiness_json="$(curl -fsS "${APP_BASE_URL}/api/v2/runtime/health" || true)"
    if echo "$readiness_json" | grep -Eq '"processed_frames":[1-9]'; then
      return 0
    fi
    sleep 0.5
  done

  fail "did not observe processed_frames > 0 in sidecar readiness"
}

require_command curl
require_command cmake
require_file "$LEGOGEARS_CFG"
require_file "$LEGOGEARS_WEIGHTS"
require_file "$LEGOGEARS_NAMES"
require_file "$LEGOGEARS_VIDEO"
require_file "$DEMO_CONFIG_PATH"

start_sidecar_if_needed
start_opendatacam_if_needed

echo "[legogears-demo] Starting LegoGears runtime session..."
start_payload="$(cat <<JSON
{
  "sidecar_runtime": {
    "darkhelp_enabled": true,
    "darkhelp_cfg": "${LEGOGEARS_CFG}",
    "darkhelp_weights": "${LEGOGEARS_WEIGHTS}",
    "darkhelp_names": "${LEGOGEARS_NAMES}",
    "darkhelp_threshold": 0.25,
    "video_source": "${LEGOGEARS_VIDEO}",
    "video_loop": true,
    "mjpeg_quality": 80
  }
}
JSON
)"
curl -fsS \
  -X POST \
  -H 'Content-Type: application/json' \
  -d "$start_payload" \
  "${APP_BASE_URL}/api/v2/runtime/session/start" >/dev/null

wait_for_processed_frames

echo "[legogears-demo] Runtime status:"
curl -fsS "${APP_BASE_URL}/api/v2/runtime/status"
echo

echo "[legogears-demo] First detections events:"
curl -fsS --max-time 10 -N "${APP_BASE_URL}/api/v2/stream/detections" 2>/dev/null | head -n 12 || true
echo

echo "[legogears-demo] MJPEG response headers:"
mjpeg_headers="$(
  curl -s --max-time 10 -D - -o /dev/null "${APP_BASE_URL}/api/v2/stream/mjpeg" || true
)"
if ! grep -qi "content-type: multipart/x-mixed-replace" <<<"$mjpeg_headers"; then
  fail "MJPEG endpoint did not return multipart/x-mixed-replace"
fi
echo "$mjpeg_headers" | head -n 8
echo

if [[ "$KEEP_RUNNING" -eq 1 ]]; then
  echo "[legogears-demo] Services left running."
  echo "[legogears-demo] Open UI: ${APP_BASE_URL}"
  if [[ -f "${LOG_DIR}/opendatacam.pid" && -f "${LOG_DIR}/inference-sidecar.pid" ]]; then
    echo "[legogears-demo] Stop later with:"
    echo "  kill \$(cat ${LOG_DIR}/opendatacam.pid) \$(cat ${LOG_DIR}/inference-sidecar.pid)"
  fi
else
  echo "[legogears-demo] Demo complete. Services started by this script will be stopped."
fi
