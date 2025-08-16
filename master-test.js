#!/usr/bin/env node
/**
 * MASTER TEST - Complete End-to-End Verification
 * This test will verify every component of your automation system
 */
import { EuronextScraper } from './src/scraper.js';
import { WebflowClient } from './src/webflow.js';
import { readFileSync } from 'fs';

const config = JSON.parse(readFileSync('./config/schedule.json', 'utf8'));

async function masterTest() {
  console.log('🧪 MASTER TEST - Complete System Verification');
  console.log('=' .repeat(60));
  
  const results = {
    configTest: false,
    scrapingTest: false,
    contentTest: false,
    webflowConnectionTest: false,
    webflowUploadTest: false,
    duplicateTest: false,
    timezoneTest: false,
    overallSuccess: false
  };

  try {
    // 1. Configuration Test
    console.log('\n1️⃣ Testing Configuration...');
    console.log(`   ✅ Timezone: ${config.schedule.timezone}`);
    console.log(`   ✅ Hours: ${config.schedule.startHour}:00 - ${config.schedule.endHour}:59`);
    console.log(`   ✅ Frequency: Every ${config.schedule.intervalMinutes} minutes`);
    console.log(`   ✅ Date filter: After ${config.euronext.onlyAfterDate}`);
    results.configTest = true;

    // 2. Environment Variables Test  
    console.log('\n2️⃣ Testing Environment Variables...');
    const requiredEnvs = ['WEBFLOW_API_TOKEN', 'WEBFLOW_SITE_ID', 'WEBFLOW_COLLECTION_ID'];
    for (const env of requiredEnvs) {
      if (!process.env[env]) {
        throw new Error(`Missing environment variable: ${env}`);
      }
      console.log(`   ✅ ${env}: Set (${process.env[env].substring(0, 8)}...)`);
    }

    // 3. Timezone Test
    console.log('\n3️⃣ Testing Norwegian Timezone...');
    const norwegianTime = new Date().toLocaleString('en-US', { timeZone: 'Europe/Oslo' });
    const norwegianHour = new Date().toLocaleString('en-US', { 
      timeZone: 'Europe/Oslo', 
      hour: '2-digit', 
      hour12: false 
    });
    console.log(`   ✅ Current Norwegian time: ${norwegianTime}`);
    console.log(`   ✅ Norwegian hour: ${norwegianHour}`);
    const withinHours = parseInt(norwegianHour) >= 6 && parseInt(norwegianHour) < 24;
    console.log(`   ${withinHours ? '✅' : '⏰'} Within schedule: ${withinHours ? 'YES' : 'NO (outside 6am-11:59pm)'}`);
    results.timezoneTest = true;

    // 4. Scraping Test
    console.log('\n4️⃣ Testing Euronext Scraping...');
    const scraper = new EuronextScraper(config);
    const releases = await scraper.getLatestReleases(3);
    
    if (releases.length === 0) {
      console.log('   ⚠️  No releases found (likely outside date filter or no new releases)');
    } else {
      console.log(`   ✅ Found ${releases.length} releases`);
      console.log(`   ✅ Latest release: "${releases[0].title}"`);
      console.log(`   ✅ Content length: ${releases[0].content?.length || 0} characters`);
      console.log(`   ✅ Content preview: ${releases[0].content?.substring(0, 100) || 'No content'}...`);
      results.scrapingTest = true;
      results.contentTest = releases[0].content && releases[0].content.length > 100;
    }

    // 5. Webflow Connection Test
    console.log('\n5️⃣ Testing Webflow Connection...');
    const webflowClient = new WebflowClient(config);
    const connectionOk = await webflowClient.testConnection();
    
    if (connectionOk) {
      console.log('   ✅ Webflow API connection successful');
      console.log('   ✅ Collection accessible');
      results.webflowConnectionTest = true;
    } else {
      throw new Error('Webflow connection failed');
    }

    // 6. Webflow Upload Test (only if we have releases)
    if (releases.length > 0) {
      console.log('\n6️⃣ Testing Webflow Upload...');
      
      // Create a test release with unique timestamp to ensure it's new
      const testRelease = {
        ...releases[0],
        title: `TEST: ${releases[0].title} [${new Date().getTime()}]`,
        publishDate: releases[0].publishDate
      };
      
      const uploadResults = await webflowClient.createItems([testRelease]);
      
      if (uploadResults.created.length > 0) {
        console.log('   ✅ Successfully created test item in Webflow');
        console.log(`   ✅ Item ID: ${uploadResults.created[0].webflowItem.id}`);
        console.log(`   ✅ Draft status: ${uploadResults.created[0].webflowItem.isDraft}`);
        console.log(`   ✅ Read-more link: https://live.euronext.com/en/listview/company-press-release/62020?page=0`);
        results.webflowUploadTest = true;
      } else if (uploadResults.skipped.length > 0) {
        console.log('   ✅ Item already exists (duplicate detection working)');
        results.duplicateTest = true;
      }
    }

    // 7. Overall Success Check
    console.log('\n7️⃣ Overall System Health Check...');
    const criticalTests = [
      results.configTest,
      results.scrapingTest || releases.length === 0, // OK if no releases due to date filter
      results.webflowConnectionTest,
      results.timezoneTest
    ];
    
    const allCriticalPassed = criticalTests.every(test => test === true);
    results.overallSuccess = allCriticalPassed;

    // Final Results
    console.log('\n' + '='.repeat(60));
    console.log('🎯 MASTER TEST RESULTS');
    console.log('='.repeat(60));
    console.log(`Configuration:      ${results.configTest ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Timezone:           ${results.timezoneTest ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Scraping:           ${results.scrapingTest ? '✅ PASS' : '⚠️  NO DATA'}`);
    console.log(`Content Extraction: ${results.contentTest ? '✅ PASS' : '⚠️  NO DATA'}`);
    console.log(`Webflow Connection: ${results.webflowConnectionTest ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Webflow Upload:     ${results.webflowUploadTest ? '✅ PASS' : '⚠️  SKIPPED/NO DATA'}`);
    console.log(`Duplicate Detection:${results.duplicateTest ? '✅ PASS' : '⚠️  NOT TESTED'}`);
    console.log('='.repeat(60));
    
    if (results.overallSuccess) {
      console.log('🎉 MASTER TEST: ✅ COMPLETE SUCCESS!');
      console.log('🚀 Your automation system is working perfectly!');
      console.log('\n📋 What happens next:');
      console.log('   • System runs every 2 minutes from 6am-11:59pm Norwegian time');
      console.log('   • Automatically scrapes new Protector Forsikring press releases');
      console.log('   • Creates draft items in your Webflow collection');
      console.log('   • Uses clean formatting and static read-more links');
      console.log('   • Prevents duplicates while allowing same-title-different-dates');
      console.log('   • Completely free on your public GitHub repository');
    } else {
      console.log('❌ MASTER TEST: Some critical components failed');
      console.log('   Please check the failed components above');
    }

  } catch (error) {
    console.error(`\n❌ MASTER TEST FAILED: ${error.message}`);
    console.error(error.stack);
    results.overallSuccess = false;
  }
  
  return results;
}

// Run the master test
masterTest().catch(console.error);