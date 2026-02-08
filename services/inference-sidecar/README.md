# Inference Sidecar (Scaffold)

This is the first scaffold of the modern inference sidecar.

## Current status

Implemented endpoints:

- `GET /healthz`
- `GET /readyz`
- `POST /api/v1/runtime/session/start`
- `POST /api/v1/runtime/session/stop`
- `GET /api/v1/runtime/session/status`
- `GET /api/v1/stream/detections` (scaffold SSE event payload)

Not implemented yet:

- `GET /api/v1/stream/mjpeg`

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
