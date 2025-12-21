// Mock logger before requiring server
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  generateSessionId: jest.fn(() => 'test-session-id'),
  getSessionLogs: jest.fn(() => []),
  getSessionLogFilePath: jest.fn(() => null)
}));

// Mock Playwright to avoid browser launch in tests
jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn()
  }
}));

const {
  parseFlexibleDate,
  parseDateLabel,
  normalizeShow,
  sortShows,
  summarizeByCountryMonth
} = require('../server');

describe('Utility Functions', () => {
  describe('parseFlexibleDate', () => {
    test('should parse European format DD.MM.YYYY', () => {
      const result = parseFlexibleDate('15.03.2025');
      expect(result).toBeInstanceOf(Date);
      expect(result.getDate()).toBe(15);
      expect(result.getMonth()).toBe(2); // March is month 2 (0-indexed)
      expect(result.getFullYear()).toBe(2025);
    });

    test('should parse European format DD/MM/YYYY', () => {
      const result = parseFlexibleDate('15/03/2025');
      expect(result).toBeInstanceOf(Date);
      expect(result.getDate()).toBe(15);
      expect(result.getMonth()).toBe(2);
      expect(result.getFullYear()).toBe(2025);
    });

    test('should parse European format DD-MM-YYYY', () => {
      const result = parseFlexibleDate('15-03-2025');
      expect(result).toBeInstanceOf(Date);
      expect(result.getDate()).toBe(15);
      expect(result.getMonth()).toBe(2);
      expect(result.getFullYear()).toBe(2025);
    });

    test('should parse date with 2-digit year', () => {
      const result = parseFlexibleDate('15.03.25');
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2025);
    });

    test('should handle day > 12 as European format', () => {
      const result = parseFlexibleDate('25.03.2025');
      expect(result).toBeInstanceOf(Date);
      expect(result.getDate()).toBe(25);
      expect(result.getMonth()).toBe(2);
    });

    test('should handle ambiguous dates as European format', () => {
      const result = parseFlexibleDate('05.03.2025');
      expect(result).toBeInstanceOf(Date);
      expect(result.getDate()).toBe(5); // Assumes European format
      expect(result.getMonth()).toBe(2);
    });

    test('should fallback to direct Date parsing', () => {
      const result = parseFlexibleDate('2025-03-15');
      expect(result).toBeInstanceOf(Date);
    });

    test('should return null for invalid date', () => {
      const result = parseFlexibleDate('invalid date');
      expect(result).toBeNull();
    });

    test('should return null for empty string', () => {
      const result = parseFlexibleDate('');
      expect(result).toBeNull();
    });

    test('should return null for null/undefined', () => {
      expect(parseFlexibleDate(null)).toBeNull();
      expect(parseFlexibleDate(undefined)).toBeNull();
    });

    test('should trim whitespace', () => {
      const result = parseFlexibleDate('  15.03.2025  ');
      expect(result).toBeInstanceOf(Date);
      expect(result.getDate()).toBe(15);
    });
  });

  describe('parseDateLabel', () => {
    test('should format date correctly', () => {
      const date = new Date('2025-03-15');
      const result = parseDateLabel(date.toISOString());
      expect(result).toBe('15 March 2025');
    });

    test('should return null for invalid date', () => {
      const result = parseDateLabel('invalid');
      expect(result).toBeNull();
    });

    test('should handle different months', () => {
      const date = new Date('2025-01-01');
      const result = parseDateLabel(date.toISOString());
      expect(result).toBe('1 January 2025');
    });
  });

  describe('normalizeShow', () => {
    test('should normalize show data correctly', () => {
      const input = {
        dateText: '15.03.2025',
        country: 'Germany',
        city: 'Berlin',
        show: 'Concert',
        orchestra: '38 SAMURAI'
      };
      const result = normalizeShow(input);
      
      expect(result).toBeTruthy();
      expect(result.dateISO).toBeTruthy();
      expect(result.dateLabel).toBe('15 March 2025');
      expect(result.country).toBe('Germany');
      expect(result.city).toBe('Berlin');
      expect(result.show).toBe('Concert');
      expect(result.orchestra).toBe('38 SAMURAI');
    });

    test('should return null for invalid date', () => {
      const input = {
        dateText: 'invalid',
        country: 'Germany',
        city: 'Berlin',
        show: 'Concert',
        orchestra: '38 SAMURAI'
      };
      const result = normalizeShow(input);
      expect(result).toBeNull();
    });

    test('should trim whitespace from strings', () => {
      const input = {
        dateText: '15.03.2025',
        country: '  Germany  ',
        city: '  Berlin  ',
        show: '  Concert  ',
        orchestra: '38 SAMURAI'
      };
      const result = normalizeShow(input);
      expect(result.country).toBe('Germany');
      expect(result.city).toBe('Berlin');
      expect(result.show).toBe('Concert');
    });

    test('should handle empty strings', () => {
      const input = {
        dateText: '15.03.2025',
        country: '',
        city: '',
        show: '',
        orchestra: '38 SAMURAI'
      };
      const result = normalizeShow(input);
      expect(result).toBeTruthy();
      expect(result.country).toBe('');
      expect(result.city).toBe('');
      expect(result.show).toBe('');
    });

    test('should handle null/undefined values', () => {
      const input = {
        dateText: '15.03.2025',
        country: null,
        city: undefined,
        show: 'Concert',
        orchestra: '38 SAMURAI'
      };
      const result = normalizeShow(input);
      expect(result).toBeTruthy();
      expect(result.country).toBe('');
      expect(result.city).toBe('');
    });
  });

  describe('sortShows', () => {
    test('should sort shows by date', () => {
      const shows = [
        { dateISO: '2025-03-15T00:00:00.000Z', country: 'Germany' },
        { dateISO: '2025-01-10T00:00:00.000Z', country: 'France' },
        { dateISO: '2025-02-20T00:00:00.000Z', country: 'Italy' }
      ];
      const result = sortShows(shows);
      
      expect(result[0].dateISO).toBe('2025-01-10T00:00:00.000Z');
      expect(result[1].dateISO).toBe('2025-02-20T00:00:00.000Z');
      expect(result[2].dateISO).toBe('2025-03-15T00:00:00.000Z');
    });

    test('should sort by country when dates are equal', () => {
      const shows = [
        { dateISO: '2025-03-15T00:00:00.000Z', country: 'Germany' },
        { dateISO: '2025-03-15T00:00:00.000Z', country: 'France' },
        { dateISO: '2025-03-15T00:00:00.000Z', country: 'Italy' }
      ];
      const result = sortShows(shows);
      
      expect(result[0].country).toBe('France');
      expect(result[1].country).toBe('Germany');
      expect(result[2].country).toBe('Italy');
    });

    test('should not mutate original array', () => {
      const shows = [
        { dateISO: '2025-03-15T00:00:00.000Z', country: 'Germany' },
        { dateISO: '2025-01-10T00:00:00.000Z', country: 'France' }
      ];
      const original = [...shows];
      sortShows(shows);
      expect(shows).toEqual(original);
    });

    test('should handle empty array', () => {
      const result = sortShows([]);
      expect(result).toEqual([]);
    });

    test('should handle single item', () => {
      const shows = [{ dateISO: '2025-03-15T00:00:00.000Z', country: 'Germany' }];
      const result = sortShows(shows);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(shows[0]);
    });
  });

  describe('summarizeByCountryMonth', () => {
    test('should summarize shows by country and month', () => {
      const shows = [
        { dateISO: '2025-03-15T00:00:00.000Z', country: 'Germany' },
        { dateISO: '2025-03-20T00:00:00.000Z', country: 'Germany' },
        { dateISO: '2025-04-10T00:00:00.000Z', country: 'Germany' },
        { dateISO: '2025-03-25T00:00:00.000Z', country: 'France' }
      ];
      const result = summarizeByCountryMonth(shows);
      
      expect(result.Germany).toBeTruthy();
      expect(result.Germany.total).toBe(3);
      expect(result.Germany.months['2025-03']).toBe(2);
      expect(result.Germany.months['2025-04']).toBe(1);
      
      expect(result.France).toBeTruthy();
      expect(result.France.total).toBe(1);
      expect(result.France.months['2025-03']).toBe(1);
    });

    test('should handle empty array', () => {
      const result = summarizeByCountryMonth([]);
      expect(result).toEqual({});
    });

    test('should handle shows from different years', () => {
      const shows = [
        { dateISO: '2024-12-31T00:00:00.000Z', country: 'Germany' },
        { dateISO: '2025-01-01T00:00:00.000Z', country: 'Germany' }
      ];
      const result = summarizeByCountryMonth(shows);
      
      expect(result.Germany.months['2024-12']).toBe(1);
      expect(result.Germany.months['2025-01']).toBe(1);
      expect(result.Germany.total).toBe(2);
    });

    test('should handle multiple countries', () => {
      const shows = [
        { dateISO: '2025-03-15T00:00:00.000Z', country: 'Germany' },
        { dateISO: '2025-03-20T00:00:00.000Z', country: 'France' },
        { dateISO: '2025-03-25T00:00:00.000Z', country: 'Italy' }
      ];
      const result = summarizeByCountryMonth(shows);
      
      expect(Object.keys(result)).toHaveLength(3);
      expect(result.Germany.total).toBe(1);
      expect(result.France.total).toBe(1);
      expect(result.Italy.total).toBe(1);
    });
  });
});

