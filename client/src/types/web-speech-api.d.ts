// Type definitions for the Web Speech API
// Based on the Web Speech API specification: https://wicg.github.io/speech-api/

declare global {
  // SpeechRecognition interface
  interface SpeechRecognition extends EventTarget {
    // Properties
    grammars: SpeechGrammarList;
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    maxAlternatives: number;
    serviceURI: string;
    
    // Event handlers
    onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
    onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
    onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
    
    // Methods
    start(): void;
    stop(): void;
    abort(): void;
  }
  
  // SpeechRecognition constructor
  var SpeechRecognition: {
    prototype: SpeechRecognition;
    new(): SpeechRecognition;
  };
  
  // Webkit prefixed version
  var webkitSpeechRecognition: {
    prototype: SpeechRecognition;
    new(): SpeechRecognition;
  };
  
  // SpeechGrammar interface
  interface SpeechGrammar {
    src: string;
    weight: number;
  }
  
  // SpeechGrammarList interface
  interface SpeechGrammarList {
    length: number;
    item(index: number): SpeechGrammar;
    addFromURI(src: string, weight?: number): void;
    addFromString(string: string, weight?: number): void;
  }
  
  // SpeechRecognitionEvent interface
  interface SpeechRecognitionEvent extends Event {
    resultIndex: number;
    results: SpeechRecognitionResultList;
  }
  
  // SpeechRecognitionErrorEvent interface
  interface SpeechRecognitionErrorEvent extends Event {
    error: string;
    message: string;
  }
  
  // SpeechRecognitionResultList interface
  interface SpeechRecognitionResultList {
    length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
  }
  
  // SpeechRecognitionResult interface
  interface SpeechRecognitionResult {
    length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
    isFinal: boolean;
  }
  
  // SpeechRecognitionAlternative interface
  interface SpeechRecognitionAlternative {
    transcript: string;
    confidence: number;
  }
  
  // SpeechSynthesis interface
  interface SpeechSynthesis {
    pending: boolean;
    speaking: boolean;
    paused: boolean;
    onvoiceschanged: ((this: SpeechSynthesis, ev: Event) => any) | null;
    
    speak(utterance: SpeechSynthesisUtterance): void;
    cancel(): void;
    pause(): void;
    resume(): void;
    getVoices(): SpeechSynthesisVoice[];
  }
  
  // SpeechSynthesisUtterance interface
  interface SpeechSynthesisUtterance extends EventTarget {
    text: string;
    lang: string;
    voice: SpeechSynthesisVoice | null;
    volume: number;
    rate: number;
    pitch: number;
    
    onstart: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => any) | null;
    onend: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => any) | null;
    onerror: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisErrorEvent) => any) | null;
    onpause: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => any) | null;
    onresume: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => any) | null;
    onboundary: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisBoundaryEvent) => any) | null;
    onmark: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => any) | null;
  }
  
  // SpeechSynthesisEvent interface
  interface SpeechSynthesisEvent extends Event {
    utterance: SpeechSynthesisUtterance;
    charIndex: number;
    charLength?: number;
    elapsedTime: number;
    name: string;
  }
  
  // SpeechSynthesisErrorEvent interface
  interface SpeechSynthesisErrorEvent extends SpeechSynthesisEvent {
    error: string;
  }
  
  // SpeechSynthesisBoundaryEvent interface
  interface SpeechSynthesisBoundaryEvent extends SpeechSynthesisEvent {
    charIndex: number;
    charLength: number;
    utterance: SpeechSynthesisUtterance;
    name: string;
  }
  
  // SpeechSynthesisVoice interface
  interface SpeechSynthesisVoice {
    voiceURI: string;
    name: string;
    lang: string;
    localService: boolean;
    default: boolean;
  }
  
  // Extend Window interface
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
    SpeechGrammarList: any;
    webkitSpeechGrammarList: any;
    SpeechRecognitionEvent: any;
    speechSynthesis: SpeechSynthesis;
  }
}

export {};