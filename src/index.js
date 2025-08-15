import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { EuronextScraper } from './scraper.js';
import { WebflowClient } from './webflow.js';
import { loadConfig, isWithinScheduledHours, Logger } from './utils.js';

// Load environment variables
dotenv.config();

class PressReleaseAutomation {
  constructor() {
    this.config = null;
    this.logger = null;
    this.scraper = null;
    this.webflow = null;
    this.processedDataPath = path.join(process.cwd(), 'data', 'processed.json');
  }

  async initialize() {
    try {
      // Load configuration
      this.config = await loadConfig();
      this.logger = new Logger(this.config.logging);
      
      // Initialize services
      this.scraper = new EuronextScraper(this.config);
      this.webflow = new WebflowClient(this.config);
      
      this.logger.info('Automation initialized successfully');
    } catch (error) {
      console.error('Failed to initialize automation:', error.message);
      process.exit(1);
    }
  }

  /**
   * Load processed releases data
   */
  async loadProcessedData() {
    try {
      const data = await fs.readFile(this.processedDataPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      this.logger.warn('Could not load processed data, starting fresh');
      return {
        lastProcessed: null,
        processedReleases: [],
        stats: {
          totalProcessed: 0,
          lastRunTime: null,
          errors: []
        }
      };
    }
  }

  /**
   * Save processed releases data
   */
  async saveProcessedData(data) {
    try {
      await fs.writeFile(this.processedDataPath, JSON.stringify(data, null, 2));
      this.logger.debug('Processed data saved successfully');
    } catch (error) {
      this.logger.error('Failed to save processed data:', error.message);
    }
  }

  /**
   * Filter out already processed releases
   */
  filterNewReleases(releases, processedData) {
    const processedIds = new Set(processedData.processedReleases.map(r => r.id));
    return releases.filter(release => !processedIds.has(release.id));
  }

  /**
   * Main execution function
   */
  async run(testMode = false) {
    const startTime = new Date();
    this.logger.info(`Starting press release automation ${testMode ? '(TEST MODE)' : ''}`);

    try {
      // Load processed data
      const processedData = await this.loadProcessedData();

      // Check if within scheduled hours (skip in test mode)
      if (!testMode && !isWithinScheduledHours(this.config)) {
        this.logger.info('Outside scheduled hours, skipping execution');
        return;
      }

      // Test Webflow connection
      const webflowConnected = await this.webflow.testConnection();
      if (!webflowConnected) {
        throw new Error('Failed to connect to Webflow API');
      }

      // Scrape latest releases
      const limit = testMode ? 3 : 10;
      const allReleases = await this.scraper.getLatestReleases(limit);
      
      if (allReleases.length === 0) {
        this.logger.info('No press releases found');
        return;
      }

      // Filter out already processed releases
      const newReleases = this.filterNewReleases(allReleases, processedData);
      
      if (newReleases.length === 0) {
        this.logger.info('No new press releases to process');
        return;
      }

      this.logger.info(`Found ${newReleases.length} new press releases to process`);

      // Create items in Webflow
      this.logger.info(`Attempting to create ${newReleases.length} items in Webflow CMS`);
      const results = await this.webflow.createItems(newReleases);
      
      this.logger.info(`Webflow results: ${results.created.length} created, ${results.skipped.length} skipped, ${results.errors.length} errors`);

      // Update processed data
      const updatedProcessedData = {
        ...processedData,
        lastProcessed: new Date().toISOString(),
        processedReleases: [
          ...processedData.processedReleases,
          ...results.created.map(item => ({
            id: item.release.id,
            title: item.release.title,
            url: item.release.url,
            webflowId: item.webflowItem.id,
            processedAt: new Date().toISOString()
          }))
        ],
        stats: {
          totalProcessed: processedData.stats.totalProcessed + results.created.length,
          lastRunTime: new Date().toISOString(),
          errors: [
            ...processedData.stats.errors.slice(-10), // Keep last 10 errors
            ...results.errors.map(err => ({
              title: err.release.title,
              error: err.error,
              timestamp: new Date().toISOString()
            }))
          ].slice(-10)
        }
      };

      await this.saveProcessedData(updatedProcessedData);

      // Log results
      const duration = (new Date() - startTime) / 1000;
      this.logger.info(`Automation completed in ${duration}s`);
      this.logger.info(`Results: ${results.created.length} created, ${results.skipped.length} skipped, ${results.errors.length} errors`);

      if (results.errors.length > 0) {
        this.logger.warn('Errors occurred during processing:', results.errors);
      }

    } catch (error) {
      this.logger.error('Automation failed:', error.message);
      
      // Save error to processed data
      try {
        const processedData = await this.loadProcessedData();
        processedData.stats.errors.push({
          error: error.message,
          timestamp: new Date().toISOString(),
          fatal: true
        });
        await this.saveProcessedData(processedData);
      } catch (saveError) {
        this.logger.error('Failed to save error data:', saveError.message);
      }
      
      process.exit(1);
    }
  }

  /**
   * Health check function
   */
  async healthCheck() {
    this.logger.info('Running health check');
    
    try {
      // Test Webflow connection
      const webflowConnected = await this.webflow.testConnection();
      if (!webflowConnected) {
        throw new Error('Webflow connection failed');
      }

      // Test scraper (fetch first page only)
      await this.scraper.fetchPressReleaseList();
      
      this.logger.info('Health check passed');
      return true;
    } catch (error) {
      this.logger.error('Health check failed:', error.message);
      return false;
    }
  }
}

// Main execution
async function main() {
  const automation = new PressReleaseAutomation();
  await automation.initialize();

  // Parse command line arguments
  const args = process.argv.slice(2);
  const testMode = args.includes('--test') || process.env.TEST_MODE === 'true';
  const healthCheck = args.includes('--health');

  if (healthCheck) {
    const healthy = await automation.healthCheck();
    process.exit(healthy ? 0 : 1);
  } else {
    await automation.run(testMode);
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run the application
main();