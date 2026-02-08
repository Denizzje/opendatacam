const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

const isNonEmptyString = (value) => typeof value === 'string' && value.length > 0;

const getDerivedVideoSourceFromConfig = (config = {}) => {
  const videoInput = config.VIDEO_INPUT;
  const videoInputsParams = config.VIDEO_INPUTS_PARAMS || {};
  const configuredSource = videoInputsParams[videoInput];

  if (!isNonEmptyString(configuredSource)) {
    return null;
  }

  // Legacy simulation is CLI-arg based and cannot be opened as a single OpenCV source.
  if (videoInput === 'simulation') {
    return null;
  }

  return configuredSource;
};

const normalizeRuntimeConfig = (runtimeConfig = {}) => {
  const normalized = {};
  const keys = [
    'darkhelp_enabled',
    'darkhelp_cfg',
    'darkhelp_weights',
    'darkhelp_names',
    'darkhelp_threshold',
    'video_source',
    'video_loop',
    'mjpeg_quality',
  ];

  keys.forEach((key) => {
    const hasValue = runtimeConfig[key] !== undefined && runtimeConfig[key] !== null;
    if (hasOwn(runtimeConfig, key) && hasValue) {
      normalized[key] = runtimeConfig[key];
    }
  });

  return normalized;
};

const buildSidecarRuntimeDefaults = (config = {}) => {
  const sidecarConfig = isObject(config.inference) && isObject(config.inference.sidecar)
    ? config.inference.sidecar
    : {};
  const configuredRuntime = isObject(sidecarConfig.runtime)
    ? sidecarConfig.runtime
    : {};

  const runtimeDefaults = normalizeRuntimeConfig(configuredRuntime);
  if (!hasOwn(runtimeDefaults, 'video_source')) {
    const derivedVideoSource = getDerivedVideoSourceFromConfig(config);
    if (derivedVideoSource !== null) {
      runtimeDefaults.video_source = derivedVideoSource;
    }
  }

  return runtimeDefaults;
};

const buildSidecarSessionPayload = (config = {}, requestPayload = {}) => {
  const payload = isObject(requestPayload)
    ? { ...requestPayload }
    : {};

  const requestRuntime = isObject(payload.sidecar_runtime)
    ? normalizeRuntimeConfig(payload.sidecar_runtime)
    : {};
  const runtimeDefaults = buildSidecarRuntimeDefaults(config);
  const sidecarRuntime = {
    ...runtimeDefaults,
    ...requestRuntime,
  };

  if (Object.keys(sidecarRuntime).length > 0) {
    payload.sidecar_runtime = sidecarRuntime;
  }

  return payload;
};

module.exports = {
  buildSidecarRuntimeDefaults,
  buildSidecarSessionPayload,
  getDerivedVideoSourceFromConfig,
  normalizeRuntimeConfig,
};
