# Inference Sidecar (Scaffold)

This is the first scaffold of the modern inference sidecar.

## Current status

Implemented endpoints:

- `GET /healthz`
- `GET /readyz`
- `POST /api/v1/runtime/session/start`
- `POST /api/v1/runtime/session/stop`
- `GET /api/v1/runtime/session/status`
- `GET /api/v1/stream/detections` (continuous SSE payload stream)
- `GET /api/v1/stream/mjpeg` (continuous MJPEG stream using configured sample frame)

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
- `DETECTIONS_STREAM_INTERVAL_MS` (default: `200`)
- `SIDECAR_DEFAULT_VIDEO_WIDTH` (default: `1280`)
- `SIDECAR_DEFAULT_VIDEO_HEIGHT` (default: `720`)
- `SIDECAR_EMIT_DEMO_DETECTIONS` (default: `false`)
- `SIDECAR_RESET_FRAME_COUNTER_ON_START` (default: `true`)
- `MJPEG_STREAM_INTERVAL_MS` (default: `200`)
- `MJPEG_BOUNDARY` (default: `frame`)
- `SIDECAR_MJPEG_SAMPLE_FRAME` (optional absolute/relative path to JPEG frame)
