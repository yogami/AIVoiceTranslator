/**
 * Mock Translation Orchestrator for Integration Tests
 * 
 * This provides a complete mock implementation that replaces the real TranslationOrchestrator
 * to avoid external API calls during integration testing.
 * 
 * Features:
 * - No external API calls (OpenAI, etc.)
 * - Deterministic responses for reliable testing
 * - Configurable failure scenarios
 * - Performance metrics simulation
 * - Full interface compatibility
 */

export class MockTranslationOrchestrator {
  private storage: any;
  private shouldSimulateFailure: boolean = false;
  private latencySimulation: { min: number; max: number } = { min: 10, max: 50 };
  private callCounts: { [method: string]: number } = {};

  constructor(storage?: any) {
    this.storage = storage;
  }

  // Test configuration methods
  setFailureMode(enabled: boolean): void {
    this.shouldSimulateFailure = enabled;
    console.log(`🎯 MockTranslationOrchestrator: Failure mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  setLatencyRange(min: number, max: number): void {
    this.latencySimulation = { min, max };
  }

  getCallCount(method: string): number {
    return this.callCounts[method] || 0;
  }

  getAllCallCounts(): { [method: string]: number } {
    return { ...this.callCounts };
  }

  private recordCall(method: string): void {
    this.callCounts[method] = (this.callCounts[method] || 0) + 1;
  }

  private simulateLatency(): number {
    const { min, max } = this.latencySimulation;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Mock implementation of translateToMultipleLanguages
   */
  async translateToMultipleLanguages(request: any): Promise<any> {
    this.recordCall('translateToMultipleLanguages');
    
    const { text, sourceLanguage, targetLanguages, startTime, latencyTracking } = request;
    
    console.log('🎯 MockTranslationOrchestrator.translateToMultipleLanguages called with:', {
      text: text.substring(0, 50),
      sourceLanguage,
      targetLanguagesCount: targetLanguages.length,
      targetLanguages,
      callCount: this.getCallCount('translateToMultipleLanguages')
    });

    // Simulate failure if configured
    if (this.shouldSimulateFailure) {
      console.log('🎯 MockTranslationOrchestrator: Simulating translation failure');
      throw new Error('Mock translation failure for testing');
    }

    // Simulate realistic processing delay
    const processingDelay = this.simulateLatency();
    await new Promise(resolve => setTimeout(resolve, processingDelay));
    
    // Create a simple translation map
    const translations = new Map<string, string>();
    const translationResults = targetLanguages.map((language: string) => {
      // Create a fake translation by adding language prefix
      const translation = `[MOCK-${language}] ${text}`;
      translations.set(language, translation);
      return { 
        language, 
        translation,
        originalText: text
      };
    });

    // Add some mock latency tracking data with simulated values
    const latencyInfo = {
      preparation: this.simulateLatency(),
      translation: processingDelay,
      tts: this.simulateLatency(),
      processing: this.simulateLatency()
    };

    // Update the provided latencyTracking object to match mock values
    if (latencyTracking && latencyTracking.components) {
      latencyTracking.components.preparation = latencyInfo.preparation;
      latencyTracking.components.translation = latencyInfo.translation;
      latencyTracking.components.tts = latencyInfo.tts;
      latencyTracking.components.processing = latencyInfo.processing;
    }

    console.log('🎯 MockTranslationOrchestrator returning:', {
      translationsCount: translations.size,
      translationResultsCount: translationResults.length,
      totalLatency: processingDelay
    });

    return {
      translations,
      translationResults,
      latencyInfo
    };
  }

  /**
   * Mock implementation of sendTranslationsToStudents
   */
  sendTranslationsToStudents(options: any): void {
    this.recordCall('sendTranslationsToStudents');
    
    console.log('🎯 MockTranslationOrchestrator.sendTranslationsToStudents called with:', {
      studentConnectionsCount: options.studentConnections?.length || 0,
      originalText: options.originalText?.substring(0, 50) || 'N/A',
      sourceLanguage: options.sourceLanguage,
      translationsCount: options.translations?.size || 0,
      callCount: this.getCallCount('sendTranslationsToStudents')
    });

    const { 
      studentConnections, 
      translations,
      originalText,
      sourceLanguage,
      getLanguage,
      getSessionId,
      getClientSettings,
      storage,
      startTime,
      latencyTracking
    } = options;

    // Simulate failure if configured
    if (this.shouldSimulateFailure) {
      console.log('🎯 MockTranslationOrchestrator: Simulating sendTranslations failure');
      throw new Error('Mock sendTranslations failure for testing');
    }

    // Calculate total latency for the mock
    const serverCompleteTime = Date.now();
    const totalLatency = serverCompleteTime - startTime;

    // Send translations directly to each student connection
    studentConnections.forEach((ws: any, index: number) => {
      const studentLanguage = getLanguage(ws);
      const clientSettings = getClientSettings?.(ws) || {};
      
      if (!studentLanguage) {
        console.log(`🎯 MockTranslationOrchestrator: Student ${index} has no language set`);
        return;
      }
      
      const sessionId = getSessionId?.(ws) || 'unknown';
      const translation = translations.get(studentLanguage) || `[MOCK-${studentLanguage}] ${originalText}`;

      // Create translation message with all required fields
      const translationMessage = {
        type: 'translation',
        text: translation,
        originalText,
        sourceLanguage,
        targetLanguage: studentLanguage,
        ttsServiceType: clientSettings.ttsServiceType || 'openai',
        audioData: '', // No audio in mocks
        useClientSpeech: clientSettings.useClientSpeech === true,
        latency: {
          total: totalLatency,
          serverCompleteTime: serverCompleteTime,
          components: latencyTracking?.components || {
            preparation: this.simulateLatency(),
            translation: this.simulateLatency(),
            tts: this.simulateLatency(),
            processing: this.simulateLatency()
          }
        }
      };
      
      // Send a mock translation message directly
      console.log(`🎯 MockTranslationOrchestrator: Sending translation message to student ${index} (${studentLanguage})`, {
        messageType: translationMessage.type,
        hasText: !!translationMessage.text,
        textPreview: translation.substring(0, 50)
      });
      
      try {
        ws.send(JSON.stringify(translationMessage));
        console.log(`🎯 MockTranslationOrchestrator: ✅ Successfully sent to student ${index}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`🎯 MockTranslationOrchestrator: ❌ Failed to send to student ${index}:`, errorMessage);
      }

      // Mock the database storage call if storage is provided
      if (storage && process.env.ENABLE_DETAILED_TRANSLATION_LOGGING === 'true') {
        // Explicitly use setTimeout to simulate async behavior but not block the current function
        setTimeout(async () => {
          try {
            console.log(`🎯 MockTranslationOrchestrator: Storing translation for student ${index} in database`);
            await storage.addTranslation({
              sessionId,
              sourceLanguage,
              targetLanguage: studentLanguage,
              originalText,
              translatedText: translation,
              latency: latencyTracking?.components?.translation || this.simulateLatency()
            });
            console.log(`🎯 MockTranslationOrchestrator: ✅ Translation stored successfully for student ${index}`);
          } catch (error) {
            console.error(`🎯 MockTranslationOrchestrator: ❌ Error storing translation for student ${index}:`, error);
          }
        }, 0);
      }
    });
    
    console.log('🎯 MockTranslationOrchestrator.sendTranslationsToStudents completed');
  }

  /**
   * Mock implementation of generateTTSAudio
   */
  async generateTTSAudio(
    text: string,
    languageCode: string,
    ttsServiceType: string = 'openai',
    voice?: string
  ): Promise<Buffer> {
    this.recordCall('generateTTSAudio');
    
    console.log('🎯 MockTranslationOrchestrator.generateTTSAudio called (mocked)', { 
      textLength: text.length, 
      languageCode, 
      ttsServiceType,
      callCount: this.getCallCount('generateTTSAudio')
    });

    // Simulate failure if configured
    if (this.shouldSimulateFailure) {
      console.log('🎯 MockTranslationOrchestrator: Simulating TTS failure');
      throw new Error('Mock TTS failure for testing');
    }

    // Simulate realistic processing delay for TTS
    const processingDelay = this.simulateLatency();
    await new Promise(resolve => setTimeout(resolve, processingDelay));
    
    // Return a mock audio buffer with some content (simulating MP3 audio data)
    const mockAudioData = `[MOCK-TTS-${languageCode}] ${text}`;
    console.log(`🎯 MockTranslationOrchestrator: ✅ Generated mock TTS audio (${processingDelay}ms)`);
    return Buffer.from(mockAudioData);
  }

  /**
   * Mock implementation of validateTTSRequest
   */
  validateTTSRequest(text: string, languageCode: string): boolean {
    this.recordCall('validateTTSRequest');
    
    console.log('🎯 MockTranslationOrchestrator.validateTTSRequest called (mocked)', {
      textLength: text.length,
      languageCode,
      callCount: this.getCallCount('validateTTSRequest')
    });

    // Simulate failure if configured
    if (this.shouldSimulateFailure) {
      console.log('🎯 MockTranslationOrchestrator: Simulating validation failure');
      return false;
    }

    // Simple validation logic for testing
    const isValid = !!(text && text.trim().length > 0 && languageCode && languageCode.length > 0);
    console.log(`🎯 MockTranslationOrchestrator: Validation result: ${isValid}`);
    return isValid;
  }

  /**
   * Reset mock state for clean test runs
   */
  reset(): void {
    this.callCounts = {};
    this.shouldSimulateFailure = false;
    this.latencySimulation = { min: 10, max: 50 };
    console.log('🎯 MockTranslationOrchestrator: Reset to clean state');
  }
}
