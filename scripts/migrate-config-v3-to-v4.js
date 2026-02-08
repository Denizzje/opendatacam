#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const defaultInput = path.resolve(process.cwd(), 'config.json');
const defaultOutput = path.resolve(process.cwd(), 'config.v4.json');

const input = process.argv[2] ? path.resolve(process.argv[2]) : defaultInput;
const output = process.argv[3] ? path.resolve(process.argv[3]) : defaultOutput;

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function toV4(v3) {
  const ports = v3.PORTS || {};

  return {
    schema_version: 4,
    app: {
      opendatacam_version: v3.OPENDATACAM_VERSION,
      valid_classes: v3.VALID_CLASSES || [],
      display_classes: v3.DISPLAY_CLASSES || []
    },
    inference: {
      backend: 'darkhelp',
      darknet_repo: 'https://codeberg.org/CCodeRun/darknet',
      darknet_ref: 'master',
      darknet_commit: '',
      darkhelp_commit: '',
      sidecar: {
        base_url: process.env.INFERENCE_SIDECAR_URL || 'http://localhost:9080'
      }
    },
    video: {
      input: v3.VIDEO_INPUT,
      upload_folder: v3.VIDEO_UPLOAD_FOLDER,
      inputs: v3.VIDEO_INPUTS_PARAMS || {}
    },
    tracking: {
      settings: v3.TRACKER_SETTINGS || {}
    },
    counting: {
      settings: v3.COUNTER_SETTINGS || {}
    },
    storage: {
      database: v3.DATABASE,
      database_params: v3.DATABASE_PARAMS || {}
    },
    ports: {
      app: ports.app || 8080,
      inference_json_stream: ports.darknet_json_stream || 8070,
      inference_mjpeg_stream: ports.darknet_mjpeg_stream || 8090
    },
    ui: {
      tracker_accuracy_display: v3.TRACKER_ACCURACY_DISPLAY || {},
      counter_colors: v3.COUNTER_COLORS || {},
      pathfinder_colors: v3.PATHFINDER_COLORS || []
    }
  };
}

function main() {
  if (!fs.existsSync(input)) {
    console.error(`Input file not found: ${input}`);
    process.exit(1);
  }

  const v3 = readJSON(input);
  const v4 = toV4(v3);

  fs.writeFileSync(output, `${JSON.stringify(v4, null, 2)}\n`, 'utf-8');
  console.log(`Wrote v4 config to ${output}`);
}

main();
