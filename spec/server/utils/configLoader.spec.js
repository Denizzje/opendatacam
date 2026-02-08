const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  toLegacyConfig,
  parseConfig,
} = require('../../../server/utils/configLoader');

describe('configLoader', () => {
  it('maps v4 config to legacy format', () => {
    const v4 = {
      schema_version: 4,
      app: {
        opendatacam_version: '4.0.0',
        valid_classes: ['person'],
        display_classes: [{ class: 'person', hexcode: '1F6B6' }],
      },
      inference: {
        backend: 'darkhelp',
        darknet_repo: 'https://codeberg.org/CCodeRun/darknet',
        darknet_ref: 'master',
        darknet_commit: 'abc123',
        darkhelp_commit: 'def456',
      },
      video: {
        input: 'file',
        upload_folder: '/var/local/darknet/opendatacam_videos_uploaded',
        inputs: {
          file: 'demo.mp4',
        },
      },
      tracking: {
        settings: {
          iouLimit: 0.05,
        },
      },
      counting: {
        settings: {
          minAngleWithCountingLineThreshold: 5,
        },
      },
      storage: {
        database: 'mongo',
        database_params: {
          mongo: {
            url: 'mongodb://mongo:27017',
          },
        },
      },
      ports: {
        app: 8080,
        inference_json_stream: 8070,
        inference_mjpeg_stream: 8090,
      },
    };

    const v3 = toLegacyConfig(v4);

    expect(v3.OPENDATACAM_VERSION).toBe('4.0.0');
    expect(v3.VIDEO_INPUT).toBe('file');
    expect(v3.PORTS.darknet_json_stream).toBe(8070);
    expect(v3.PORTS.darknet_mjpeg_stream).toBe(8090);
    expect(v3.DATABASE).toBe('mongo');
    expect(v3.inference.darknet_commit).toBe('abc123');
  });

  it('keeps v3 config unmodified when parsed from file', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'odc-v3-'));
    const configPath = path.join(tempDir, 'config.json');

    const v3 = {
      OPENDATACAM_VERSION: '3.0.2',
      PORTS: {
        app: 8080,
      },
    };

    fs.writeFileSync(configPath, JSON.stringify(v3), 'utf-8');
    const parsed = parseConfig(configPath);

    expect(parsed).toEqual(v3);
  });

  it('converts v4 config when parsed from file', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'odc-v4-'));
    const configPath = path.join(tempDir, 'config.v4.json');

    const v4 = {
      schema_version: 4,
      app: {
        opendatacam_version: '4.0.0',
        valid_classes: [],
        display_classes: [],
      },
      inference: {
        backend: 'darkhelp',
        darknet_repo: 'https://codeberg.org/CCodeRun/darknet',
        darknet_ref: 'master',
        darknet_commit: '',
        darkhelp_commit: '',
      },
      video: {
        input: 'file',
        upload_folder: '/var/local/darknet/opendatacam_videos_uploaded',
        inputs: {},
      },
      tracking: { settings: {} },
      counting: { settings: {} },
      storage: {
        database: 'mongo',
        database_params: {
          mongo: {
            url: 'mongodb://mongo:27017',
          },
        },
      },
      ports: {
        app: 8080,
        inference_json_stream: 8070,
        inference_mjpeg_stream: 8090,
      },
    };

    fs.writeFileSync(configPath, JSON.stringify(v4), 'utf-8');
    const parsed = parseConfig(configPath);

    expect(parsed.OPENDATACAM_VERSION).toBe('4.0.0');
    expect(parsed.PORTS.darknet_json_stream).toBe(8070);
    expect(parsed.PORTS.darknet_mjpeg_stream).toBe(8090);
  });
});
