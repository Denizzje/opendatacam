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

- This is the first migration scaffold and is intentionally not wired into runtime yet.
- The runtime is still loading `config.json` until the backend config loader is replaced in a follow-up change.
