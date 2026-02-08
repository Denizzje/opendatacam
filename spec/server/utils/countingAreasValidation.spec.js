const {
  validateCountingAreasPayload,
} = require('../../../server/utils/countingAreasValidation');

describe('countingAreasValidation', () => {
  it('accepts valid line and polygon counting areas', () => {
    const result = validateCountingAreasPayload({
      lineArea: {
        type: 'bidirectional',
        location: {
          points: [
            { x: 10, y: 20 },
            { x: 30, y: 40 },
          ],
          refResolution: { w: 1280, h: 720 },
        },
      },
      polygonArea: {
        type: 'polygon',
        location: {
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 0 },
          ],
          refResolution: { w: 1280, h: 720 },
        },
      },
    });

    expect(result.isValid).toBeTrue();
    expect(result.details).toEqual([]);
  });

  it('rejects malformed payloads', () => {
    const result = validateCountingAreasPayload(null);
    expect(result.isValid).toBeFalse();
    expect(result.details[0].code).toBe('INVALID_PAYLOAD');
  });

  it('rejects invalid line definitions', () => {
    const result = validateCountingAreasPayload({
      invalidLine: {
        type: 'bidirectional',
        location: {
          points: [{ x: 10, y: 20 }],
          refResolution: { w: 1280, h: 720 },
        },
      },
    });

    expect(result.isValid).toBeFalse();
    expect(result.details.some((detail) => detail.code === 'INVALID_LINE_POINTS_LENGTH')).toBeTrue();
  });

  it('rejects polygon that is not closed', () => {
    const result = validateCountingAreasPayload({
      invalidPolygon: {
        type: 'polygon',
        location: {
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 5, y: 5 },
          ],
          refResolution: { w: 1280, h: 720 },
        },
      },
    });

    expect(result.isValid).toBeFalse();
    expect(result.details.some((detail) => detail.code === 'POLYGON_NOT_CLOSED')).toBeTrue();
  });
});
