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
    this.shouldReconnect = config.shouldReconnect !== undefined ? config.shouldReconnect : true;
    this.reconnectDelayMs = Number.isInteger(config.reconnectDelayMs)
      ? config.reconnectDelayMs
      : 1000;

    this.request = null;
    this.response = null;
    this.buffer = '';
    this.isRunning = false;
    this.isConnecting = false;
    this.manuallyStopped = true;
    this.reconnectTimer = null;
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

  clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  scheduleReconnect() {
    if (this.manuallyStopped || !this.shouldReconnect || this.reconnectTimer) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectDelayMs);
  }

  cleanupConnection({ destroy = false } = {}) {
    if (destroy && this.request) {
      this.request.destroy();
    }

    if (destroy && this.response) {
      this.response.destroy();
    }

    this.request = null;
    this.response = null;
    this.buffer = '';
    this.isRunning = false;
    this.isConnecting = false;
  }

  handleConnectionClosed(error = null) {
    const wasActive = this.isRunning || this.isConnecting;
    this.cleanupConnection();

    if (error) {
      this.onError(error);
    }

    if (wasActive) {
      this.onClose();
    }

    this.scheduleReconnect();
  }

  connect() {
    if (this.manuallyStopped || this.isRunning || this.isConnecting) {
      return;
    }

    this.isConnecting = true;
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
        this.handleConnectionClosed(
          new Error(`Sidecar detections stream returned HTTP ${res.statusCode}`),
        );
        return;
      }

      this.isConnecting = false;
      this.isRunning = true;
      this.onOpen();
      res.setEncoding('utf8');
      res.on('data', (chunk) => this.handleChunk(chunk));
      res.on('error', (error) => this.handleConnectionClosed(error));
      res.on('close', () => this.handleConnectionClosed());
      res.on('end', () => this.handleConnectionClosed());
    });

    this.request.on('error', (error) => {
      this.handleConnectionClosed(error);
    });
    this.request.end();
  }

  start() {
    if (this.isRunning || this.isConnecting) {
      return;
    }

    this.manuallyStopped = false;
    this.connect();
  }

  stop() {
    this.manuallyStopped = true;
    this.clearReconnectTimer();
    const wasActive = this.isRunning || this.isConnecting;
    this.cleanupConnection({ destroy: true });

    if (wasActive) {
      this.onClose();
    }
  }
}

module.exports = { SidecarDetectionsStream };
