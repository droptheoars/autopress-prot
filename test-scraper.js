#!/usr/bin/env node
import { EuronextScraper } from './src/scraper.js';
import { WebflowClient } from './src/webflow.js';
import { readFileSync } from 'fs';

// Load configuration
const config = JSON.parse(readFileSync('./config/schedule.json', 'utf8'));

async function testScraper() {
  console.log('🚀 Starting test scraper...');
  
  try {
    // Initialize scraper
    const scraper = new EuronextScraper(config);
    console.log('✅ Scraper initialized');

    // Get latest releases (just 3 for testing)
    console.log('📡 Fetching latest releases...');
    const releases = await scraper.getLatestReleases(3);
    
    if (releases.length === 0) {
      console.log('❌ No releases found (likely outside date range or no new releases)');
      return;
    }

    console.log(`✅ Found ${releases.length} release(s)`);
    releases.forEach((release, index) => {
      console.log(`📄 Release ${index + 1}:`, {
        title: release.title,
        date: release.publishDate,
        url: release.url,
        contentLength: release.content ? release.content.length : 0,
        contentPreview: release.content ? release.content.substring(0, 200) + '...' : 'No content'
      });
    });

    // Test Webflow upload if environment variables are set
    if (process.env.WEBFLOW_API_TOKEN && process.env.WEBFLOW_SITE_ID && process.env.WEBFLOW_COLLECTION_ID) {
      console.log('🌐 Testing Webflow upload...');
      
      const webflowClient = new WebflowClient(config);
      
      // Test connection first
      const connectionOk = await webflowClient.testConnection();
      if (!connectionOk) {
        console.log('❌ Webflow connection failed');
        return;
      }
      
      console.log('✅ Webflow connection successful');
      
      // Create the item
      const results = await webflowClient.createItems(releases);
      
      console.log('📊 Results:', {
        created: results.created.length,
        skipped: results.skipped.length,
        errors: results.errors.length
      });
      
      if (results.created.length > 0) {
        console.log('🎉 Successfully created draft item in Webflow!');
        console.log('Draft item ID:', results.created[0].webflowItem.id);
      }
      
    } else {
      console.log('⚠️  Skipping Webflow upload (missing environment variables)');
      console.log('💡 Set WEBFLOW_API_TOKEN, WEBFLOW_SITE_ID, and WEBFLOW_COLLECTION_ID to test upload');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testScraper();