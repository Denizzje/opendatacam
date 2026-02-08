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

function resolveModelPath(basePath, candidatePath) {
  if (!candidatePath || typeof candidatePath !== 'string') {
    return '';
  }

  if (path.isAbsolute(candidatePath)) {
    return candidatePath;
  }

  return path.join(basePath, candidatePath);
}

function inferVideoSource(v3) {
  const inputType = v3.VIDEO_INPUT;
  const inputs = v3.VIDEO_INPUTS_PARAMS || {};
  const configuredSource = inputs[inputType];

  if (typeof configuredSource !== 'string' || configuredSource.length === 0) {
    return '';
  }

  // Legacy simulation input uses CLI args for the old process and is not a sidecar video source.
  if (inputType === 'simulation') {
    return '';
  }

  return configuredSource;
}

function inferSidecarRuntime(v3) {
  const runtime = {
    darkhelp_enabled: true,
    darkhelp_threshold: 0.25,
    video_loop: true,
    mjpeg_quality: 80,
  };

  const darknetPath = v3.PATH_TO_YOLO_DARKNET || '/var/local/darknet';
  const networkName = v3.NEURAL_NETWORK;
  const networkParams = (
    v3.NEURAL_NETWORK_PARAMS
    && networkName
    && v3.NEURAL_NETWORK_PARAMS[networkName]
  ) || {};

  const cfgPath = resolveModelPath(darknetPath, networkParams.cfg);
  if (cfgPath) {
    runtime.darkhelp_cfg = cfgPath;
  }

  const weightsPath = resolveModelPath(darknetPath, networkParams.weights);
  if (weightsPath) {
    runtime.darkhelp_weights = weightsPath;
  }

  const namesPath = resolveModelPath(darknetPath, networkParams.names || 'cfg/coco.names');
  if (namesPath) {
    runtime.darkhelp_names = namesPath;
  }

  const videoSource = inferVideoSource(v3);
  if (videoSource) {
    runtime.video_source = videoSource;
  }

  return runtime;
}

function toV4(v3) {
  const ports = v3.PORTS || {};
  const sidecarRuntime = inferSidecarRuntime(v3);

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
        base_url: process.env.INFERENCE_SIDECAR_URL || 'http://localhost:9080',
        runtime: sidecarRuntime,
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
