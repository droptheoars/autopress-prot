import axios from 'axios';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';
import { retry, Logger, cleanHtmlContent, generateReleaseId } from './utils.js';

export class EuronextScraper {
  constructor(config) {
    this.config = config;
    this.logger = new Logger(config.logging);
  }

  /**
   * Fetch press release list from Euronext
   */
  async fetchPressReleaseList() {
    this.logger.info('Fetching press release list from Euronext');
    
    return retry(async () => {
      const response = await axios.get(this.config.euronext.listUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        },
        timeout: 30000
      });

      const $ = cheerio.load(response.data);
      const releases = [];

      // Parse the press release list - try multiple selectors
      const selectors = [
        'tr', 'tbody tr', '.table-row', '.list-item', '.press-release-item',
        '[data-testid="table-row"]', '.row', 'tr[role="row"]'
      ];
      
      let foundReleases = false;
      
      for (const selector of selectors) {
        if (foundReleases) break;
        
        $(selector).each((index, element) => {
          const $el = $(element);
          
          // Skip header rows
          if ($el.find('th').length > 0) return;
          
          // Try to extract title from various possible locations
          const titleSelectors = [
            'td:nth-child(3)', 'td:nth-child(2)', 'td:nth-child(4)',
            '.title', '.press-release-title', 'h3', 'h4', 'a[title]',
            'td a', '.link-title'
          ];
          
          let title = '';
          let link = '';
          
          for (const titleSel of titleSelectors) {
            const titleEl = $el.find(titleSel).first();
            if (titleEl.length && titleEl.text().trim()) {
              title = titleEl.text().trim();
              link = titleEl.attr('href') || titleEl.find('a').attr('href') || $el.find('a').first().attr('href');
              break;
            }
          }
          
          // Try to extract date
          const dateSelectors = [
            'td:first-child', 'td:nth-child(1)', '.date', '.time', '.release-date'
          ];
          
          let dateText = '';
          for (const dateSel of dateSelectors) {
            const dateEl = $el.find(dateSel).first();
            if (dateEl.length && dateEl.text().trim()) {
              dateText = dateEl.text().trim();
              break;
            }
          }
          
          if (title && title.length > 10 && (link || title.includes('PROTECTOR') || title.includes('GENERAL MEETING'))) {
            foundReleases = true;
            releases.push({
              title,
              dateText: dateText || 'Unknown date',
              url: link ? (link.startsWith('http') ? link : `${this.config.euronext.baseUrl}${link}`) : '#',
              id: generateReleaseId(title, dateText || 'unknown')
            });
          }
        });
      }

      this.logger.info(`Found ${releases.length} press releases`);
      return releases;
    }, this.config.euronext.retryAttempts, this.config.euronext.retryDelayMs);
  }

  /**
   * Fetch detailed content from individual press release page
   */
  async fetchPressReleaseContent(release) {
    this.logger.info(`Fetching content for: ${release.title}`);
    
    return retry(async () => {
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
        
        await page.goto(release.url, { 
          waitUntil: 'networkidle2',
          timeout: 30000 
        });

        // Wait for content to load
        await page.waitForTimeout(2000);

        const content = await page.evaluate(() => {
          // Look for the main content in various possible containers
          const selectors = [
            '.row.mb-5',           // Your specific class
            '.press-release-content',
            '.content',
            '.article-content',
            '.main-content',
            'main',
            '.container .row:nth-child(3)', // Third row as you mentioned
            '[class*=\"row\"][class*=\"mb-5\"]'
          ];

          let mainContent = '';
          let title = '';
          let publishDate = '';

          // Try to find title
          const titleSelectors = ['h1', '.title', '.press-release-title', '.headline'];
          for (const selector of titleSelectors) {
            const titleEl = document.querySelector(selector);
            if (titleEl && titleEl.textContent.trim()) {
              title = titleEl.textContent.trim();
              break;
            }
          }

          // Try to find date
          const dateSelectors = ['.date', '.published', '.time', '.release-date'];
          for (const selector of dateSelectors) {
            const dateEl = document.querySelector(selector);
            if (dateEl && dateEl.textContent.trim()) {
              publishDate = dateEl.textContent.trim();
              break;
            }
          }

          // Try to find main content - specifically target the THIRD "row mb-5" class
          const rowElements = document.querySelectorAll('.row.mb-5');
          if (rowElements.length >= 3) {
            // Use the third "row mb-5" element as specified
            const thirdRowEl = rowElements[2]; // 0-indexed, so [2] is the third
            const clonedEl = thirdRowEl.cloneNode(true);
            
            // Remove unwanted elements
            const unwantedSelectors = [
              '.navigation', '.nav', '.sidebar', '.footer', 
              '.advertisement', '.ads', '.social-share',
              '.breadcrumb', '.pagination', '.related-articles'
            ];
            
            unwantedSelectors.forEach(unwanted => {
              const elements = clonedEl.querySelectorAll(unwanted);
              elements.forEach(el => el.remove());
            });

            mainContent = clonedEl.innerHTML;
          } else {
            // Fallback to original selectors if third row not found
            for (const selector of selectors) {
              const contentEl = document.querySelector(selector);
              if (contentEl) {
                const clonedEl = contentEl.cloneNode(true);
                
                const unwantedSelectors = [
                  '.navigation', '.nav', '.sidebar', '.footer', 
                  '.advertisement', '.ads', '.social-share',
                  '.breadcrumb', '.pagination', '.related-articles'
                ];
                
                unwantedSelectors.forEach(unwanted => {
                  const elements = clonedEl.querySelectorAll(unwanted);
                  elements.forEach(el => el.remove());
                });

                mainContent = clonedEl.innerHTML;
                if (mainContent.trim().length > 100) {
                  break;
                }
              }
            }
          }

          return {
            title: title || document.title,
            content: mainContent,
            publishDate: publishDate || '',
            url: window.location.href
          };
        });

        if (!content.content || content.content.trim().length < 50) {
          throw new Error('Could not extract substantial content from press release');
        }

        return {
          ...release,
          title: content.title || release.title,
          content: cleanHtmlContent(content.content),
          publishDate: content.publishDate || release.dateText,
          scrapedAt: new Date().toISOString()
        };

      } finally {
        await browser.close();
      }
    }, this.config.euronext.retryAttempts, this.config.euronext.retryDelayMs);
  }

  /**
   * Get latest press releases with full content
   */
  async getLatestReleases(limit = 10) {
    try {
      const releases = await this.fetchPressReleaseList();
      const latestReleases = releases.slice(0, limit);
      
      const releasesWithContent = [];
      
      for (const release of latestReleases) {
        try {
          const fullRelease = await this.fetchPressReleaseContent(release);
          releasesWithContent.push(fullRelease);
          
          // Add delay between requests to be respectful
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          this.logger.warn(`Failed to fetch content for ${release.title}:`, error.message);
        }
      }

      this.logger.info(`Successfully scraped ${releasesWithContent.length} press releases`);
      return releasesWithContent;
      
    } catch (error) {
      this.logger.error('Failed to scrape press releases:', error.message);
      throw error;
    }
  }
}