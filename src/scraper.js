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
          let nodeId = '';
          
          for (const titleSel of titleSelectors) {
            const titleEl = $el.find(titleSel).first();
            if (titleEl.length && titleEl.text().trim()) {
              title = titleEl.text().trim();
              link = titleEl.attr('href') || titleEl.find('a').attr('href') || $el.find('a').first().attr('href');
              
              // Extract node ID for modal-based press releases
              const dataNodeNid = titleEl.attr('data-node-nid') || titleEl.find('a').attr('data-node-nid');
              if (dataNodeNid) {
                nodeId = dataNodeNid;
                // Construct proper URL using node ID
                link = `https://live.euronext.com/en/pd_press/${nodeId}`;
              }
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
          
          if (title && title.length > 10) {
            foundReleases = true;
            releases.push({
              title,
              dateText: dateText || 'Unknown date',
              url: link ? (link.startsWith('http') ? link : `${this.config.euronext.baseUrl}${link}`) : '#',
              nodeId: nodeId || null,
              id: generateReleaseId(title, dateText || 'unknown'),
              rawDate: dateText // Keep for sorting
            });
          }
        });
      }

      this.logger.info(`DEBUG: Found ${releases.length} total releases before filtering`);
      if (releases.length > 0) {
        this.logger.info(`DEBUG: First 3 raw releases:`, releases.slice(0, 3).map(r => ({
          title: r.title,
          dateText: r.dateText,
          rawDate: r.rawDate
        })));
      }

      // Filter to only releases after the specified date
      const cutoffDateStr = this.config.euronext.onlyAfterDate || "2025-06-27";
      const cutoffDate = new Date(cutoffDateStr);
      
      this.logger.info(`Using cutoff date: ${cutoffDateStr} (parsed as ${cutoffDate.toISOString().split('T')[0]})`);

      // Log first few releases for debugging
      this.logger.info(`First 5 releases with dates:`, releases.slice(0, 5).map(r => ({
        title: r.title.substring(0, 50),
        dateText: r.dateText,
        rawDate: r.rawDate
      })));

      const recentReleases = releases.filter(release => {
        try {
          let dateStr = release.rawDate || release.dateText;
          
          // Handle Euronext date format: "27 Jun 2025\n07:45 CEST"
          // Extract just the date part before the newline
          if (dateStr.includes('\n')) {
            dateStr = dateStr.split('\n')[0].trim();
          }
          
          // Parse the date
          const releaseDate = new Date(dateStr);
          if (!isNaN(releaseDate.getTime())) {
            const isAfterCutoff = releaseDate >= cutoffDate;
            this.logger.info(`Release "${release.title.substring(0, 40)}" - Date: "${dateStr}" -> ${releaseDate.toISOString().split('T')[0]} - After ${cutoffDateStr}? ${isAfterCutoff}`);
            return isAfterCutoff;
          } else {
            this.logger.warn(`Invalid date for "${release.title.substring(0, 40)}": "${dateStr}" could not be parsed`);
          }
        } catch (error) {
          this.logger.warn(`Error parsing date for "${release.title.substring(0, 40)}": ${release.rawDate} - ${error.message}`);
        }
        return false; // Exclude if date parsing fails
      });

      // Sort releases by date (newest first)
      recentReleases.sort((a, b) => {
        try {
          const dateA = new Date(a.rawDate || a.dateText);
          const dateB = new Date(b.rawDate || b.dateText);
          if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
            return dateB.getTime() - dateA.getTime(); // Newest first
          }
        } catch (error) {
          // Fallback to string comparison if date parsing fails
        }
        return (b.rawDate || b.dateText).localeCompare(a.rawDate || a.dateText);
      });

      this.logger.info(`Found ${releases.length} total releases, ${recentReleases.length} after ${cutoffDateStr}`);
      return recentReleases;
    }, this.config.euronext.retryAttempts, this.config.euronext.retryDelayMs);
  }

  /**
   * Fetch detailed content from press release modal using Puppeteer
   */
  async fetchPressReleaseContent(release) {
    this.logger.info(`Fetching content for: ${release.title}`);
    
    if (!release.nodeId) {
      this.logger.warn(`No node ID for release: ${release.title}`);
      return {
        ...release,
        content: `<h2>${release.title}</h2><p>Press release content from ${release.dateText}. <a href="${release.url}">Read full article</a></p>`,
        publishDate: release.dateText,
        scrapedAt: new Date().toISOString()
      };
    }

    try {
      // Launch Puppeteer browser
      const browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });

      const page = await browser.newPage();
      
      // Set user agent and viewport
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1920, height: 1080 });

      this.logger.info(`Loading Euronext list page to access modal for: ${release.title}`);
      
      // Navigate to the list page first
      await page.goto(this.config.euronext.listUrl, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      // Wait for page to load
      await new Promise(resolve => setTimeout(resolve, 3000));

      this.logger.info(`Clicking on press release: ${release.title} (Node ID: ${release.nodeId})`);

      // Find and click the press release link to open the modal
      const linkSelector = `a[data-node-nid="${release.nodeId}"]`;
      
      try {
        await page.waitForSelector(linkSelector, { timeout: 10000 });
        await page.click(linkSelector);
        
        // Wait for modal to open
        const modalSelector = `#CompanyPressRelease-${release.nodeId}`;
        await page.waitForSelector(modalSelector, { timeout: 10000 });
        
        // Wait a bit more for content to load
        await new Promise(resolve => setTimeout(resolve, 2000));

        this.logger.info(`Modal opened, extracting content for: ${release.title}`);

        // Extract content from the modal
        const content = await page.evaluate((nodeId) => {
          const modal = document.querySelector(`#CompanyPressRelease-${nodeId}`);
          if (!modal) return null;

          // Look for the actual press release content text only
          // This typically contains the main message/content of the press release
          const contentSelectors = [
            '.modal-body .row:nth-child(3) .col-12',  // Often the 3rd row contains main content
            '.modal-body .content-text',
            '.modal-body p',
            '.press-release-body',
            '.news-content',
            '.main-text'
          ];

          let contentText = '';
          
          // First try to find a specific content container
          for (const selector of contentSelectors) {
            const elements = modal.querySelectorAll(selector);
            for (const element of elements) {
              const text = element.textContent?.trim();
              // Look for substantial content (not just metadata)
              if (text && text.length > 50 && !text.includes('ISIN') && !text.includes('Symbol') && !text.includes('Source')) {
                contentText = text;
                break;
              }
            }
            if (contentText) break;
          }

          // If no specific content found, extract all text and filter
          if (!contentText) {
            const modalBody = modal.querySelector('.modal-body');
            if (modalBody) {
              const allText = modalBody.textContent || '';
              const lines = allText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
              
              // Find content lines (skip metadata)
              const contentLines = lines.filter(line => {
                return line.length > 20 &&
                       !line.includes('ISIN') &&
                       !line.includes('Symbol') &&
                       !line.includes('Source') &&
                       !line.includes('Provider') &&
                       !line.includes('Market') &&
                       !line.includes('Company Name') &&
                       !line.includes('Subscribe') &&
                       !line.match(/^\d{2}\s\w{3}\s\d{4}/) && // Date pattern
                       !line.includes('Oslo Børs') &&
                       !line.includes('Euronext');
              });
              
              // Take the main content lines
              if (contentLines.length > 0) {
                contentText = contentLines.join('\n');
              }
            }
          }

          // Wrap in basic HTML structure
          if (contentText) {
            return `<div class="press-release-content">\n  <p>${contentText.replace(/\n/g, '</p>\n  <p>')}</p>\n</div>`;
          }

          return null;
        }, release.nodeId);

        await browser.close();

        if (content) {
          this.logger.info(`Successfully extracted modal content for: ${release.title} (${content.length} characters)`);
          return {
            ...release,
            content: content,
            publishDate: release.dateText,
            scrapedAt: new Date().toISOString()
          };
        } else {
          this.logger.warn(`No modal content found for: ${release.title}`);
        }

      } catch (selectorError) {
        this.logger.warn(`Could not find or click link for ${release.title}: ${selectorError.message}`);
      }

      await browser.close();

      // Fallback to basic content
      return {
        ...release,
        content: `<h2>${release.title}</h2><p>Press release content from ${release.dateText}. <a href="${release.url}">Read full article</a></p>`,
        publishDate: release.dateText,
        scrapedAt: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error(`Failed to fetch modal content for ${release.title}:`, error.message);
      
      // Fallback to basic content
      return {
        ...release,
        content: `<h2>${release.title}</h2><p>Press release content from ${release.dateText}. <a href="${release.url}">Read full article</a></p>`,
        publishDate: release.dateText,
        scrapedAt: new Date().toISOString()
      };
    }
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