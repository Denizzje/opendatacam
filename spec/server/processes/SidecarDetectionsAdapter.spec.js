const {
  extractVideoResolution,
  normalizeSidecarDetection,
  normalizeSidecarFrame,
} = require('../../../server/processes/SidecarDetectionsAdapter');

describe('SidecarDetectionsAdapter', () => {
  it('extracts video resolution from different keys', () => {
    expect(extractVideoResolution({
      video_resolution: { width: 1920, height: 1080 },
    })).toEqual({
      w: 1920,
      h: 1080,
    });

    expect(extractVideoResolution({
      meta: {
        resolution: { w: 1280, h: 720 },
      },
    })).toEqual({
      w: 1280,
      h: 720,
    });
  });

  it('normalizes darknet style detections', () => {
    const normalized = normalizeSidecarDetection({
      name: 'car',
      confidence: 0.97,
      relative_coordinates: {
        center_x: 0.5,
        center_y: 0.25,
        width: 0.2,
        height: 0.4,
      },
    });

    expect(normalized).toEqual({
      name: 'car',
      confidence: 0.97,
      relative_coordinates: {
        center_x: 0.5,
        center_y: 0.25,
        width: 0.2,
        height: 0.4,
      },
    });
  });

  it('normalizes bbox detections when resolution is present', () => {
    const normalized = normalizeSidecarDetection({
      class: 'truck',
      score: 0.8,
      bbox: {
        x: 320,
        y: 120,
        w: 160,
        h: 80,
      },
    }, {
      w: 1280,
      h: 720,
    });

    expect(normalized.name).toBe('truck');
    expect(normalized.confidence).toBe(0.8);
    expect(normalized.relative_coordinates.center_x).toBeCloseTo(0.3125, 6);
    expect(normalized.relative_coordinates.center_y).toBeCloseTo(0.222222, 4);
    expect(normalized.relative_coordinates.width).toBeCloseTo(0.125, 6);
    expect(normalized.relative_coordinates.height).toBeCloseTo(0.111111, 4);
  });

  it('normalizes frame payload with fallback frame id', () => {
    const normalized = normalizeSidecarFrame({
      objects: [],
    }, 41);

    expect(normalized.frameId).toBe(41);
    expect(normalized.videoResolution).toBeNull();
    expect(normalized.objects).toEqual([]);
  });

  it('filters objects that cannot be normalized', () => {
    const normalized = normalizeSidecarFrame({
      frame_id: 1,
      video_resolution: {
        w: 640,
        h: 480,
      },
      objects: [
        {
          name: 'person',
          confidence: 0.9,
          relative_coordinates: {
            center_x: 0.2,
            center_y: 0.3,
            width: 0.1,
            height: 0.2,
          },
        },
        {
          name: 'invalid',
        },
      ],
    });

    expect(normalized.frameId).toBe(1);
    expect(normalized.objects.length).toBe(1);
    expect(normalized.objects[0].name).toBe('person');
  });
});
