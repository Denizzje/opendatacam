const axios = require('axios');

class InferenceSidecarClient {
  constructor(config = {}) {
    const baseURL = config.baseURL || 'http://localhost:9080';
    const timeout = Number.isInteger(config.timeoutMs) ? config.timeoutMs : 5000;

    this.baseURL = baseURL;
    this.http = config.http || axios.create({
      baseURL,
      timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async getHealth() {
    const response = await this.http.get('/healthz');
    return response.data;
  }

  async getReadiness() {
    const response = await this.http.get('/readyz');
    return response.data;
  }

  async startSession(payload = {}) {
    const response = await this.http.post('/api/v1/runtime/session/start', payload);
    return response.data;
  }

  async stopSession() {
    const response = await this.http.post('/api/v1/runtime/session/stop');
    return response.data;
  }

  async getSessionStatus() {
    const response = await this.http.get('/api/v1/runtime/session/status');
    return response.data;
  }

  async getDetectionsStream() {
    return this.http.get('/api/v1/stream/detections', {
      responseType: 'stream',
    });
  }
}

module.exports = { InferenceSidecarClient };
