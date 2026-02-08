const { InferenceSidecarClient } = require('../../../server/processes/InferenceSidecarClient');

describe('InferenceSidecarClient', () => {
  let fakeHttp;
  let client;

  beforeEach(() => {
    fakeHttp = {
      get: jasmine.createSpy('get').and.returnValue(Promise.resolve({ data: { ok: true } })),
      post: jasmine.createSpy('post').and.returnValue(Promise.resolve({ data: { ok: true } })),
    };

    client = new InferenceSidecarClient({
      baseURL: 'http://sidecar:9080',
      http: fakeHttp,
    });
  });

  it('keeps configured base url', () => {
    expect(client.baseURL).toBe('http://sidecar:9080');
  });

  it('calls health endpoint', async () => {
    await client.getHealth();
    expect(fakeHttp.get).toHaveBeenCalledWith('/healthz');
  });

  it('calls readiness endpoint', async () => {
    await client.getReadiness();
    expect(fakeHttp.get).toHaveBeenCalledWith('/readyz');
  });

  it('starts session with payload', async () => {
    const payload = { source: 'test' };
    await client.startSession(payload);
    expect(fakeHttp.post).toHaveBeenCalledWith('/api/v1/runtime/session/start', payload);
  });

  it('starts session with empty payload by default', async () => {
    await client.startSession();
    expect(fakeHttp.post).toHaveBeenCalledWith('/api/v1/runtime/session/start', {});
  });

  it('stops session', async () => {
    await client.stopSession();
    expect(fakeHttp.post).toHaveBeenCalledWith('/api/v1/runtime/session/stop');
  });

  it('gets session status', async () => {
    await client.getSessionStatus();
    expect(fakeHttp.get).toHaveBeenCalledWith('/api/v1/runtime/session/status');
  });

  it('gets detections stream', async () => {
    await client.getDetectionsStream();
    expect(fakeHttp.get).toHaveBeenCalledWith('/api/v1/stream/detections', {
      responseType: 'stream',
    });
  });
});
