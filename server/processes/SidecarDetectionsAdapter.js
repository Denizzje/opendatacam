const DEFAULT_CLASS_NAME = 'object';

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const firstNumber = (...values) => {
  for (let index = 0; index < values.length; index += 1) {
    const parsed = toNumber(values[index]);
    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
};

const clamp01 = (value) => Math.max(0, Math.min(1, value));

const extractVideoResolution = (payload = {}) => {
  const candidates = [
    payload.video_resolution,
    payload.videoResolution,
    payload.resolution,
    payload.frame_resolution,
    payload.frameResolution,
    payload.meta && payload.meta.video_resolution,
    payload.meta && payload.meta.videoResolution,
    payload.meta && payload.meta.resolution,
  ];

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    if (candidate && typeof candidate === 'object') {
      const width = firstNumber(candidate.w, candidate.width, candidate.cols);
      const height = firstNumber(candidate.h, candidate.height, candidate.rows);
      if (width > 0 && height > 0) {
        return { w: width, h: height };
      }
    }
  }

  return null;
};

const extractRelativeCoordinates = (detection, videoResolution = null) => {
  const relative = detection.relative_coordinates || detection.relativeCoordinates;
  if (relative && typeof relative === 'object') {
    const centerX = firstNumber(relative.center_x, relative.centerX);
    const centerY = firstNumber(relative.center_y, relative.centerY);
    const width = firstNumber(relative.width, relative.w);
    const height = firstNumber(relative.height, relative.h);
    if (centerX !== null && centerY !== null && width !== null && height !== null
      && width > 0 && height > 0) {
      return {
        center_x: clamp01(centerX),
        center_y: clamp01(centerY),
        width: clamp01(width),
        height: clamp01(height),
      };
    }
  }

  const bbox = detection.bbox || detection.box || detection.bounding_box;
  if (bbox && typeof bbox === 'object') {
    const x = firstNumber(bbox.x, bbox.left);
    const y = firstNumber(bbox.y, bbox.top);
    const width = firstNumber(bbox.w, bbox.width);
    const height = firstNumber(bbox.h, bbox.height);

    if (x !== null && y !== null && width > 0 && height > 0) {
      const appearsRelative = x <= 1 && y <= 1 && width <= 1 && height <= 1;
      if (appearsRelative) {
        return {
          center_x: clamp01(x + (width / 2)),
          center_y: clamp01(y + (height / 2)),
          width: clamp01(width),
          height: clamp01(height),
        };
      }

      if (videoResolution && videoResolution.w > 0 && videoResolution.h > 0) {
        return {
          center_x: clamp01((x + (width / 2)) / videoResolution.w),
          center_y: clamp01((y + (height / 2)) / videoResolution.h),
          width: clamp01(width / videoResolution.w),
          height: clamp01(height / videoResolution.h),
        };
      }
    }
  }

  const x = firstNumber(detection.x, detection.cx, detection.center_x, detection.centerX);
  const y = firstNumber(detection.y, detection.cy, detection.center_y, detection.centerY);
  const width = firstNumber(detection.w, detection.width);
  const height = firstNumber(detection.h, detection.height);

  if (x !== null && y !== null && width > 0 && height > 0) {
    const appearsRelative = x <= 1 && y <= 1 && width <= 1 && height <= 1;
    if (appearsRelative) {
      return {
        center_x: clamp01(x),
        center_y: clamp01(y),
        width: clamp01(width),
        height: clamp01(height),
      };
    }

    if (videoResolution && videoResolution.w > 0 && videoResolution.h > 0) {
      return {
        center_x: clamp01(x / videoResolution.w),
        center_y: clamp01(y / videoResolution.h),
        width: clamp01(width / videoResolution.w),
        height: clamp01(height / videoResolution.h),
      };
    }
  }

  return null;
};

const normalizeSidecarDetection = (detection, videoResolution = null) => {
  if (!detection || typeof detection !== 'object') {
    return null;
  }

  const relativeCoordinates = extractRelativeCoordinates(detection, videoResolution);
  if (!relativeCoordinates) {
    return null;
  }

  const confidence = firstNumber(detection.confidence, detection.probability, detection.score) || 0;

  const className = detection.name || detection.class || detection.label || DEFAULT_CLASS_NAME;

  return {
    name: String(className),
    confidence,
    relative_coordinates: relativeCoordinates,
  };
};

const normalizeSidecarFrame = (payload = {}, fallbackFrameId = 0) => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  // Prefer inference/replay frame IDs over transport frame IDs so FPS reflects actual inference cadence.
  const frameId = firstNumber(
    payload.inference_frame_id,
    payload.inferenceFrameId,
    payload.replay_frame_id,
    payload.replayFrameId,
    payload.frame_id,
    payload.frameId,
    payload.frame,
    fallbackFrameId,
  );
  const transportFrameId = firstNumber(payload.frame_id, payload.frameId, payload.frame);
  const timestampMs = firstNumber(
    payload.inference_timestamp_ms,
    payload.inferenceTimestampMs,
    payload.replay_timestamp_ms,
    payload.replayTimestampMs,
    payload.timestamp_ms,
    payload.timestampMs,
    payload.meta && payload.meta.timestamp_ms,
    payload.meta && payload.meta.timestampMs,
  );
  const videoResolution = extractVideoResolution(payload);
  const objects = Array.isArray(payload.objects)
    ? payload.objects
      .map((detection) => normalizeSidecarDetection(detection, videoResolution))
      .filter((normalized) => normalized !== null)
    : [];
  const source = typeof payload.source === 'string' ? payload.source : null;
  let videoSource = null;
  if (typeof payload.video_source === 'string') {
    videoSource = payload.video_source;
  } else if (typeof payload.videoSource === 'string') {
    videoSource = payload.videoSource;
  }

  return {
    frameId,
    transportFrameId,
    timestampMs,
    source,
    videoSource,
    videoResolution,
    objects,
  };
};

module.exports = {
  extractVideoResolution,
  normalizeSidecarDetection,
  normalizeSidecarFrame,
};
