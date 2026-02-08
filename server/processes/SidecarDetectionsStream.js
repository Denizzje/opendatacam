const http = require('http');
const https = require('https');
const { URL } = require('url');

class SidecarDetectionsStream {
  constructor(config = {}) {
    this.baseURL = config.baseURL || 'http://localhost:9080';
    this.path = config.path || '/api/v1/stream/detections';
    this.onDetection = config.onDetection || (() => {});
    this.onError = config.onError || (() => {});
    this.onOpen = config.onOpen || (() => {});
    this.onClose = config.onClose || (() => {});

    this.request = null;
    this.response = null;
    this.buffer = '';
    this.isRunning = false;
  }

  static parseEventBlock(eventBlock) {
    const lines = eventBlock
      .replace(/\r/g, '')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      return null;
    }

    let event = 'message';
    const dataLines = [];

    lines.forEach((line) => {
      if (line.startsWith('event:')) {
        event = line.replace('event:', '').trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.replace('data:', '').trim());
      }
    });

    if (dataLines.length === 0) {
      return null;
    }

    const dataString = dataLines.join('\n');
    try {
      return {
        event,
        data: JSON.parse(dataString),
      };
    } catch (error) {
      return null;
    }
  }

  handleChunk(chunk) {
    this.buffer += chunk;
    let splitMatch = this.buffer.match(/\r?\n\r?\n/);

    while (splitMatch) {
      const splitIndex = splitMatch.index;
      const block = this.buffer.substring(0, splitIndex);
      this.buffer = this.buffer.substring(splitIndex + splitMatch[0].length);

      const parsed = SidecarDetectionsStream.parseEventBlock(block);
      if (parsed) {
        this.onDetection(parsed);
      }

      splitMatch = this.buffer.match(/\r?\n\r?\n/);
    }
  }

  start() {
    if (this.isRunning) {
      return;
    }

    const url = new URL(this.path, this.baseURL);
    const httpModule = url.protocol === 'https:' ? https : http;

    this.request = httpModule.request({
      method: 'GET',
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port,
      path: `${url.pathname}${url.search}`,
      headers: {
        Accept: 'text/event-stream',
      },
    }, (res) => {
      this.response = res;
      this.buffer = '';

      if (res.statusCode >= 400) {
        this.onError(new Error(`Sidecar detections stream returned HTTP ${res.statusCode}`));
        this.stop();
        return;
      }

      this.isRunning = true;
      this.onOpen();
      res.setEncoding('utf8');
      res.on('data', (chunk) => this.handleChunk(chunk));
      res.on('error', (error) => this.onError(error));
      res.on('close', () => {
        this.isRunning = false;
        this.onClose();
      });
      res.on('end', () => {
        this.isRunning = false;
        this.onClose();
      });
    });

    this.request.on('error', (error) => {
      this.isRunning = false;
      this.onError(error);
    });
    this.request.end();
  }

  stop() {
    if (this.request) {
      this.request.destroy();
      this.request = null;
    }

    if (this.response) {
      this.response.destroy();
      this.response = null;
    }

    this.buffer = '';
    this.isRunning = false;
  }
}

module.exports = { SidecarDetectionsStream };
