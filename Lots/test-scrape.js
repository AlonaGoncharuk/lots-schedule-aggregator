const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

async function test38Samurai() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  
  console.log('Loading 38samurai.com...');
  await page.goto('https://38samurai.com/', { waitUntil: 'networkidle2', timeout: 30000 });
  
  // Wait a bit for dynamic content
  await page.waitForTimeout(3000);
  
  // Try to find and click Tour tab
  try {
    const tourLink = await page.$('a[href*="tour"], a:has-text("Tour"), button:has-text("Tour")');
    if (tourLink) {
      console.log('Found Tour link, clicking...');
      await tourLink.click();
      await page.waitForTimeout(2000);
    }
  } catch (e) {
    console.log('Could not click Tour link:', e.message);
  }
  
  const html = await page.content();
  const $ = cheerio.load(html);
  
  console.log('\n=== Page Title ===');
  console.log($('title').text());
  
  console.log('\n=== Looking for tour-related elements ===');
  $('*').each((i, el) => {
    const $el = $(el);
    const classes = $el.attr('class') || '';
    const id = $el.attr('id') || '';
    const dataAttrs = Object.keys($el.get(0).attribs || {}).filter(k => k.startsWith('data-')).join(', ');
    const text = $el.text().trim().substring(0, 100);
    
    if (classes.toLowerCase().includes('tour') || 
        id.toLowerCase().includes('tour') || 
        dataAttrs.toLowerCase().includes('tour') ||
        (text.toLowerCase().includes('tour') && text.length < 200)) {
      console.log(`\nElement: ${$el.get(0).tagName}`);
      console.log(`Classes: ${classes}`);
      console.log(`ID: ${id}`);
      console.log(`Data attrs: ${dataAttrs}`);
      console.log(`Text: ${text}`);
    }
  });
  
  console.log('\n=== Full HTML (first 5000 chars) ===');
  console.log(html.substring(0, 5000));
  
  await browser.close();
}

test38Samurai().catch(console.error);

