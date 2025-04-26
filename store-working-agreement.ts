/**
 * Store Working Agreement Script
 * 
 * This script stores the Working Agreement document in the PostgreSQL database
 * for reference by the AI agent during all future requests.
 */

import fs from 'fs/promises';
import path from 'path';
import { assetService } from './server/services/AssetService';

async function storeWorkingAgreement() {
  try {
    console.log('Reading Working Agreement document...');
    const filePath = path.join('attached_assets', 'Working_Agreement.md');
    
    // Read the working agreement content
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Store the working agreement in the database
    const result = await assetService.storeWorkingAgreement(content);
    
    console.log('Working Agreement successfully stored in database!');
    console.log(`Document ID: ${result.id}`);
    console.log(`Filename: ${result.filename}`);
    console.log(`Last updated: ${result.updated_at}`);
    
    return result;
  } catch (error) {
    console.error('Failed to store Working Agreement:', error);
    throw error;
  }
}

// Execute the function
storeWorkingAgreement()
  .then(() => {
    console.log('Process completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Process failed:', error);
    process.exit(1);
  });