/**
 * 🚨 STUDENT AUDIO BUG FIX TEST
 * Tests the end-to-end audio pipeline with OpenAI translation to bypass MyMemory rate limits
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpeechPipelineOrchestrator } from '../../server/application/services/SpeechPipelineOrchestrator';

describe('🎵 AUDIO BUG FIX: End-to-End Pipeline with OpenAI', () => {
  let speechOrchestrator: SpeechPipelineOrchestrator;

  beforeEach(async () => {
    // Create orchestrator with OpenAI translation specifically
    speechOrchestrator = new SpeechPipelineOrchestrator({
      sttTier: 'auto',           // Keep STT as auto (Whisper works)  
      translationTier: 'premium', // Force OpenAI translation to bypass MyMemory rate limits
      ttsTier: 'auto'            // Keep TTS as auto (Local TTS works)
    });
  });

  it('🎵 CRITICAL FIX: Complete pipeline should work with OpenAI translation', async () => {
    console.log('🚨 [FIX TEST] Testing complete pipeline with OpenAI translation...');
    
    try {
      // Test the complete pipeline
      const testAudioBuffer = Buffer.alloc(1024, 'test audio');
      const result = await speechOrchestrator.processAudioPipeline(
        testAudioBuffer,
        'en-US',
        'es-ES'
      );

      console.log('🔄 Pipeline Result:', {
        hasTranscription: !!result.transcription,
        transcriptionLength: result.transcription?.length || 0,
        hasTranslation: !!result.translation,
        translationLength: result.translation?.length || 0,
        hasAudioResult: !!result.audioResult,
        audioBufferLength: result.audioResult?.audioBuffer?.length || 0,
        ttsServiceType: result.audioResult?.ttsServiceType,
        servicesUsed: result.metrics.servicesUsed
      });

      // CRITICAL ASSERTIONS FOR AUDIO BUG FIX
      expect(result.transcription).toBeDefined();
      expect(result.transcription.length).toBeGreaterThan(0);
      
      expect(result.translation).toBeDefined();
      expect(result.translation.length).toBeGreaterThan(0);
      
      expect(result.audioResult).toBeDefined();
      expect(result.audioResult.audioBuffer).toBeDefined();
      expect(result.audioResult.audioBuffer.length).toBeGreaterThan(0);
      expect(result.audioResult.ttsServiceType).toBeDefined();
      expect(result.audioResult.error).toBeUndefined();

      // Test base64 encoding (what student receives)
      const base64Audio = result.audioResult.audioBuffer.toString('base64');
      expect(base64Audio.length).toBeGreaterThan(0);

      console.log('✅ [FIX TEST] Complete pipeline working with OpenAI translation!');
    } catch (error) {
      console.error('🚨 Pipeline Failed:', error);
      throw error;
    }
  }, 30000);

  it('🎵 VERIFY: Direct OpenAI translation should work', async () => {
    console.log('🚨 [VERIFY] Testing OpenAI translation directly...');
    
    try {
      const translation = await speechOrchestrator.translateText('Hello world', 'en', 'es');
      
      console.log('🌍 OpenAI Translation Result:', {
        original: 'Hello world',
        translated: translation,
        length: translation.length
      });

      expect(translation).toBeDefined();
      expect(typeof translation).toBe('string');
      expect(translation.length).toBeGreaterThan(0);
      expect(translation.toLowerCase()).toContain('hola'); // Should contain Spanish greeting
      
      console.log('✅ [VERIFY] OpenAI translation working!');
    } catch (error) {
      console.error('🚨 OpenAI Translation Failed:', error);
      throw error;
    }
  }, 15000);
});
