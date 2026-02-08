# Migration Notes: Config v3 to v4 (Work in Progress)

This repository now includes a first draft of the v4 configuration model.

- v3 source file: `config.json`
- v4 schema: `config/schema.v4.json`
- v4 example: `config/config.v4.example.json`
- migration helper script: `scripts/migrate-config-v3-to-v4.js`

## Generate a v4 config from existing v3 config

```bash
npm run migrate:config:v4
```

Or with explicit paths:

```bash
node scripts/migrate-config-v3-to-v4.js ./config.json ./config.v4.json
```

## Notes

- The backend now includes a config loader bridge that can parse `schema_version: 4` and map it to the current runtime shape.
- You can point runtime to a custom config path with `OPENDATACAM_CONFIG_PATH=/path/to/config.v4.json`.
- `inference.sidecar.runtime` can now define sidecar session defaults (model files, threshold, video source, loop, MJPEG quality).
- On `/api/v2/runtime/session/start`, OpenDataCam sends these runtime defaults to the sidecar, and request payload values in `sidecar_runtime` override config defaults.

## Sidecar runtime block example

```json
{
  "inference": {
    "sidecar": {
      "base_url": "http://inference-sidecar:9080",
      "runtime": {
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
  }
}
```
