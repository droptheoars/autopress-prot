import dotenv from 'dotenv';
import { loadConfig } from './src/utils.js';
import { WebflowClient } from './src/webflow.js';

dotenv.config();

async function testConnection() {
  console.log('🔧 Testing Webflow connection...');
  
  try {
    const config = await loadConfig();
    const webflow = new WebflowClient(config);
    
    console.log('📊 Testing API connection...');
    const isConnected = await webflow.testConnection();
    
    if (isConnected) {
      console.log('✅ Webflow connection successful!');
      
      console.log('📋 Getting collection info...');
      const collectionInfo = await webflow.getCollectionInfo();
      console.log('Collection Name:', collectionInfo.displayName);
      console.log('Collection ID:', collectionInfo.id);
      
    } else {
      console.log('❌ Webflow connection failed!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testConnection();