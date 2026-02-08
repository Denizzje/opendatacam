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
