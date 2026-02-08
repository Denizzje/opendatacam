const normalizeBooleanString = (value) => String(value).trim().toLowerCase();

const parseBooleanEnv = (name, defaultValue) => {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return defaultValue;
  }

  const normalized = normalizeBooleanString(rawValue);
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return defaultValue;
};

const parsePositiveIntegerEnv = (name, defaultValue) => {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return defaultValue;
  }

  const parsed = Number.parseInt(String(rawValue).trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return defaultValue;
  }

  return parsed;
};

const getRuntimeFeatureFlags = () => ({
  useSidecarDetectionsForV2: parseBooleanEnv('OPENDATACAM_V2_USE_SIDECAR_DETECTIONS', true),
  useLegacyMjpegForV2: parseBooleanEnv('OPENDATACAM_V2_MJPEG_FALLBACK_LEGACY', false),
  autoStartV2RuntimeOnRoot: parseBooleanEnv('OPENDATACAM_V2_AUTO_START_ON_ROOT', true),
  maxTrackerFrameBackwardDrift: parsePositiveIntegerEnv('OPENDATACAM_V2_MAX_FRAME_DRIFT', 2),
});

module.exports = {
  parseBooleanEnv,
  parsePositiveIntegerEnv,
  getRuntimeFeatureFlags,
};
