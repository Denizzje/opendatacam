const fs = require('fs');
const path = require('path');

const DEFAULT_CONFIG_PATH = path.resolve(__dirname, '../../config.json');

const DEFAULT_NEURAL_NETWORK_PARAMS = {
  yolov4: {
    data: 'cfg/coco.data',
    cfg: 'cfg/yolov4-416x416.cfg',
    weights: 'yolov4.weights',
  },
  'yolov4-tiny': {
    data: 'cfg/coco.data',
    cfg: 'cfg/yolov4-tiny.cfg',
    weights: 'yolov4-tiny.weights',
  },
};

const DEFAULT_GPS = {
  enabled: false,
  port: 2947,
  hostname: 'localhost',
  signalLossTimeoutSeconds: 60,
  csvExportOpenStreetMapsUrl: true,
};

let cachedPath = null;
let cachedConfig = null;

function toLegacyConfig(v4Config) {
  const defaultDarknetPath = '/var/local/darknet';
  const uploadFolder = v4Config.video && v4Config.video.upload_folder
    ? v4Config.video.upload_folder
    : `${defaultDarknetPath}/opendatacam_videos_uploaded`;
  const inferredDarknetPath = path.dirname(uploadFolder) || defaultDarknetPath;
  const neuralNetwork = (v4Config.inference && v4Config.inference.neural_network)
    || 'yolov4-tiny';

  return {
    OPENDATACAM_VERSION: v4Config.app.opendatacam_version,
    PATH_TO_YOLO_DARKNET: inferredDarknetPath,
    CMD_TO_YOLO_DARKNET: `${inferredDarknetPath}/darknet`,
    VIDEO_UPLOAD_FOLDER: uploadFolder,
    VIDEO_INPUT: v4Config.video.input,
    NEURAL_NETWORK: neuralNetwork,
    VIDEO_INPUTS_PARAMS: v4Config.video.inputs || {},
    TRACKER_SETTINGS: v4Config.tracking.settings || {},
    COUNTER_SETTINGS: v4Config.counting.settings || {},
    VALID_CLASSES: v4Config.app.valid_classes || [],
    DISPLAY_CLASSES: v4Config.app.display_classes || [],
    PATHFINDER_COLORS: (v4Config.ui && v4Config.ui.pathfinder_colors) || [],
    COUNTER_COLORS: (v4Config.ui && v4Config.ui.counter_colors) || {},
    NEURAL_NETWORK_PARAMS: (v4Config.inference && v4Config.inference.neural_network_params)
      || DEFAULT_NEURAL_NETWORK_PARAMS,
    TRACKER_ACCURACY_DISPLAY: (v4Config.ui && v4Config.ui.tracker_accuracy_display) || {},
    DATABASE: v4Config.storage.database,
    DATABASE_PARAMS: v4Config.storage.database_params || {},
    PORTS: {
      app: v4Config.ports.app,
      darknet_json_stream: v4Config.ports.inference_json_stream,
      darknet_mjpeg_stream: v4Config.ports.inference_mjpeg_stream,
    },
    GPS: v4Config.gps || DEFAULT_GPS,
    inference: v4Config.inference || {},
  };
}

function parseConfig(configPath) {
  const content = fs.readFileSync(configPath, 'utf-8');
  const parsed = JSON.parse(content);

  if (parsed.schema_version === 4) {
    return toLegacyConfig(parsed);
  }

  return parsed;
}

function loadConfig(options = {}) {
  const usePath = options.path
    || process.env.OPENDATACAM_CONFIG_PATH
    || DEFAULT_CONFIG_PATH;
  const forceReload = options.forceReload === true;

  if (!forceReload && cachedConfig && cachedPath === usePath) {
    return cachedConfig;
  }

  cachedPath = usePath;
  cachedConfig = parseConfig(usePath);
  return cachedConfig;
}

module.exports = {
  DEFAULT_CONFIG_PATH,
  toLegacyConfig,
  parseConfig,
  loadConfig,
};
