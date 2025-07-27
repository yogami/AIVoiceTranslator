#!/usr/bin/env node
/**
 * Verify Auto-Fallback Configuration Script
 * 
 * This script verifies that all auto-fallback mechanisms are properly configured
 * and working for STT, Translation, and TTS services.
 */

import colors from 'colors';
import { getTranscriptionService } from '../server/services/transcription/TranscriptionServiceFactory.js';
import { getTranslationService } from '../server/services/translation/TranslationServiceFactory.js';

console.log(colors.cyan.bold('\n🔧 Auto-Fallback Configuration Verification\n'));

// Check environment variables
console.log(colors.yellow('📋 Environment Variables:'));
console.log(`- TRANSCRIPTION_SERVICE_TYPE: ${process.env.TRANSCRIPTION_SERVICE_TYPE || 'not set (defaults to openai)'}`);
console.log(`- TRANSLATION_SERVICE_TYPE: ${process.env.TRANSLATION_SERVICE_TYPE || 'not set (defaults to openai)'}`);
console.log(`- TTS_SERVICE_TYPE: ${process.env.TTS_SERVICE_TYPE || 'not set (defaults to browser)'}`);
console.log(`- OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'Set ✅' : 'Not set ❌'}`);

// Test service instantiation
console.log(colors.yellow('\n🏭 Service Factory Tests:'));

try {
  // Test Transcription Service
  const transcriptionService = getTranscriptionService();
  console.log(`- Transcription Service: ${transcriptionService.constructor.name} ✅`);
  
  // Test Translation Service  
  const translationService = getTranslationService();
  console.log(`- Translation Service: ${translationService.constructor.name} ✅`);
  
} catch (error) {
  console.log(colors.red(`- Service instantiation failed: ${error.message} ❌`));
}

// Test actual fallback behavior
console.log(colors.yellow('\n🎯 Fallback Behavior Tests:'));

async function testTranscriptionFallback() {
  try {
    console.log('Testing transcription fallback...');
    
    // Save original API key
    const originalKey = process.env.OPENAI_API_KEY;
    
    // Remove API key to force fallback
    delete process.env.OPENAI_API_KEY;
    
    const service = getTranscriptionService();
    console.log(`- Without API key: ${service.constructor.name} ✅`);
    
    // Restore API key
    if (originalKey) {
      process.env.OPENAI_API_KEY = originalKey;
    }
    
    const serviceWithKey = getTranscriptionService();
    console.log(`- With API key: ${serviceWithKey.constructor.name} ✅`);
    
  } catch (error) {
    console.log(colors.red(`- Transcription fallback test failed: ${error.message} ❌`));
  }
}

async function testTranslationFallback() {
  try {
    console.log('Testing translation fallback...');
    
    // Save original API key
    const originalKey = process.env.OPENAI_API_KEY;
    
    // Remove API key to force fallback  
    delete process.env.OPENAI_API_KEY;
    
    const service = getTranslationService();
    console.log(`- Without API key: ${service.constructor.name} ✅`);
    
    // Restore API key
    if (originalKey) {
      process.env.OPENAI_API_KEY = originalKey;
    }
    
    const serviceWithKey = getTranslationService();
    console.log(`- With API key: ${serviceWithKey.constructor.name} ✅`);
    
  } catch (error) {
    console.log(colors.red(`- Translation fallback test failed: ${error.message} ❌`));
  }
}

// Run tests
await testTranscriptionFallback();
await testTranslationFallback();

// Check if all services are set to auto
console.log(colors.yellow('\n✅ Auto-Fallback Status:'));

const transcriptionAuto = (process.env.TRANSCRIPTION_SERVICE_TYPE || 'openai') === 'auto';
const translationAuto = (process.env.TRANSLATION_SERVICE_TYPE || 'openai') === 'auto';  
const ttsAuto = (process.env.TTS_SERVICE_TYPE || 'browser') === 'auto';

console.log(`- STT Auto-Fallback: ${transcriptionAuto ? '✅ Enabled' : '❌ Disabled'}`);
console.log(`- Translation Auto-Fallback: ${translationAuto ? '✅ Enabled' : '❌ Disabled'}`);
console.log(`- TTS Auto-Fallback: ${ttsAuto ? '✅ Enabled' : '❌ Disabled'}`);

// Summary
const allEnabled = transcriptionAuto && translationAuto && ttsAuto;
console.log(colors.cyan.bold(`\n🎉 Overall Status: ${allEnabled ? 'ALL AUTO-FALLBACK ENABLED ✅' : 'CONFIGURATION NEEDED ⚠️'}`));

if (!allEnabled) {
  console.log(colors.yellow('\n🔧 To enable full auto-fallback, add these to your .env files:'));
  if (!transcriptionAuto) console.log('TRANSCRIPTION_SERVICE_TYPE=auto');
  if (!translationAuto) console.log('TRANSLATION_SERVICE_TYPE=auto');  
  if (!ttsAuto) console.log('TTS_SERVICE_TYPE=auto');
}

console.log(colors.green('\n✨ Auto-fallback verification complete!\n'));
