const { SidecarDetectionsStream } = require('../../../server/processes/SidecarDetectionsStream');

describe('SidecarDetectionsStream', () => {
  beforeEach(() => {
    jasmine.clock().install();
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('parses event block with explicit event type', () => {
    const parsed = SidecarDetectionsStream.parseEventBlock(
      'event: detections\ndata: {"frame_id":1,"objects":[]}',
    );

    expect(parsed).toEqual({
      event: 'detections',
      data: {
        frame_id: 1,
        objects: [],
      },
    });
  });

  it('parses event block with default message type', () => {
    const parsed = SidecarDetectionsStream.parseEventBlock('data: {"ok":true}');

    expect(parsed).toEqual({
      event: 'message',
      data: {
        ok: true,
      },
    });
  });

  it('returns null on invalid json payload', () => {
    const parsed = SidecarDetectionsStream.parseEventBlock('data: {invalid');
    expect(parsed).toBeNull();
  });

  it('handles chunked messages across boundaries', () => {
    const onDetection = jasmine.createSpy('onDetection');
    const stream = new SidecarDetectionsStream({
      onDetection,
    });

    stream.handleChunk('event: detections\ndata: {"frame_id":2');
    stream.handleChunk(',"objects":[]}\n\n');

    expect(onDetection).toHaveBeenCalledTimes(1);
    expect(onDetection).toHaveBeenCalledWith({
      event: 'detections',
      data: {
        frame_id: 2,
        objects: [],
      },
    });
  });

  it('supports CRLF separators', () => {
    const onDetection = jasmine.createSpy('onDetection');
    const stream = new SidecarDetectionsStream({
      onDetection,
    });

    stream.handleChunk('event: detections\r\ndata: {"frame_id":3,"objects":[]}\r\n\r\n');

    expect(onDetection).toHaveBeenCalledTimes(1);
    expect(onDetection.calls.mostRecent().args[0].data.frame_id).toBe(3);
  });

  it('schedules reconnect when enabled', () => {
    const stream = new SidecarDetectionsStream({
      shouldReconnect: true,
      reconnectDelayMs: 50,
    });
    stream.manuallyStopped = false;
    spyOn(stream, 'connect');

    stream.scheduleReconnect();
    jasmine.clock().tick(49);
    expect(stream.connect).not.toHaveBeenCalled();

    jasmine.clock().tick(1);
    expect(stream.connect).toHaveBeenCalledTimes(1);
  });

  it('does not reconnect after stop', () => {
    const stream = new SidecarDetectionsStream({
      shouldReconnect: true,
      reconnectDelayMs: 50,
    });
    stream.manuallyStopped = false;
    spyOn(stream, 'connect');

    stream.scheduleReconnect();
    stream.stop();
    jasmine.clock().tick(100);

    expect(stream.connect).not.toHaveBeenCalled();
  });
});
