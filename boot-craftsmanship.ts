/**
 * Boot Craftsmanship Script
 * 
 * This script follows the Working Agreement's Preparation Phase (0):
 * Boot from Craftsmanship Memory by loading the Working Agreement 
 * and related craftsmanship guides from the PostgreSQL database.
 */

import { workingAgreementService } from './server/services/WorkingAgreementService';
import { assetService } from './server/services/AssetService';

async function bootCraftsmanship() {
  try {
    console.log('=== BOOT FROM CRAFTSMANSHIP MEMORY ===');
    
    // Step 1: Load Working Agreement
    console.log('\n1. Loading Working Agreement...');
    const workingAgreementLoaded = await workingAgreementService.loadWorkingAgreement();
    
    if (!workingAgreementLoaded) {
      throw new Error('Failed to load Working Agreement. Cannot proceed.');
    }
    
    // Step 2: Fetch craftsmanship guides
    console.log('\n2. Loading craftsmanship guides...');
    const guides = [
      'Clean-Code-Cheat-Sheet-V1.3.md',
      'Clean-TDD-Cheat-Sheet-V1.2.md',
      'code-quality-metrics-cheatsheet.md',
      'pragmatic-principles-cheat-sheet.v1.md'
    ];
    
    const loadedGuides = [];
    
    for (const guide of guides) {
      const asset = await assetService.getAssetByFilename(guide);
      if (asset) {
        console.log(`✅ Loaded: ${guide}`);
        loadedGuides.push(guide);
      } else {
        console.warn(`⚠️ Not found: ${guide}`);
      }
    }
    
    // Step 3: Output Working Agreement sections for reference
    console.log('\n3. Working Agreement Master Workflow:');
    const masterWorkflow = await workingAgreementService.getMasterWorkflow();
    console.log(masterWorkflow);
    
    console.log('\n4. Agent Behavioral Principles:');
    const principles = await workingAgreementService.getBehavioralPrinciples();
    console.log(principles);
    
    // Final Status
    console.log('\n=== CRAFTSMANSHIP BOOT COMPLETE ===');
    console.log(`Working Agreement: ${workingAgreementLoaded ? '✅ LOADED' : '❌ FAILED'}`);
    console.log(`Craftsmanship Guides: ${loadedGuides.length}/${guides.length} loaded`);
    
    return {
      success: workingAgreementLoaded,
      loadedGuides
    };
  } catch (error) {
    console.error('Failed to boot craftsmanship memory:', error);
    throw error;
  }
}

// Execute the function
bootCraftsmanship()
  .then((result) => {
    if (result.success) {
      console.log('\nReady to work according to Software Craftsmanship principles!');
    } else {
      console.error('\nFailed to boot from craftsmanship memory properly.');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('Boot process failed:', error);
    process.exit(1);
  });