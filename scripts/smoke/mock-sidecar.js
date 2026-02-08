#!/usr/bin/env node

/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const http = require('http');

const PORT = Number.parseInt(process.env.SIDECAR_PORT || '9080', 10);
const FRAME_MS = Number.parseInt(process.env.MOCK_SIDECAR_FRAME_MS || '100', 10);

const defaultFramePath = path.resolve(__dirname, '../../public/static/placeholder/frames/001.jpg');
const fallbackJpegBase64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxAQEBUQEBAVFhUVFRUVFRUVFRUVFRUVFRUWFhUVFRUYHSggGBolGxUVITEhJSkrLi4uFx8zODMsNygtLisBCgoKDg0OGxAQGzAmICYtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAKABJQMBIgACEQEDEQH/xAAbAAEAAgMBAQAAAAAAAAAAAAAABQYBBAcDAv/EADcQAAEDAgQDBgQEBwAAAAAAAAEAAgMEEQUSITEGEyJBUWEUcYEHFDJSkaGxQlJygpLR8BYjM0PC/8QAGQEBAAMBAQAAAAAAAAAAAAAAAAECAwQF/8QAJxEBAQACAgICAgIDAQAAAAAAAAECEQMhEjEEE0FRImFxgRQyQmH/2gAMAwEAAhEDEQA/ANxREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQf/Z';

const loadJpegFrame = () => {
  if (fs.existsSync(defaultFramePath)) {
    return fs.readFileSync(defaultFramePath);
  }

  return Buffer.from(fallbackJpegBase64, 'base64');
};

const frameBytes = loadJpegFrame();
let sessionStarted = false;
let frameId = 0;

const writeJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
};

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/healthz') {
    writeJson(res, 200, { status: 'ok' });
    return;
  }

  if (req.method === 'GET' && req.url === '/readyz') {
    writeJson(res, 200, { status: 'ok', runtime: 'mock-sidecar' });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/v1/runtime/session/start') {
    sessionStarted = true;
    writeJson(res, 202, {
      status: 'starting',
      session: {
        session_started: sessionStarted,
      },
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/v1/runtime/session/stop') {
    sessionStarted = false;
    writeJson(res, 200, {
      status: 'stopped',
      session: {
        session_started: sessionStarted,
      },
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/api/v1/runtime/session/status') {
    writeJson(res, 200, {
      status: 'ok',
      session_started: sessionStarted,
      session: {
        session_started: sessionStarted,
      },
      inference: {
        mode: 'mock',
      },
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/api/v1/stream/detections') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const interval = setInterval(() => {
      frameId += 1;
      const payload = {
        frame_id: frameId,
        timestamp_ms: Date.now(),
        session_started: sessionStarted,
        video_resolution: { w: 1280, h: 720 },
        source: 'mock-sidecar',
        objects: sessionStarted
          ? [{
            name: 'demo-object',
            confidence: 0.9,
            relative_coordinates: {
              center_x: 0.5,
              center_y: 0.5,
              width: 0.2,
              height: 0.2,
            },
          }]
          : [],
      };
      res.write(`event: detections\ndata: ${JSON.stringify(payload)}\n\n`);
    }, FRAME_MS);

    req.on('close', () => {
      clearInterval(interval);
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/api/v1/stream/mjpeg') {
    res.writeHead(200, {
      'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const writeFrame = () => {
      res.write('--frame\r\n');
      res.write('Content-Type: image/jpeg\r\n');
      res.write(`Content-Length: ${frameBytes.length}\r\n\r\n`);
      res.write(frameBytes);
      res.write('\r\n');
    };

    writeFrame();
    const interval = setInterval(writeFrame, 500);
    req.on('close', () => {
      clearInterval(interval);
    });
    return;
  }

  writeJson(res, 404, { error: 'not_found' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`mock-sidecar listening on 127.0.0.1:${PORT}`);
});
