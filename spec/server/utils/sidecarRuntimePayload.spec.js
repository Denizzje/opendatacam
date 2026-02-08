const {
  buildSidecarRuntimeDefaults,
  buildSidecarSessionPayload,
  getDerivedVideoSourceFromConfig,
} = require('../../../server/utils/sidecarRuntimePayload');

describe('sidecarRuntimePayload', () => {
  it('derives video source from legacy video config when needed', () => {
    const videoSource = getDerivedVideoSourceFromConfig({
      VIDEO_INPUT: 'file',
      VIDEO_INPUTS_PARAMS: {
        file: '/videos/traffic.mp4',
      },
    });

    expect(videoSource).toBe('/videos/traffic.mp4');
  });

  it('does not derive simulation source from legacy video config', () => {
    const videoSource = getDerivedVideoSourceFromConfig({
      VIDEO_INPUT: 'simulation',
      VIDEO_INPUTS_PARAMS: {
        simulation: '--yolo_json example.json --video_file_or_folder frames',
      },
    });

    expect(videoSource).toBeNull();
  });

  it('builds runtime defaults from inference.sidecar.runtime', () => {
    const defaults = buildSidecarRuntimeDefaults({
      inference: {
        sidecar: {
          runtime: {
            darkhelp_enabled: true,
            darkhelp_cfg: '/models/yolov4-tiny.cfg',
            darkhelp_weights: '/models/yolov4-tiny.weights',
            darkhelp_names: '/models/coco.names',
            darkhelp_threshold: 0.2,
            video_source: '/videos/demo.mp4',
            video_loop: false,
            mjpeg_quality: 70,
          },
        },
      },
    });

    expect(defaults).toEqual({
      darkhelp_enabled: true,
      darkhelp_cfg: '/models/yolov4-tiny.cfg',
      darkhelp_weights: '/models/yolov4-tiny.weights',
      darkhelp_names: '/models/coco.names',
      darkhelp_threshold: 0.2,
      video_source: '/videos/demo.mp4',
      video_loop: false,
      mjpeg_quality: 70,
    });
  });

  it('builds sidecar session payload using config defaults', () => {
    const payload = buildSidecarSessionPayload({
      VIDEO_INPUT: 'file',
      VIDEO_INPUTS_PARAMS: {
        file: '/videos/legacy.mp4',
      },
      inference: {
        sidecar: {
          runtime: {
            darkhelp_enabled: true,
            darkhelp_cfg: '/models/cfg.cfg',
            darkhelp_weights: '/models/model.weights',
          },
        },
      },
    }, {});

    expect(payload.sidecar_runtime.darkhelp_enabled).toBe(true);
    expect(payload.sidecar_runtime.darkhelp_cfg).toBe('/models/cfg.cfg');
    expect(payload.sidecar_runtime.darkhelp_weights).toBe('/models/model.weights');
    expect(payload.sidecar_runtime.video_source).toBe('/videos/legacy.mp4');
  });

  it('lets request payload override config defaults', () => {
    const payload = buildSidecarSessionPayload({
      VIDEO_INPUT: 'file',
      VIDEO_INPUTS_PARAMS: {
        file: '/videos/legacy.mp4',
      },
      inference: {
        sidecar: {
          runtime: {
            darkhelp_threshold: 0.25,
            video_loop: true,
          },
        },
      },
    }, {
      sidecar_runtime: {
        darkhelp_threshold: 0.4,
        video_source: '/videos/override.mp4',
      },
    });

    expect(payload.sidecar_runtime.darkhelp_threshold).toBe(0.4);
    expect(payload.sidecar_runtime.video_loop).toBe(true);
    expect(payload.sidecar_runtime.video_source).toBe('/videos/override.mp4');
  });
});
