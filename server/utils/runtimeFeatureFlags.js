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

const getRuntimeFeatureFlags = () => ({
  useSidecarDetectionsForV2: parseBooleanEnv('OPENDATACAM_V2_USE_SIDECAR_DETECTIONS', true),
  useLegacyMjpegForV2: parseBooleanEnv('OPENDATACAM_V2_MJPEG_FALLBACK_LEGACY', false),
  autoStartV2RuntimeOnRoot: parseBooleanEnv('OPENDATACAM_V2_AUTO_START_ON_ROOT', true),
});

module.exports = {
  parseBooleanEnv,
  getRuntimeFeatureFlags,
};
