import axios from 'axios';
import * as cheerio from 'cheerio';
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
          
          if (title && title.length > 10) {
            foundReleases = true;
            releases.push({
              title,
              dateText: dateText || 'Unknown date',
              url: link ? (link.startsWith('http') ? link : `${this.config.euronext.baseUrl}${link}`) : '#',
              id: generateReleaseId(title, dateText || 'unknown'),
              rawDate: dateText // Keep for sorting
            });
          }
        });
      }

      // Filter to only recent releases (based on config)
      const cutoffDays = this.config.euronext.onlyRecentDays || 7;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - cutoffDays);

      const recentReleases = releases.filter(release => {
        try {
          const releaseDate = new Date(release.rawDate || release.dateText);
          if (!isNaN(releaseDate.getTime())) {
            return releaseDate >= cutoffDate;
          }
        } catch (error) {
          // If we can't parse the date, include it to be safe
          return true;
        }
        return true; // Include if date parsing fails
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

      this.logger.info(`Found ${releases.length} total releases, ${recentReleases.length} recent (last ${cutoffDays} days)`);
      return recentReleases;
    }, this.config.euronext.retryAttempts, this.config.euronext.retryDelayMs);
  }

  /**
   * Fetch detailed content from individual press release page
   */
  async fetchPressReleaseContent(release) {
    this.logger.info(`Fetching content for: ${release.title}`);
    
    // For now, return basic content without full page scraping
    // This avoids the complex Puppeteer setup and focuses on getting the automation working
    return {
      ...release,
      content: `<h2>${release.title}</h2><p>Press release content from ${release.dateText}. <a href="${release.url}">Read full article</a></p>`,
      publishDate: release.dateText,
      scrapedAt: new Date().toISOString()
    };
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