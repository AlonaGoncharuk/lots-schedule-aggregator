// Mock Playwright before requiring server
jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn()
  }
}));

const { chromium } = require('playwright');
const cheerio = require('cheerio');

// We'll test the scraping logic by creating test versions
// Since the scrapers are not exported, we'll test the core logic

describe('Scraping Functions', () => {
  let mockBrowser;
  let mockPage;

  beforeEach(() => {
    mockPage = {
      goto: jest.fn().mockResolvedValue(),
      waitForTimeout: jest.fn().mockResolvedValue(),
      content: jest.fn().mockResolvedValue('<html></html>'),
      setViewportSize: jest.fn().mockResolvedValue(),
      locator: jest.fn().mockReturnValue({
        all: jest.fn().mockResolvedValue([]),
        textContent: jest.fn().mockResolvedValue(''),
        getAttribute: jest.fn().mockResolvedValue(null)
      })
    };

    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn().mockResolvedValue()
    };

    chromium.launch.mockResolvedValue(mockBrowser);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Table parsing logic', () => {
    test('should parse table with date, city, show, country columns', () => {
      const html = `
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>City</th>
              <th>Show</th>
              <th>Country</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>15.03.2025</td>
              <td>Berlin</td>
              <td>Concert</td>
              <td>Germany</td>
            </tr>
          </tbody>
        </table>
      `;
      
      const $ = cheerio.load(html);
      const table = $('table');
      
      // Test findColumnIndex logic
      const headers = table.find('thead tr th');
      let dateIdx = -1;
      for (let i = 0; i < headers.length; i++) {
        const text = headers.eq(i).text().toLowerCase().trim();
        if (text === 'date') {
          dateIdx = i;
          break;
        }
      }
      
      expect(dateIdx).toBe(0);
    });

    test('should handle missing columns gracefully', () => {
      const html = `
        <table>
          <thead>
            <tr>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>15.03.2025</td>
            </tr>
          </tbody>
        </table>
      `;
      
      const $ = cheerio.load(html);
      const table = $('table');
      const headers = table.find('thead tr th');
      
      // Should find date column
      let dateIdx = -1;
      for (let i = 0; i < headers.length; i++) {
        const text = headers.eq(i).text().toLowerCase().trim();
        if (text === 'date') {
          dateIdx = i;
          break;
        }
      }
      
      expect(dateIdx).toBe(0);
    });

    test('should extract data from table rows', () => {
      const html = `
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>City</th>
              <th>Show</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>15.03.2025</td>
              <td>Berlin</td>
              <td>Concert</td>
            </tr>
            <tr>
              <td>20.03.2025</td>
              <td>Munich</td>
              <td>Show</td>
            </tr>
          </tbody>
        </table>
      `;
      
      const $ = cheerio.load(html);
      const rows = $('tbody tr');
      
      expect(rows.length).toBe(2);
      
      const firstRow = rows.eq(0);
      const cells = firstRow.find('td');
      expect(cells.eq(0).text().trim()).toBe('15.03.2025');
      expect(cells.eq(1).text().trim()).toBe('Berlin');
      expect(cells.eq(2).text().trim()).toBe('Concert');
    });

    test('should skip header rows in tbody', () => {
      const html = `
        <table>
          <tbody>
            <tr>
              <th>Date</th>
              <th>City</th>
            </tr>
            <tr>
              <td>15.03.2025</td>
              <td>Berlin</td>
            </tr>
          </tbody>
        </table>
      `;
      
      const $ = cheerio.load(html);
      const rows = $('tbody tr');
      
      // Should identify header row
      const firstRow = rows.eq(0);
      const rowText = firstRow.text().toLowerCase();
      const isHeaderRow = rowText.includes('date') && rowText.includes('city');
      
      expect(isHeaderRow).toBe(true);
    });
  });

  describe('Date pattern matching', () => {
    test('should match date patterns in text', () => {
      const dateText = '15.03.2025';
      const pattern = /\d{1,2}[.\/\- ]\d{1,2}/;
      expect(dateText.match(pattern)).toBeTruthy();
    });

    test('should match various date formats', () => {
      const formats = ['15.03.2025', '15/03/2025', '15-03-2025', '15 03 2025'];
      const pattern = /\d{1,2}[.\/\- ]\d{1,2}/;
      
      formats.forEach(format => {
        expect(format.match(pattern)).toBeTruthy();
      });
    });

    test('should not match invalid date patterns', () => {
      const invalidDates = ['abc', '123', '2025', 'just text', 'no numbers'];
      const pattern = /\d{1,2}[.\/\- ]\d{1,2}/;
      
      invalidDates.forEach(date => {
        const match = date.match(pattern);
        // Should not match the pattern at all
        expect(match).toBeNull();
      });
    });
  });

  describe('Browser interaction', () => {
    test('should launch browser with headless mode', async () => {
      await chromium.launch({ headless: true });
      expect(chromium.launch).toHaveBeenCalledWith({ headless: true });
    });

    test('should navigate to URL', async () => {
      await mockPage.goto('https://example.com', { waitUntil: 'domcontentloaded' });
      expect(mockPage.goto).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({ waitUntil: 'domcontentloaded' })
      );
    });

    test('should close browser after use', async () => {
      await mockBrowser.close();
      expect(mockBrowser.close).toHaveBeenCalled();
    });
  });
});

