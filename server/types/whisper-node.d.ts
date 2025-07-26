declare module 'whisper-node' {
  interface WhisperOptions {
    outputInText?: boolean;
    outputInVtt?: boolean;
    outputInSrt?: boolean;
    gen_file_txt?: boolean;
    gen_file_subtitle?: boolean;
    gen_file_vtt?: boolean;
    word_timestamps?: boolean;
  }

  interface WhisperConfig {
    modelName?: string;
    language?: string;
    whisperOptions?: WhisperOptions;
  }

  interface TranscriptSegment {
    speech?: string;
    start?: number;
    end?: number;
  }

  type TranscriptResult = TranscriptSegment | TranscriptSegment[] | { speech?: string };

  function whisper(filePath: string, config?: WhisperConfig): Promise<TranscriptResult>;
  
  export = whisper;
}
