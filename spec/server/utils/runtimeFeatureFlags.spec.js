const {
  parseBooleanEnv,
  getRuntimeFeatureFlags,
} = require('../../../server/utils/runtimeFeatureFlags');

describe('runtimeFeatureFlags', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    Object.keys(process.env).forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(originalEnv, key)) {
        delete process.env[key];
      }
    });

    Object.keys(originalEnv).forEach((key) => {
      process.env[key] = originalEnv[key];
    });
  });

  it('parses boolean env values with common variants', () => {
    process.env.TEST_BOOLEAN = 'yes';
    expect(parseBooleanEnv('TEST_BOOLEAN', false)).toBe(true);

    process.env.TEST_BOOLEAN = '0';
    expect(parseBooleanEnv('TEST_BOOLEAN', true)).toBe(false);
  });

  it('uses defaults for missing or invalid values', () => {
    delete process.env.TEST_BOOLEAN;
    expect(parseBooleanEnv('TEST_BOOLEAN', true)).toBe(true);

    process.env.TEST_BOOLEAN = 'maybe';
    expect(parseBooleanEnv('TEST_BOOLEAN', false)).toBe(false);
  });

  it('defaults runtime to sidecar-first behavior', () => {
    delete process.env.OPENDATACAM_V2_USE_SIDECAR_DETECTIONS;
    delete process.env.OPENDATACAM_V2_MJPEG_FALLBACK_LEGACY;
    delete process.env.OPENDATACAM_V2_AUTO_START_ON_ROOT;

    const flags = getRuntimeFeatureFlags();
    expect(flags.useSidecarDetectionsForV2).toBeTrue();
    expect(flags.useLegacyMjpegForV2).toBeFalse();
    expect(flags.autoStartV2RuntimeOnRoot).toBeTrue();
  });
});
