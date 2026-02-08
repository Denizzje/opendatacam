# Inference Sidecar

The sidecar now supports two runtime modes:

- `darkhelp` live inference (when DarkHelp/OpenCV are compiled in and model + video source are configured)
- `replay` fallback (sample detections JSON + MJPEG frame sequence)

## Current status

Implemented endpoints:

- `GET /healthz`
- `GET /readyz`
- `POST /api/v1/runtime/session/start`
- `POST /api/v1/runtime/session/stop`
- `GET /api/v1/runtime/session/status`
- `GET /api/v1/stream/detections` (continuous SSE payload stream, uses live DarkHelp detections when available, otherwise replay/demo)
- `GET /api/v1/stream/mjpeg` (continuous MJPEG stream, uses live DarkHelp frames when available, otherwise replay/static fallback)

## Runtime session payload overrides

`POST /api/v1/runtime/session/start` accepts optional `sidecar_runtime` overrides:

```json
{
  "sidecar_runtime": {
    "darkhelp_enabled": true,
    "darkhelp_cfg": "/opt/models/model.cfg",
    "darkhelp_weights": "/opt/models/model.weights",
    "darkhelp_names": "/opt/models/model.names",
    "darkhelp_threshold": 0.25,
    "video_source": "/opt/video/input.mp4",
    "video_loop": true,
    "mjpeg_quality": 80
  }
}
```

If a key is omitted, the sidecar falls back to environment defaults.

## Build locally

```bash
cmake -S services/inference-sidecar -B services/inference-sidecar/build
cmake --build services/inference-sidecar/build -j
./services/inference-sidecar/build/inference-sidecar
```

## Runtime environment variables

- `SIDECAR_PORT` (default: `9080`)
- `SIDECAR_VERSION` (default: `0.1.0`)
- `DARKNET_REF` (default: `master`)
- `DARKNET_COMMIT` (optional)
- `DARKHELP_COMMIT` (optional)
- `SIDECAR_ENABLE_DARKHELP` (default: `true`)
- `SIDECAR_DARKHELP_CFG` (optional, path to `.cfg`)
- `SIDECAR_DARKHELP_WEIGHTS` (optional, path to `.weights`)
- `SIDECAR_DARKHELP_NAMES` (optional, path to `.names`)
- `SIDECAR_DARKHELP_THRESHOLD` (default: `0.25`, clamped to `0..1`)
- `SIDECAR_VIDEO_SOURCE` (optional default source, e.g. video file, stream URL, webcam index)
- `SIDECAR_VIDEO_LOOP` (default: `true`, loops file sources on EOF)
- `DETECTIONS_STREAM_INTERVAL_MS` (default: `200`)
- `SIDECAR_DEFAULT_VIDEO_WIDTH` (default: `1280`)
- `SIDECAR_DEFAULT_VIDEO_HEIGHT` (default: `720`)
- `SIDECAR_EMIT_DEMO_DETECTIONS` (default: `false`)
- `SIDECAR_RESET_FRAME_COUNTER_ON_START` (default: `true`)
- `SIDECAR_REPLAY_LOOP` (default: `true`)
- `SIDECAR_REPLAY_FRAMES_DIR` (optional directory with `.jpg`/`.jpeg` frames)
- `SIDECAR_REPLAY_DETECTIONS_JSON` (optional JSON array of frame detections)
- `MJPEG_STREAM_INTERVAL_MS` (default: `200`)
- `MJPEG_BOUNDARY` (default: `frame`)
- `SIDECAR_MJPEG_QUALITY` (default: `80`, `1..100`)
- `SIDECAR_MJPEG_SAMPLE_FRAME` (optional absolute/relative path to JPEG frame)
