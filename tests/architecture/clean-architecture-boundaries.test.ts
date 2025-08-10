/**
 * Clean Architecture Boundary Tests
 * 
 * These tests enforce clean architecture principles by checking that:
 * 1. WebSocket layer doesn't import domain services
 * 2. Handlers only delegate to orchestrators  
 * 3. Business logic stays in domain layer
 * 4. Proper separation of concerns is maintained
 * 
 * PURPOSE: Prevent architectural violations during refactoring
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Clean Architecture Boundary Tests', () => {
  const websocketDir = path.join(__dirname, '../../server/services/websocket');
  const domainDirs = [
    path.join(__dirname, '../../server/services/translation'),
    path.join(__dirname, '../../server/services/transcription'), 
    path.join(__dirname, '../../server/services/tts'),
    path.join(__dirname, '../../server/services/stt')
  ];

  describe('WebSocket Layer Import Restrictions', () => {
    it('should not import TTS services directly in WebSocket handlers', () => {
      const handlerFiles = getWebSocketHandlerFiles();
      
      handlerFiles.forEach(filePath => {
        const content = fs.readFileSync(filePath, 'utf8');
        const fileName = path.basename(filePath);
        
        // Check for direct TTS service imports
        const forbiddenImports = [
          'textToSpeechService',
          'TextToSpeechService', 
          'ttsFactory',
          'openai',
          'elevenlabs',
          'azure-cognitiveservices-speech'
        ];
        
        forbiddenImports.forEach(forbiddenImport => {
          expect(content).not.toMatch(
            new RegExp(`import.*${forbiddenImport}`, 'i'),
            `${fileName} should not directly import ${forbiddenImport}. Use SpeechPipelineOrchestrator instead.`
          );
        });
      });
    });

    it('should not import transcription services directly in WebSocket handlers', () => {
      const handlerFiles = getWebSocketHandlerFiles();
      
      handlerFiles.forEach(filePath => {
        const content = fs.readFileSync(filePath, 'utf8');
        const fileName = path.basename(filePath);
        
        // Check for direct transcription service imports
        const forbiddenImports = [
          'audioTranscriptionService',
          'AudioTranscriptionService',
          'speechTranslationService',
          'TranslationBusinessService'
        ];
        
        forbiddenImports.forEach(forbiddenImport => {
          expect(content).not.toMatch(
            new RegExp(`import.*${forbiddenImport}`, 'i'),
            `${fileName} should not directly import ${forbiddenImport}. Use SpeechPipelineOrchestrator instead.`
          );
        });
      });
    });

    it('should not import audio processing services directly in WebSocket handlers', () => {
      const handlerFiles = getWebSocketHandlerFiles();
      
      handlerFiles.forEach(filePath => {
        const content = fs.readFileSync(filePath, 'utf8');
        const fileName = path.basename(filePath);
        
        // Check for direct audio processing imports
        const forbiddenImports = [
          'AudioEncodingService',
          'ffmpeg',
          'wav',
          'audio-buffer'
        ];
        
        forbiddenImports.forEach(forbiddenImport => {
          expect(content).not.toMatch(
            new RegExp(`import.*${forbiddenImport}`, 'i'),
            `${fileName} should not directly import ${forbiddenImport}. Use SpeechPipelineOrchestrator instead.`
          );
        });
      });
    });

    it('should only import allowed WebSocket infrastructure', () => {
      const handlerFiles = getWebSocketHandlerFiles();
      
      handlerFiles.forEach(filePath => {
        const content = fs.readFileSync(filePath, 'utf8');
        const fileName = path.basename(filePath);
        
        // Allowed imports for WebSocket handlers
        const allowedImports = [
          'logger',
          'config',
          'MessageHandler',
          'MessageHandlerContext',
          'IMessageHandler',
          'ConnectionManager',
          'WebSocketClient',
          'WebSocketTypes',
          '../WebSocketTypes'
        ];
        
        // Extract import statements
        const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
        let match;
        
        while ((match = importRegex.exec(content)) !== null) {
          const importPath = match[1];
          
          // Skip relative imports within websocket directory
          if (importPath.startsWith('./') || importPath.startsWith('../websocket/')) {
            continue;
          }
          
          // Skip Node.js built-in modules
          if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
            continue;
          }
          
          // Check if import is allowed
          const isAllowed = allowedImports.some(allowed => 
            importPath.includes(allowed) || importPath.endsWith(allowed)
          );
          
          if (!isAllowed && !importPath.includes('websocket')) {
            console.warn(`${fileName} imports ${importPath} - verify this is allowed`);
          }
        }
      });
    });
  });

  describe('Business Logic Restrictions', () => {
    it('should not contain audio processing logic in WebSocket handlers', () => {
      const handlerFiles = getWebSocketHandlerFiles();
      
      handlerFiles.forEach(filePath => {
        const content = fs.readFileSync(filePath, 'utf8');
        const fileName = path.basename(filePath);
        
        // Check for audio processing business logic
        const forbiddenPatterns = [
          /Buffer\.from.*audio/i,
          /audioBuffer\.length/i,
          /base64.*audio/i,
          /wav|mp3|flac|ogg/i,
          /sampleRate|bitRate/i,
          /ffmpeg/i
        ];
        
        forbiddenPatterns.forEach(pattern => {
          expect(content).not.toMatch(
            pattern,
            `${fileName} contains audio processing logic. Move to domain layer.`
          );
        });
      });
    });

    it('should not contain TTS generation logic in WebSocket handlers', () => {
      const handlerFiles = getWebSocketHandlerFiles();
      
      handlerFiles.forEach(filePath => {
        const content = fs.readFileSync(filePath, 'utf8');
        const fileName = path.basename(filePath);
        
        // Check for TTS business logic
        const forbiddenPatterns = [
          /generateTTSAudio/i,
          /textToSpeech/i,
          /voice.*synthesis/i,
          /speech.*synthesis/i,
          /ssml/i
        ];
        
        forbiddenPatterns.forEach(pattern => {
          expect(content).not.toMatch(
            pattern,
            `${fileName} contains TTS generation logic. Move to domain layer.`
          );
        });
      });
    });

    it('should not contain translation logic in WebSocket handlers', () => {
      const handlerFiles = getWebSocketHandlerFiles();
      
      handlerFiles.forEach(filePath => {
        const content = fs.readFileSync(filePath, 'utf8');
        const fileName = path.basename(filePath);
        
        // Check for translation business logic
        const forbiddenPatterns = [
          /translateToMultipleLanguages/i,
          /translation.*api/i,
          /openai.*translate/i,
          /google.*translate/i
        ];
        
        forbiddenPatterns.forEach(pattern => {
          expect(content).not.toMatch(
            pattern,
            `${fileName} contains translation logic. Move to domain layer.`
          );
        });
      });
    });
  });

  describe('Handler Structure Requirements', () => {
    it('should only contain transport layer concerns in WebSocket handlers', () => {
      const handlerFiles = getWebSocketHandlerFiles();
      
      handlerFiles.forEach(filePath => {
        const content = fs.readFileSync(filePath, 'utf8');
        const fileName = path.basename(filePath);
        
        // Required WebSocket handler structure
        expect(content).toMatch(
          /implements\s+IMessageHandler/,
          `${fileName} should implement IMessageHandler interface`
        );
        
        expect(content).toMatch(
          /getMessageType\(\)/,
          `${fileName} should have getMessageType method`
        );
        
        expect(content).toMatch(
          /handle\(.*message.*context.*\)/,
          `${fileName} should have handle method with message and context parameters`
        );
      });
    });

    it('should delegate to orchestrator in domain-related handlers', () => {
      const domainHandlerFiles = [
        'TTSRequestMessageHandler.ts',
        'TranscriptionMessageHandler.ts', 
        'AudioMessageHandler.ts'
      ].map(file => path.join(websocketDir, file)).filter(fs.existsSync);
      
      domainHandlerFiles.forEach(filePath => {
        const content = fs.readFileSync(filePath, 'utf8');
        const fileName = path.basename(filePath);
        
        // Should delegate to speechPipelineOrchestrator
        expect(content).toMatch(
          /speechPipelineOrchestrator|context\.speechPipelineOrchestrator/,
          `${fileName} should delegate to speechPipelineOrchestrator instead of handling business logic directly`
        );
      });
    });
  });

  describe('File Organization Requirements', () => {
    it('should have domain handlers in appropriate directories', () => {
      // After refactoring, these should move to domain directories
      const domainHandlersThatShouldMove = [
        { file: 'TTSRequestMessageHandler.ts', shouldBeIn: 'services/speech/tts' },
        { file: 'TranscriptionMessageHandler.ts', shouldBeIn: 'services/speech/transcription' },
        { file: 'AudioMessageHandler.ts', shouldBeIn: 'services/speech/audio' }
      ];
      
      domainHandlersThatShouldMove.forEach(({ file, shouldBeIn }) => {
        const currentPath = path.join(websocketDir, file);
        
        if (fs.existsSync(currentPath)) {
          console.warn(`${file} is currently in websocket directory but should be moved to ${shouldBeIn} for proper clean architecture`);
        }
      });
    });

    it('should only have transport-related handlers in websocket directory', () => {
      const allowedWebSocketHandlers = [
        'RegisterMessageHandler.ts',
        'SettingsMessageHandler.ts', 
        'PingMessageHandler.ts',
        'PongMessageHandler.ts',
        'MessageHandler.ts',
        'ConnectionManager.ts',
        'ConnectionHealthManager.ts',
        'ConnectionLifecycleManager.ts',
        'ConnectionValidationService.ts',
        'WebSocketResponseService.ts'
      ];
      
      const websocketFiles = fs.readdirSync(websocketDir)
        .filter(file => file.endsWith('.ts') && !file.endsWith('.old'));
      
      websocketFiles.forEach(file => {
        const isTransportRelated = allowedWebSocketHandlers.includes(file);
        const isDomainHandler = ['TTS', 'Transcription', 'Audio'].some(domain => 
          file.includes(domain) && file.includes('Handler')
        );
        
        if (isDomainHandler && !isTransportRelated) {
          console.warn(`${file} contains domain logic and should be moved out of websocket directory`);
        }
      });
    });
  });

  // Helper function to get WebSocket handler files
  function getWebSocketHandlerFiles(): string[] {
    if (!fs.existsSync(websocketDir)) {
      return [];
    }
    
    return fs.readdirSync(websocketDir)
      .filter(file => file.endsWith('Handler.ts'))
      .map(file => path.join(websocketDir, file))
      .filter(fs.existsSync);
  }
});
