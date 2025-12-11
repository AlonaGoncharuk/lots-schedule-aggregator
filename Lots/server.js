const express = require('express');
const cors = require('cors');
const cheerio = require('cheerio');
const { chromium } = require('playwright');
const fetch = (...args) => import('node-fetch').then(({ default: fn }) => fn(...args));
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const ORCHESTRA_38 = '38 SAMURAI';
const ORCHESTRA_LORDS = 'Lords of the Sound';

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const parseFlexibleDate = (value) => {
  if (!value) return null;
  const trimmed = value.trim();
  
  // Try European format first (DD.MM.YYYY or DD/MM/YYYY or DD-MM-YYYY)
  // Look for patterns like 11.12.2025 (day.month.year)
  const europeanMatch = trimmed.match(/(\d{1,2})[.\/\- ](\d{1,2})[.\/\- ](\d{2,4})/);
  if (europeanMatch) {
    const part1 = Number(europeanMatch[1]);
    const part2 = Number(europeanMatch[2]);
    const part3 = europeanMatch[3];
    const year = part3.length === 2 ? Number(`20${part3}`) : Number(part3);
    
    // If part1 > 12, it must be day (European format)
    // If part2 > 12, it must be month (American format)
    // Otherwise, assume European format (DD.MM.YYYY) since that's what the sites use
    let day, month;
    if (part1 > 12) {
      // Definitely European: DD.MM.YYYY
      day = part1;
      month = part2 - 1;
    } else if (part2 > 12) {
      // Definitely American: MM.DD.YYYY
      month = part1 - 1;
      day = part2;
    } else {
      // Ambiguous - assume European format (DD.MM.YYYY) as per user requirement
      day = part1;
      month = part2 - 1;
    }
    
    const dt = new Date(year, month, day);
    if (!Number.isNaN(dt.getTime())) return dt;
  }
  
  // Fallback to direct Date parsing
  const direct = new Date(trimmed);
  if (!Number.isNaN(direct.getTime())) return direct;
  
  return null;
};

const parseDateLabel = (dateStr) => {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const day = d.getDate();
  const month = monthNames[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
};

const normalizeShow = ({ dateText, country, city, show, orchestra }) => {
  const parsed = parseFlexibleDate(dateText);
  if (!parsed) return null;
  return {
    dateISO: parsed.toISOString(),
    dateLabel: parseDateLabel(parsed),
    country: country?.trim() || '',
    city: city?.trim() || '',
    show: show?.trim() || '',
    orchestra
  };
};

// Helper function to find column index by header name
const findColumnIndex = ($table, headerText) => {
  const headers = $table.find('thead tr th, thead tr td, tr:first-child th, tr:first-child td');
  for (let i = 0; i < headers.length; i++) {
    const text = headers.eq(i).text().toLowerCase().trim();
    // Match exact or partial header text
    if (text === headerText.toLowerCase() || text.includes(headerText.toLowerCase())) {
      return i;
    }
  }
  return -1;
};

// Helper function to extract table data by column headers
const extractTableDataByHeaders = ($table, country, orchestra) => {
  const results = [];
  
  // Find column indices by header names (try multiple variations)
  const dateIdx = findColumnIndex($table, 'date');
  const cityIdx = findColumnIndex($table, 'city');
  // Try show, venue, scene, or program
  const showIdx = findColumnIndex($table, 'show') !== -1 ? findColumnIndex($table, 'show') : 
                   findColumnIndex($table, 'venue') !== -1 ? findColumnIndex($table, 'venue') :
                   findColumnIndex($table, 'scene') !== -1 ? findColumnIndex($table, 'scene') :
                   findColumnIndex($table, 'program');
  const countryIdx = findColumnIndex($table, 'country');
  
  if (dateIdx === -1) {
    console.log(`Could not find date column in table. Available headers: ${$table.find('thead tr th, thead tr td, tr:first-child th, tr:first-child td').map((i, el) => $table.constructor(el).text().trim()).get().join(', ')}`);
    return results;
  }
  
  console.log(`Found columns - Date: ${dateIdx}, City: ${cityIdx}, Show: ${showIdx}, Country: ${countryIdx}`);
  
  // Extract rows (skip header row)
  const rows = $table.find('tbody tr, tr').not(':first-child');
  
  // Use a for loop to access rows directly via index
  for (let i = 0; i < rows.length; i++) {
    const $row = rows.eq(i);
    const tds = $row.find('td, th');
    
    // Skip if this looks like a header row
    const rowText = $row.text().toLowerCase();
    if (rowText.includes('date') && (rowText.includes('city') || rowText.includes('venue'))) {
      continue;
    }
    
    if (tds.length > dateIdx && dateIdx !== -1) {
      const dateText = tds.eq(dateIdx).text().trim();
      const city = cityIdx !== -1 && tds.length > cityIdx ? tds.eq(cityIdx).text().trim() : '';
      const show = showIdx !== -1 && tds.length > showIdx ? tds.eq(showIdx).text().trim() : '';
      const rowCountry = countryIdx !== -1 && tds.length > countryIdx ? tds.eq(countryIdx).text().trim() : country;
      
      if (dateText && dateText.match(/\d{1,2}[.\/\- ]\d{1,2}/)) {
        const normalized = normalizeShow({
          dateText,
          country: rowCountry || country,
          city,
          show,
          orchestra
        });
        if (normalized) {
          console.log(`Added: ${normalized.dateLabel} - ${normalized.city}, ${normalized.country} (${orchestra})`);
          results.push(normalized);
        } else {
          console.log(`Failed to normalize: date="${dateText}", city="${city}", show="${show}", country="${rowCountry || country}"`);
        }
      } else {
        console.log(`Date doesn't match pattern: "${dateText}"`);
      }
    }
  }
  
  console.log(`Extracted ${results.length} shows from table`);
  
  return results;
};

async function scrape38Samurai() {
  const url = 'https://38samurai.com/';
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);
    
    // Check main page first for table
    let html = await page.content();
    let $ = cheerio.load(html);
    let tables = $('table');
    
    // If no table on main page, try navigating to Tour page
    if (tables.length === 0) {
      console.log('38Samurai: No table on main page, trying Tour page...');
      try {
        const tourSelectors = [
          'a[href*="/tour"]',
          'a[href*="tour"]',
          'nav a',
          '.menu a',
          '.navigation a'
        ];
        
        for (const selector of tourSelectors) {
          try {
            const links = await page.locator(selector).all();
            for (const link of links) {
              const text = await link.textContent();
              const href = await link.getAttribute('href');
              if (href && (text?.toLowerCase().includes('tour') || href.toLowerCase().includes('tour'))) {
                const fullUrl = href.startsWith('http') ? href : `https://38samurai.com${href.startsWith('/') ? '' : '/'}${href}`;
                console.log(`38Samurai: Found tour link: ${fullUrl}`);
                await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await page.waitForTimeout(3000);
                html = await page.content();
                $ = cheerio.load(html);
                break;
              }
            }
          } catch (e) {
            // Continue
          }
        }
      } catch (e) {
        console.log('38Samurai: Could not navigate to tour page');
      }
    }
    
    const results = [];
    console.log('38Samurai: Starting data extraction...');

    // First, try extracting from tables by column headers (most reliable)
    const tableSelectors = ['table', '.table', '.schedule-table', '.tour-table'];
    for (const tableSelector of tableSelectors) {
      const tables = $(tableSelector);
      if (tables.length > 0) {
        console.log(`38Samurai: Found ${tables.length} table(s) with selector: ${tableSelector}`);
        tables.each((_, tableEl) => {
          const $table = $(tableEl);
          console.log(`38Samurai: Processing table, calling extractTableDataByHeaders...`);
          const tableResults = extractTableDataByHeaders($table, '', ORCHESTRA_38);
          console.log(`38Samurai: extractTableDataByHeaders returned ${tableResults.length} results`);
          if (tableResults.length > 0) {
            console.log(`38Samurai: Extracted ${tableResults.length} shows from table using column headers`);
            results.push(...tableResults);
          } else {
            console.log(`38Samurai: No results extracted from this table`);
          }
        });
        if (results.length > 0) {
          console.log(`38Samurai: Successfully extracted ${results.length} shows from tables`);
          return results;
        } else {
          console.log(`38Samurai: No results extracted from tables, trying other selectors...`);
        }
      }
    }

    // If no tables found, try multiple selector patterns
    const selectors = [
      '[data-qa="tour-item"]',
      '[data-qa*="tour"]',
      '.tour-item',
      '.tour-list-item',
      '.schedule-item',
      '.event-item',
      '.tour-card',
      '.event-card',
      'article.tour',
      '.tour-schedule-item',
      'tr[class*="tour"]',
      'div[class*="event"]'
    ];

    for (const selector of selectors) {
      try {
        const items = $(selector);
        if (items.length > 0) {
          console.log(`38Samurai: Found ${items.length} items with selector: ${selector}`);
          items.each((_, el) => {
            const $el = $(el);
            const dateText = $el.find('[data-qa="tour-date"], [data-qa*="date"], .tour-date, .date, .event-date, time').first().text().trim() ||
                            $el.text().match(/\d{1,2}[.\/\- ]\d{1,2}[.\/\- ]\d{2,4}/)?.[0] || '';
            const city = $el.find('[data-qa="tour-city"], [data-qa*="city"], .tour-city, .city, .event-city').first().text().trim() || '';
            const country = $el.find('[data-qa="tour-country"], [data-qa*="country"], .tour-country, .country, .event-country').first().text().trim() || '';
            const show = $el.find('[data-qa="tour-name"], [data-qa*="name"], .tour-name, .show-name, .event-name, h2, h3').first().text().trim() || '';
            
            if (dateText) {
              const normalized = normalizeShow({
                dateText,
                country,
                city,
                show,
                orchestra: ORCHESTRA_38
              });
              if (normalized) results.push(normalized);
            }
          });
          if (results.length > 0) break;
        }
      } catch (e) {
        console.log(`38Samurai: Error with selector ${selector}:`, e.message);
      }
    }

    console.log(`38Samurai: Extracted ${results.length} shows`);
    return results;
  } catch (err) {
    console.error('Error scraping 38Samurai:', err.message);
    return [];
  } finally {
    if (browser) await browser.close();
  }
}

async function scrapeLordsCountriesList() {
  const url = 'https://lordsofthesound.com/';
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);
    
    // Get all links and find country links
    const links = [];
    try {
      const allLinks = await page.locator('a').all();
      console.log(`Lords: Found ${allLinks.length} total links on page`);
      
      for (const link of allLinks) {
        try {
          const href = await link.getAttribute('href');
          const text = await link.textContent();
          
          // Look for country links - they have pattern like countries/[country-name]/#tour
          if (href && (href.includes('countries/') || href.includes('country'))) {
            // Convert relative URLs to absolute
            let fullUrl = href;
            if (!href.startsWith('http')) {
              fullUrl = href.startsWith('/') 
                ? `https://lordsofthesound.com${href}` 
                : `https://lordsofthesound.com/${href}`;
            }
            
            // Remove hash anchor if present (we'll navigate to the page directly)
            fullUrl = fullUrl.split('#')[0];
            
            // Only add if it's a valid country URL and has text
            if (fullUrl.includes('lordsofthesound.com') && 
                fullUrl.includes('countries/') && 
                text && 
                text.trim().length > 0 && 
                text.trim().length < 50 &&
                !text.toLowerCase().includes('tour')) {
              links.push(fullUrl);
            }
          }
        } catch (e) {
          // Skip this link
        }
      }
      
      console.log(`Lords: Found ${links.length} country links using Playwright`);
    } catch (e) {
      console.log('Lords: Playwright method failed, trying cheerio');
    }
    
    // Fallback to cheerio parsing if needed
    if (links.length === 0) {
      const html = await page.content();
      const $ = cheerio.load(html);
      
      $('a').each((_, el) => {
        const href = $(el).attr('href');
        const text = $(el).text().trim();
        
        if (href && (href.includes('countries/') || href.includes('country'))) {
          let fullUrl = href;
          if (!href.startsWith('http')) {
            fullUrl = href.startsWith('/') 
              ? `https://lordsofthesound.com${href}` 
              : `https://lordsofthesound.com/${href}`;
          }
          
          fullUrl = fullUrl.split('#')[0];
          
          if (fullUrl.includes('lordsofthesound.com') && 
              fullUrl.includes('countries/') && 
              text && 
              text.length > 0 && 
              text.length < 50 &&
              !text.toLowerCase().includes('tour')) {
            links.push(fullUrl);
          }
        }
      });
      
      console.log(`Lords: Found ${links.length} country links using cheerio`);
    }

    const uniqueLinks = Array.from(new Set(links));
    console.log(`Lords: Found ${uniqueLinks.length} unique country links: ${uniqueLinks.slice(0, 5).join(', ')}...`);
    return uniqueLinks;
  } catch (err) {
    console.error('Error scraping Lords countries list:', err.message);
    console.error(err.stack);
    return [];
  } finally {
    if (browser) await browser.close();
  }
}

async function scrapeLordsCountry(url) {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    // Navigate to the country page with timeout
    console.log(`Lords: Navigating to ${url}`);
    await Promise.race([
      page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Navigation timeout')), 25000))
    ]);
    await page.waitForTimeout(2000);
    
    // Extract country name from URL if not in page
    const urlMatch = url.match(/countries\/([^\/]+)/);
    const countryFromUrl = urlMatch ? urlMatch[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '';
    
    const html = await page.content();
    const $ = cheerio.load(html);
    
    // Extract country name from various possible locations
    let country = $('h1').first().text().trim() || 
                  $('.country-name').first().text().trim() || 
                  $('.page-title').first().text().trim() ||
                  countryFromUrl ||
                  $('title').first().text().trim().replace(/ - .*$/, '') || 
                  'Unknown';
    
    // Clean up country name
    country = country.replace(/ - .*$/, '').replace(/\s+/g, ' ').trim();
    if (!country || country === 'Unknown') {
      country = countryFromUrl || 'Unknown';
    }
    
    console.log(`Lords: Extracting shows for country: ${country}`);
    const shows = [];

    // Try extracting from tables by column headers first
    const tableSelectors = [
      '.shedule table',
      '.schedule table',
      '.shedule .table',
      '.schedule .table',
      '.table',
      'table',
      '.tour-table',
      '.schedule-table'
    ];

    for (const tableSelector of tableSelectors) {
      const tables = $(tableSelector);
      if (tables.length > 0) {
        console.log(`Lords ${country}: Found ${tables.length} table(s) with selector: ${tableSelector}`);
        tables.each((_, tableEl) => {
          const $table = $(tableEl);
          const tableResults = extractTableDataByHeaders($table, country, ORCHESTRA_LORDS);
          if (tableResults.length > 0) {
            console.log(`Lords ${country}: Extracted ${tableResults.length} shows from table using column headers`);
            shows.push(...tableResults);
          } else {
            console.log(`Lords ${country}: No shows extracted from table, checking structure...`);
          }
        });
        if (shows.length > 0) {
          break;
        }
      }
    }

    console.log(`Lords ${country}: Extracted ${shows.length} shows total`);
    return shows;
  } catch (err) {
    console.error(`Error scraping Lords country ${url}:`, err.message);
    console.error(err.stack);
    return [];
  } finally {
    if (browser) await browser.close();
  }
}

async function scrapeLordsAll() {
  const countryLinks = await scrapeLordsCountriesList();
  console.log(`Lords: Processing ${countryLinks.length} country pages`);
  
  // Process countries in parallel batches to speed up scraping
  const batchSize = 5; // Process 5 countries at a time
  const all = [];
  
  for (let i = 0; i < countryLinks.length; i += batchSize) {
    const batch = countryLinks.slice(i, i + batchSize);
    console.log(`Lords: Processing batch ${Math.floor(i / batchSize) + 1} (${batch.length} countries)`);
    
    const batchPromises = batch.map(async (link) => {
      try {
        console.log(`Lords: Scraping ${link}...`);
        const shows = await scrapeLordsCountry(link);
        console.log(`Lords: Got ${shows.length} shows from ${link}`);
        return shows;
      } catch (err) {
        console.error(`Failed to scrape ${link}:`, err.message);
        return [];
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    batchResults.forEach(shows => all.push(...shows));
  }
  
  console.log(`Lords: Total shows collected: ${all.length}`);
  return all;
}

function sortShows(shows) {
  return [...shows].sort((a, b) => {
    if (a.dateISO !== b.dateISO) return new Date(a.dateISO) - new Date(b.dateISO);
    return a.country.localeCompare(b.country);
  });
}

function summarizeByCountryMonth(shows) {
  const summary = {};
  for (const show of shows) {
    const d = new Date(show.dateISO);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!summary[show.country]) {
      summary[show.country] = { total: 0, months: {} };
    }
    summary[show.country].total += 1;
    summary[show.country].months[monthKey] = (summary[show.country].months[monthKey] || 0) + 1;
  }
  return summary;
}

app.get('/api/debug', async (_req, res) => {
  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://38samurai.com/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    const html = await page.content();
    await browser.close();
    res.send(html.substring(0, 10000));
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get('/api/schedule', async (req, res) => {
  // Set a longer timeout for this endpoint
  req.setTimeout(300000); // 5 minutes
  res.setTimeout(300000);
  
  const startTime = Date.now();
  
  try {
    console.log('Starting scrape...');
    
    // Add timeout wrapper
    const scrapeWithTimeout = async (scraper, timeoutMs) => {
      return Promise.race([
        scraper(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Scraping timeout')), timeoutMs)
        )
      ]);
    };
    
    const [samurai, lords] = await Promise.all([
      scrapeWithTimeout(scrape38Samurai, 60000), // 1 minute for 38Samurai
      scrapeWithTimeout(scrapeLordsAll, 240000)   // 4 minutes for Lords (many countries)
    ]);
    
    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Scraped ${samurai.length} from 38Samurai, ${lords.length} from Lords in ${elapsedSeconds}s`);
    const combined = sortShows([...samurai, ...lords]);
    const summary = summarizeByCountryMonth(combined);
    res.json({ shows: combined, summary, loadTime: elapsedSeconds });
  } catch (err) {
    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`API error after ${elapsedSeconds}s:`, err);
    res.status(500).json({ error: 'Failed to fetch schedules', details: err.message, loadTime: elapsedSeconds });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

