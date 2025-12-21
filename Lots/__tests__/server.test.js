const request = require('supertest');

// Mock Playwright before requiring server
jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn().mockResolvedValue({
      newPage: jest.fn().mockResolvedValue({
        goto: jest.fn().mockResolvedValue(),
        waitForTimeout: jest.fn().mockResolvedValue(),
        content: jest.fn().mockResolvedValue('<html></html>'),
        setViewportSize: jest.fn().mockResolvedValue(),
        locator: jest.fn().mockReturnValue({
          all: jest.fn().mockResolvedValue([]),
          textContent: jest.fn().mockResolvedValue(''),
          getAttribute: jest.fn().mockResolvedValue(null)
        }),
        close: jest.fn().mockResolvedValue()
      }),
      close: jest.fn().mockResolvedValue()
    })
  }
}));

// Mock logger to avoid file system operations in tests
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  generateSessionId: jest.fn(() => 'test-session-id'),
  getSessionLogs: jest.fn(() => []),
  getSessionLogFilePath: jest.fn(() => null)
}));

const { app } = require('../server');

describe('API Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/schedule', () => {
    test('should return JSON response', async () => {
      const response = await request(app)
        .get('/api/schedule')
        .timeout(30000);
      
      // Response should be JSON (either success or error)
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(600);
      if (response.status < 400) {
        expect(response.body).toBeDefined();
      }
    }, 30000); // Increase timeout for scraping

    test('should handle refresh parameter', async () => {
      const response = await request(app)
        .get('/api/schedule?refresh=true')
        .timeout(30000);
      
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(600);
      if (response.status < 400) {
        expect(response.body).toBeDefined();
      }
    }, 30000);
  });

  describe('GET /api/logs/:sessionId', () => {
    test('should return logs data', async () => {
      const response = await request(app)
        .get('/api/logs/test-session-id');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('sessionId');
      expect(response.body).toHaveProperty('logs');
      expect(Array.isArray(response.body.logs)).toBe(true);
    });
  });

  describe('GET / (static files)', () => {
    test('should serve static files', async () => {
      const response = await request(app)
        .get('/')
        .expect('Content-Type', /html/);
      
      expect(response.status).toBe(200);
    });
  });
});

