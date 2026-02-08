# Migration Guide: Config v3 to v4 (Sidecar-First)

This guide describes a complete migration from legacy `config.json` (v3 shape) to v4 config with sidecar-first runtime.

## 1) Files and tools

- v3 source file: `config.json`
- v4 schema: `config/schema.v4.json`
- v4 example: `config/config.v4.example.json`
- migration helper script: `scripts/migrate-config-v3-to-v4.js`

## 2) Generate initial v4 config

From repo root:

```bash
npm run migrate:config:v4
```

Or with explicit input/output paths:

```bash
node scripts/migrate-config-v3-to-v4.js ./config.json ./config.v4.json
```

## 3) Point runtime at v4 config

Set the environment variable before starting OpenDataCam:

```bash
export OPENDATACAM_CONFIG_PATH=/absolute/path/to/config.v4.json
```

The server-side config bridge maps v4 to current runtime internals.

## 4) Required migration checklist

- `schema_version` is `4`
- `app.version` matches `package.json` version
- `storage.database` is set (`mongo` or `none`)
- `ports` block contains:
  - `app`
  - `inference_json_stream`
  - `inference_mjpeg_stream`
- `app.valid_classes` includes the labels expected by your model
- `ui.counter_colors` and `ui.pathfinder_colors` are defined (defaults are auto-filled if missing)

## 5) Sidecar-first runtime checklist

- Set `OPENDATACAM_V2_USE_SIDECAR_DETECTIONS=true` (default)
- Sidecar base URL is correct:
  - `INFERENCE_SIDECAR_URL` environment variable, or
  - `inference.sidecar.base_url` in v4 config
- Optional default start payload is configured under:
  - `inference.sidecar.runtime`

Example:

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

## 6) Runtime behavior changes in v4 mode

- `/api/v2/runtime/*` is sidecar-first by default.
- `/` auto-starts sidecar runtime by default.
  - disable with `OPENDATACAM_V2_AUTO_START_ON_ROOT=false`
- `/api/v2/stream/mjpeg` defaults to sidecar MJPEG.
  - force legacy MJPEG with `OPENDATACAM_V2_MJPEG_FALLBACK_LEGACY=true`
- Counting payload validation is strict on `/api/v2/counting/areas`:
  - line types require exactly 2 points
  - polygon requires at least 4 points and must be closed
  - invalid payloads return `{ error, code, details }` with HTTP `400`
- Stale-frame suppression is enabled for overlay stability:
  - configure with `OPENDATACAM_V2_MAX_FRAME_DRIFT` (default `2`)

## 7) Validation commands

- Run test suite:

```bash
npm test
```

- Run sidecar smoke test against a running stack:

```bash
npm run smoke:sidecar
```

- Optional API demo with LegoGears assets:

```bash
npm run demo:legogears:api
```

## 8) Troubleshooting

### Counting editor: first line/polygon click does not save

- Ensure you are using latest modernization branch with deterministic area ID handling.
- Verify `GET /api/v2/config` returns non-empty `COUNTER_COLORS` and `PATHFINDER_COLORS`.

### Counting areas import fails

- Imported JSON must include:
  - `location.points` as numeric points
  - `location.refResolution` with positive numeric `w/h`
  - valid line/polygon point counts

### Sidecar stream/detection overlay drift

- Keep sidecar stream intervals aligned (`DETECTIONS_STREAM_INTERVAL_MS` and `MJPEG_STREAM_INTERVAL_MS`).
- Tune `OPENDATACAM_V2_MAX_FRAME_DRIFT` to relax/tighten stale frame drop.
- Check `/api/v2/runtime/status` and `/api/v2/runtime/health` for sidecar session/readiness.

### OpenSSL legacy provider warning

- `NODE_OPTIONS=--openssl-legacy-provider` is a transitional compatibility workaround for legacy Next.js tooling on newer Node versions.
- Current CI/dev baseline remains Node `18.x` and `20.x`.
