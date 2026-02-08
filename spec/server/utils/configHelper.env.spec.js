describe('configHelper env overrides', () => {
  const modulePath = require.resolve('../../../server/utils/configHelper');
  const originalJsonPort = process.env.PORT_DARKNET_JSON_STREAM;
  const originalMjpegPort = process.env.PORT_DARKNET_MJPEG_STREAM;

  afterEach(() => {
    if (originalJsonPort === undefined) {
      delete process.env.PORT_DARKNET_JSON_STREAM;
    } else {
      process.env.PORT_DARKNET_JSON_STREAM = originalJsonPort;
    }

    if (originalMjpegPort === undefined) {
      delete process.env.PORT_DARKNET_MJPEG_STREAM;
    } else {
      process.env.PORT_DARKNET_MJPEG_STREAM = originalMjpegPort;
    }

    delete require.cache[modulePath];
    require(modulePath); // reload with restored env
  });

  it('uses PORT_DARKNET_MJPEG_STREAM even when json stream env is invalid', () => {
    process.env.PORT_DARKNET_JSON_STREAM = 'invalid';
    process.env.PORT_DARKNET_MJPEG_STREAM = '19090';

    delete require.cache[modulePath];
    const configHelper = require(modulePath);

    expect(configHelper.getMjpegStreamPort()).toBe(19090);
  });
});
