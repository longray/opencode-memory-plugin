import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('Config Module', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('config exports', () => {
    it('should export config object', async () => {
      const { config, getConfig, getApiUrl, getWebSocketUrl } = await import(
        '../lib/config.js'
      );
      expect(config).toBeDefined();
      expect(typeof getConfig).toBe('function');
      expect(typeof getApiUrl).toBe('function');
      expect(typeof getWebSocketUrl).toBe('function');
    });
  });

  describe('default config values', () => {
    it('should have correct default API port', async () => {
      const { config } = await import('../lib/config.js');
      expect(config.api.port).toBe(18008);
    });

    it('should have correct default API host', async () => {
      const { config } = await import('../lib/config.js');
      expect(config.api.host).toBe('localhost');
    });

    it('should have correct default WebSocket settings', async () => {
      const { config } = await import('../lib/config.js');
      expect(config.websocket.enabled).toBe(true);
      expect(config.websocket.heartbeatInterval).toBe(30000);
      expect(config.websocket.reconnectMaxAttempts).toBe(10);
      expect(config.websocket.reconnectBaseDelay).toBe(1000);
    });

    it('should have correct default log settings', async () => {
      const { config } = await import('../lib/config.js');
      expect(config.log.level).toBe('info');
    });

    it('should have correct default sync settings', async () => {
      const { config } = await import('../lib/config.js');
      expect(config.sync.autoSync).toBe(true);
      expect(config.sync.syncInterval).toBe(300000);
    });
  });

  describe('environment variable configuration', () => {
    it('should have environment variable names documented', async () => {
      const { config } = await import('../lib/config.js');
      // Verify config structure supports environment overrides
      expect(config.api).toHaveProperty('port');
      expect(config.api).toHaveProperty('host');
      expect(config.api).toHaveProperty('url');
      expect(config.log).toHaveProperty('level');
      expect(config.websocket).toHaveProperty('enabled');
    });

    it('should parse API_PORT as integer', async () => {
      const { config } = await import('../lib/config.js');
      expect(Number.isInteger(config.api.port)).toBe(true);
    });

    it('should parse WS_ENABLED as boolean', async () => {
      const { config } = await import('../lib/config.js');
      expect(typeof config.websocket.enabled).toBe('boolean');
    });
  });

  describe('helper functions', () => {
    it('getConfig should return config object', async () => {
      const { getConfig, config } = await import('../lib/config.js');
      expect(getConfig()).toBe(config);
    });

    it('getApiUrl should return API URL', async () => {
      const { getApiUrl } = await import('../lib/config.js');
      const url = getApiUrl();
      expect(url).toContain('localhost');
      expect(url).toContain('18008');
    });

    it('getWebSocketUrl should return WebSocket URL', async () => {
      const { getWebSocketUrl } = await import('../lib/config.js');
      const url = getWebSocketUrl();
      expect(url).toMatch(/^ws:\/\//);
      expect(url).toContain('localhost');
      expect(url).toContain('18008');
    });
  });
});
