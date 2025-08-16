#!/usr/bin/env node
import puppeteer from 'puppeteer';

async function debugLinks() {
  console.log('🔍 Investigating Euronext press release page structure...');
  
  const browser = await puppeteer.launch({
    headless: false, // Show browser for debugging
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
  
  console.log('📡 Loading Euronext page...');
  await page.goto('https://live.euronext.com/en/listview/company-press-release/62020', {
    waitUntil: 'networkidle2'
  });

  // Wait a bit for any dynamic content
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Extract all link patterns and structures
  const linkData = await page.evaluate(() => {
    const results = [];
    
    // Look for different types of links and structures
    const selectors = [
      'tr a', 'tbody a', '[href*="press"]', '[href*="release"]', 
      '[onclick*="press"]', '[onclick*="release"]', 'a[title]',
      'tr', '.table-row', '[data-href]', '[data-url]'
    ];
    
    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el, index) => {
        if (index < 5) { // Limit to first 5 for debugging
          const result = {
            selector: selector,
            tagName: el.tagName,
            href: el.href || null,
            onclick: el.onclick ? el.onclick.toString() : null,
            text: el.textContent?.trim().substring(0, 100) || '',
            outerHTML: el.outerHTML.substring(0, 300)
          };
          
          // Check for data attributes
          const dataAttrs = {};
          for (let attr of el.attributes) {
            if (attr.name.startsWith('data-')) {
              dataAttrs[attr.name] = attr.value;
            }
          }
          result.dataAttributes = dataAttrs;
          
          results.push(result);
        }
      });
    });
    
    return results;
  });

  console.log('🔗 Found link structures:');
  linkData.forEach((item, index) => {
    console.log(`\n--- Item ${index + 1} ---`);
    console.log('Selector:', item.selector);
    console.log('Tag:', item.tagName);
    console.log('Href:', item.href);
    console.log('Text:', item.text);
    if (item.onclick) console.log('OnClick:', item.onclick.substring(0, 200));
    if (Object.keys(item.dataAttributes).length > 0) {
      console.log('Data attrs:', item.dataAttributes);
    }
    console.log('HTML:', item.outerHTML);
  });

  await browser.close();
}

debugLinks().catch(console.error);