const COUNTING_AREA_TYPE = {
  BIDIRECTIONAL: 'bidirectional',
  LEFTRIGHT_TOPBOTTOM: 'leftright_topbottom',
  RIGHTLEFT_BOTTOMTOP: 'rightleft_bottomtop',
  ZONE: 'polygon',
};

const LINE_TYPES = new Set([
  COUNTING_AREA_TYPE.BIDIRECTIONAL,
  COUNTING_AREA_TYPE.LEFTRIGHT_TOPBOTTOM,
  COUNTING_AREA_TYPE.RIGHTLEFT_BOTTOMTOP,
]);

const ALLOWED_TYPES = new Set([
  ...LINE_TYPES,
  COUNTING_AREA_TYPE.ZONE,
]);

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidResolution(value) {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return isFiniteNumber(value.w)
    && isFiniteNumber(value.h)
    && value.w > 0
    && value.h > 0;
}

function isValidPoint(value) {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return isFiniteNumber(value.x) && isFiniteNumber(value.y);
}

function getAreaType(area) {
  if (area && typeof area.type === 'string') {
    return area.type;
  }

  return COUNTING_AREA_TYPE.BIDIRECTIONAL;
}

function pointsAreClosed(points) {
  if (!Array.isArray(points) || points.length < 2) {
    return false;
  }

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  return firstPoint.x === lastPoint.x && firstPoint.y === lastPoint.y;
}

function validateArea(area, areaKey) {
  const details = [];

  if (area == null) {
    return details;
  }

  if (!area || typeof area !== 'object' || Array.isArray(area)) {
    details.push({
      areaKey,
      code: 'INVALID_AREA_OBJECT',
      path: `${areaKey}`,
      message: 'Counting area must be an object or null.',
    });
    return details;
  }

  const areaType = getAreaType(area);
  if (!ALLOWED_TYPES.has(areaType)) {
    details.push({
      areaKey,
      code: 'INVALID_AREA_TYPE',
      path: `${areaKey}.type`,
      message: `Unsupported counting area type "${areaType}".`,
    });
    return details;
  }

  if (!area.location || typeof area.location !== 'object') {
    details.push({
      areaKey,
      code: 'MISSING_LOCATION',
      path: `${areaKey}.location`,
      message: 'Counting area must include a location object.',
    });
    return details;
  }

  const { points, refResolution } = area.location;
  if (!Array.isArray(points)) {
    details.push({
      areaKey,
      code: 'INVALID_LOCATION_POINTS',
      path: `${areaKey}.location.points`,
      message: 'location.points must be an array.',
    });
    return details;
  }

  if (!isValidResolution(refResolution)) {
    details.push({
      areaKey,
      code: 'INVALID_REFERENCE_RESOLUTION',
      path: `${areaKey}.location.refResolution`,
      message: 'location.refResolution must contain positive numeric w and h.',
    });
  }

  points.forEach((point, index) => {
    if (!isValidPoint(point)) {
      details.push({
        areaKey,
        code: 'INVALID_POINT',
        path: `${areaKey}.location.points[${index}]`,
        message: 'Each point must contain finite numeric x and y.',
      });
    }
  });

  if (LINE_TYPES.has(areaType) && points.length !== 2) {
    details.push({
      areaKey,
      code: 'INVALID_LINE_POINTS_LENGTH',
      path: `${areaKey}.location.points`,
      message: 'Line counting areas must contain exactly 2 points.',
    });
  }

  if (areaType === COUNTING_AREA_TYPE.ZONE) {
    if (points.length < 4) {
      details.push({
        areaKey,
        code: 'INVALID_POLYGON_POINTS_LENGTH',
        path: `${areaKey}.location.points`,
        message: 'Polygon counting areas must contain at least 4 points (including closure point).',
      });
    } else if (!pointsAreClosed(points)) {
      details.push({
        areaKey,
        code: 'POLYGON_NOT_CLOSED',
        path: `${areaKey}.location.points`,
        message: 'Polygon counting areas must be closed (first and last point must match).',
      });
    }
  }

  return details;
}

function validateCountingAreasPayload(countingAreas) {
  if (!countingAreas || typeof countingAreas !== 'object' || Array.isArray(countingAreas)) {
    return {
      isValid: false,
      details: [{
        code: 'INVALID_PAYLOAD',
        path: 'countingAreas',
        message: 'countingAreas payload must be an object.',
      }],
    };
  }

  const details = [];
  Object.keys(countingAreas).forEach((areaKey) => {
    validateArea(countingAreas[areaKey], areaKey).forEach((detail) => details.push(detail));
  });

  return {
    isValid: details.length === 0,
    details,
  };
}

module.exports = {
  COUNTING_AREA_TYPE,
  validateCountingAreasPayload,
};
