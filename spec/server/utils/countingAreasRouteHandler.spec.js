const {
  buildRegisterCountingAreasHandler,
} = require('../../../server/utils/countingAreasRouteHandler');

function createMockResponse() {
  return {
    statusCode: null,
    payload: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
    sendStatus(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
  };
}

describe('countingAreasRouteHandler', () => {
  it('returns 400 with standardized payload for invalid request body', () => {
    const opendatacamSpy = jasmine.createSpyObj('Opendatacam', ['registerCountingAreas']);
    const handler = buildRegisterCountingAreasHandler({ opendatacam: opendatacamSpy });
    const res = createMockResponse();

    handler({ body: { countingAreas: [] } }, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload.code).toBe('INVALID_COUNTING_AREAS_PAYLOAD');
    expect(opendatacamSpy.registerCountingAreas).not.toHaveBeenCalled();
  });

  it('registers counting areas and returns 200 for valid payload', () => {
    const opendatacamSpy = jasmine.createSpyObj('Opendatacam', ['registerCountingAreas']);
    const handler = buildRegisterCountingAreasHandler({ opendatacam: opendatacamSpy });
    const res = createMockResponse();
    const payload = {
      line: {
        type: 'bidirectional',
        location: {
          points: [
            { x: 10, y: 10 },
            { x: 20, y: 10 },
          ],
          refResolution: { w: 1280, h: 720 },
        },
      },
    };

    handler({ body: { countingAreas: payload } }, res);

    expect(res.statusCode).toBe(200);
    expect(opendatacamSpy.registerCountingAreas).toHaveBeenCalledWith(payload);
  });

  it('returns 500 when register throws unexpectedly', () => {
    const opendatacamSpy = jasmine.createSpyObj('Opendatacam', ['registerCountingAreas']);
    opendatacamSpy.registerCountingAreas.and.throwError('boom');
    const loggerSpy = jasmine.createSpyObj('logger', ['error']);
    const handler = buildRegisterCountingAreasHandler({
      opendatacam: opendatacamSpy,
      logger: loggerSpy,
    });
    const res = createMockResponse();

    handler({
      body: {
        countingAreas: {
          line: {
            type: 'bidirectional',
            location: {
              points: [
                { x: 1, y: 1 },
                { x: 2, y: 2 },
              ],
              refResolution: { w: 100, h: 100 },
            },
          },
        },
      },
    }, res);

    expect(res.statusCode).toBe(500);
    expect(res.payload.code).toBe('COUNTING_AREAS_SAVE_FAILED');
    expect(loggerSpy.error).toHaveBeenCalled();
  });
});
