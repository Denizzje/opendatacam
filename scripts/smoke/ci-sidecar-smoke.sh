#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
APP_PORT="${APP_PORT:-8080}"
SIDECAR_PORT="${SIDECAR_PORT:-9080}"
APP_BASE_URL="${APP_BASE_URL:-http://127.0.0.1:${APP_PORT}}"
SIDECAR_BASE_URL="${SIDECAR_BASE_URL:-http://127.0.0.1:${SIDECAR_PORT}}"
CONFIG_PATH="${CONFIG_PATH:-${REPO_ROOT}/config/config.v4.example.json}"
LOG_DIR="${LOG_DIR:-${REPO_ROOT}/.build/ci-smoke}"

mkdir -p "${LOG_DIR}"

MOCK_SIDECAR_PID=""
APP_PID=""

cleanup() {
  if [[ -n "${APP_PID}" ]]; then
    kill "${APP_PID}" >/dev/null 2>&1 || true
  fi
  if [[ -n "${MOCK_SIDECAR_PID}" ]]; then
    kill "${MOCK_SIDECAR_PID}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

wait_for_url() {
  local url="$1"
  local label="$2"
  local timeout_seconds="${3:-60}"
  local max_attempts=$((timeout_seconds * 2))
  local attempt

  for attempt in $(seq 1 "${max_attempts}"); do
    if curl -fsS --max-time 2 "${url}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.5
  done

  echo "[ci-sidecar-smoke] ERROR: timeout waiting for ${label} at ${url}" >&2
  exit 1
}

echo "[ci-sidecar-smoke] Starting mock sidecar..."
(
  cd "${REPO_ROOT}"
  SIDECAR_PORT="${SIDECAR_PORT}" \
    node scripts/smoke/mock-sidecar.js >>"${LOG_DIR}/mock-sidecar.log" 2>&1
) &
MOCK_SIDECAR_PID=$!
wait_for_url "${SIDECAR_BASE_URL}/healthz" "mock sidecar healthz" 30

echo "[ci-sidecar-smoke] Starting OpenDataCam..."
(
  cd "${REPO_ROOT}"
  PORT="${APP_PORT}" \
  NODE_ENV=production \
  OPENDATACAM_CONFIG_PATH="${CONFIG_PATH}" \
  INFERENCE_SIDECAR_URL="${SIDECAR_BASE_URL}" \
  OPENDATACAM_V2_USE_SIDECAR_DETECTIONS=true \
  OPENDATACAM_V2_MJPEG_FALLBACK_LEGACY=false \
  OPENDATACAM_V2_AUTO_START_ON_ROOT=false \
  node server.js >>"${LOG_DIR}/opendatacam.log" 2>&1
) &
APP_PID=$!
wait_for_url "${APP_BASE_URL}/api/v2/runtime/health" "OpenDataCam runtime health" 120

echo "[ci-sidecar-smoke] Running smoke script..."
(
  cd "${REPO_ROOT}"
  APP_BASE_URL="${APP_BASE_URL}" npm run smoke:sidecar
)

echo "[ci-sidecar-smoke] OK"
