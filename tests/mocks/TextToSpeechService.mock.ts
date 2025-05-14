/**
 * Mock implementation of TextToSpeechService for tests
 * This prevents the need to import the actual service, which has ESM compatibility issues
 */

export interface TextToSpeechOptions {
  text: string;
  languageCode: string;
  voice?: string;
  speed?: number;
  preserveEmotions?: boolean;
}

export interface ITextToSpeechService {
  synthesizeSpeech(options: TextToSpeechOptions): Promise<Buffer>;
}

export class MockTextToSpeechService implements ITextToSpeechService {
  public async synthesizeSpeech(_options: TextToSpeechOptions): Promise<Buffer> {
    return Buffer.from('mock-audio-data');
  }
}

export class TextToSpeechFactory {
  private static instance: TextToSpeechFactory;
  private services: Map<string, ITextToSpeechService> = new Map();

  private constructor() {
    // Register mock services
    this.services.set('openai', new MockTextToSpeechService());
    this.services.set('browser', new MockTextToSpeechService());
    this.services.set('silent', new MockTextToSpeechService());
  }

  public static getInstance(): TextToSpeechFactory {
    if (!TextToSpeechFactory.instance) {
      TextToSpeechFactory.instance = new TextToSpeechFactory();
    }
    return TextToSpeechFactory.instance;
  }

  public getService(type: string = 'openai'): ITextToSpeechService {
    // Default to silent service if requested type is not available
    return this.services.get(type) || this.services.get('silent')!;
  }

  // Add a method to reset the instance for testing
  public static resetInstance(): void {
    TextToSpeechFactory.instance = undefined!;
  }
}