import axios from 'axios';
import { retry, Logger } from './utils.js';

export class WebflowClient {
  constructor(config) {
    this.config = config;
    this.logger = new Logger(config.logging);
    this.apiToken = process.env.WEBFLOW_API_TOKEN;
    this.siteId = process.env.WEBFLOW_SITE_ID;
    this.collectionId = process.env.WEBFLOW_COLLECTION_ID;

    if (!this.apiToken || !this.siteId || !this.collectionId) {
      throw new Error('Missing required Webflow environment variables: WEBFLOW_API_TOKEN, WEBFLOW_SITE_ID, WEBFLOW_COLLECTION_ID');
    }

    this.baseUrl = 'https://api.webflow.com/v2';
    this.headers = {
      'Authorization': `Bearer ${this.apiToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  /**
   * Create a new item in Webflow CMS
   */
  async createItem(pressRelease) {
    this.logger.info(`Creating Webflow item for: ${pressRelease.title}`);

    return retry(async () => {
      const itemData = {
        isArchived: false,
        isDraft: !this.config.webflow.publishImmediately,
        fieldData: {
          'name': pressRelease.title,
          'slug': this.generateSlug(pressRelease.title),
          'date-2': this.formatDate(pressRelease.publishDate),
          'pm-body-html': pressRelease.content,
          'read-more-link': pressRelease.url
        }
      };

      this.logger.info(`Creating item with data:`, {
        isDraft: itemData.isDraft,
        title: itemData.fieldData.name,
        date: itemData.fieldData.date
      });

      const response = await axios.post(
        `${this.baseUrl}/collections/${this.collectionId}/items`,
        itemData,
        { 
          headers: this.headers,
          timeout: 30000
        }
      );

      const createdItem = response.data;
      this.logger.info(`Successfully created Webflow item:`, {
        id: createdItem.id,
        isDraft: createdItem.isDraft,
        status: 'created'
      });

      // Publish immediately if configured to do so
      if (this.config.webflow.publishImmediately && createdItem.id) {
        await this.publishItem(createdItem.id);
      }

      return createdItem;
    }, this.config.webflow.retryAttempts, this.config.webflow.retryDelayMs);
  }

  /**
   * Publish a specific item
   */
  async publishItem(itemId) {
    this.logger.info(`Publishing item: ${itemId}`);

    return retry(async () => {
      const response = await axios.post(
        `${this.baseUrl}/collections/${this.collectionId}/items/${itemId}/publish`,
        {},
        { 
          headers: this.headers,
          timeout: 30000
        }
      );

      this.logger.info(`Successfully published item: ${itemId}`);
      return response.data;
    }, this.config.webflow.retryAttempts, this.config.webflow.retryDelayMs);
  }

  /**
   * Check if an item already exists by title (since we don't have a unique ID field)
   */
  async itemExists(pressReleaseId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/collections/${this.collectionId}/items`,
        {
          headers: this.headers,
          timeout: 30000
        }
      );

      // Check if any item has the same slug (which is generated from title)
      const slug = this.generateSlug(pressReleaseId);
      const existingItem = response.data.items?.find(item => 
        item.fieldData?.slug === slug
      );

      return !!existingItem;
    } catch (error) {
      this.logger.warn(`Error checking if item exists: ${error.message}`);
      return false;
    }
  }

  /**
   * Get collection info to verify configuration
   */
  async getCollectionInfo() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/collections/${this.collectionId}`,
        {
          headers: this.headers,
          timeout: 30000
        }
      );

      this.logger.info('Webflow collection info retrieved successfully');
      return response.data;
    } catch (error) {
      this.logger.error('Failed to get collection info:', error.message);
      throw error;
    }
  }

  /**
   * Test connection to Webflow API
   */
  async testConnection() {
    try {
      const collectionInfo = await this.getCollectionInfo();
      this.logger.info('Webflow connection test successful');
      this.logger.info('Available fields in collection:', collectionInfo.fields?.map(f => f.slug) || 'No fields info');
      return true;
    } catch (error) {
      this.logger.error('Webflow connection test failed:', error.message);
      return false;
    }
  }

  /**
   * Format date for Webflow
   */
  formatDate(dateString) {
    try {
      if (!dateString) return new Date().toISOString();
      
      // Try to parse the date string
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        // If parsing fails, try to extract date from common formats
        const dateMatch = dateString.match(/(\\d{1,2})\\s+(\\w{3})\\s+(\\d{4})/);
        if (dateMatch) {
          const [, day, month, year] = dateMatch;
          const monthMap = {
            'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
            'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
            'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
          };
          const isoDate = `${year}-${monthMap[month]}-${day.padStart(2, '0')}T12:00:00.000Z`;
          return isoDate;
        }
        return new Date().toISOString();
      }
      
      return date.toISOString();
    } catch (error) {
      this.logger.warn(`Date formatting error: ${error.message}`);
      return new Date().toISOString();
    }
  }

  /**
   * Generate URL-friendly slug
   */
  generateSlug(title) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\\s-]/g, '')
      .replace(/\\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-')
      .substring(0, 100);
  }

  /**
   * Bulk create items with duplicate checking
   */
  async createItems(pressReleases) {
    const results = {
      created: [],
      skipped: [],
      errors: []
    };

    for (const release of pressReleases) {
      try {
        this.logger.info(`Processing release: ${release.title} (ID: ${release.id})`);
        
        // Check if item already exists
        const exists = await this.itemExists(release.id);
        if (exists) {
          this.logger.info(`Skipping existing item: ${release.title}`);
          results.skipped.push(release);
          continue;
        }

        // Create new item
        const createdItem = await this.createItem(release);
        results.created.push({
          release,
          webflowItem: createdItem
        });

        // Add delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        this.logger.error(`Failed to create item for ${release.title}:`, error.message);
        this.logger.error(`Error details:`, error.response?.data || error.stack);
        results.errors.push({
          release,
          error: error.message
        });
      }
    }

    this.logger.info(`Bulk creation results: ${results.created.length} created, ${results.skipped.length} skipped, ${results.errors.length} errors`);
    return results;
  }
}