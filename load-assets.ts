/**
 * Asset Loader Script
 * 
 * This script loads all assets from the attached_assets directory
 * into the PostgreSQL database for persistent storage and easier access.
 */

import { assetService } from './server/services/AssetService';
import path from 'path';

async function loadAssets() {
  console.log('Starting to load assets into the database...');
  
  try {
    // Path to assets directory
    const assetsDir = path.join(process.cwd(), 'attached_assets');
    
    // Process all assets in the directory
    const assets = await assetService.processDirectory(assetsDir);
    
    console.log(`Successfully loaded ${assets.length} assets into the database`);
    
    // List all the loaded assets
    console.log('\nLoaded assets:');
    assets.forEach(asset => {
      console.log(`- ${asset.filename} (${asset.filetype})`);
    });
    
    console.log('\nProcess completed successfully!');
  } catch (error) {
    console.error('Error loading assets:', error);
  }
}

// Run the script
loadAssets().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});