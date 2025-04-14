import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const apiKey = process.env.OPENAI_API_KEY || "";

// Initialize OpenAI client
const openai = new OpenAI({ apiKey });

/**
 * Handles direct speech-to-speech translation using OpenAI's Realtime API
 * Note: This is a simplified implementation since the actual Realtime API 
 * would require streaming both to and from the API
 */
export async function translateSpeech(
  audioBuffer: Buffer,
  sourceLanguage: string,
  targetLanguage: string
) {
  try {
    // Note: This is a placeholder for OpenAI's Realtime API which doesn't exist in this form yet
    // In a real implementation, we would stream audio to the API and receive audio back
    
    // For now, we'll use the audio transcription + chat completion + TTS pipeline
    // 1. Transcribe audio
    const transcription = await transcribeAudio(audioBuffer);
    
    // 2. Translate text
    const translatedText = await translateText(transcription, sourceLanguage, targetLanguage);
    
    // 3. Convert to speech
    const translatedSpeech = await textToSpeech(translatedText, targetLanguage);
    
    return {
      originalText: transcription,
      translatedText,
      audioBuffer: translatedSpeech
    };
  } catch (error) {
    console.error('Error in speech translation:', error);
    throw error;
  }
}

/**
 * Transcribes audio to text
 */
export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  try {
    console.log(`Transcribing audio buffer of size ${audioBuffer.byteLength}...`);
    
    // Create a temporary file for the audio buffer
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    
    // Create a temporary file with a random name
    const tempFilePath = path.join(os.tmpdir(), `audio-${Date.now()}.wav`);
    fs.writeFileSync(tempFilePath, audioBuffer);
    
    console.log(`Audio saved to temporary file: ${tempFilePath}`);
    
    // Write to a separate file we can debug later
    const debugFile = path.join(process.cwd(), `debug-audio-${Date.now()}.wav`);
    fs.writeFileSync(debugFile, audioBuffer);
    console.log(`Debug audio file saved to: ${debugFile}`);
    
    try {
      // Check file size and content
      const stats = fs.statSync(tempFilePath);
      console.log(`File size: ${stats.size} bytes`);
      
      // Check if the OpenAI API key is properly set
      if (!apiKey) {
        throw new Error('OpenAI API key is not set');
      }
      
      // Debug log - verify the first few bytes to check if it's a valid WAV file
      const headerBytes = fs.readFileSync(tempFilePath, { length: 44 });
      console.log('File header bytes (first 44 bytes for WAV header):', headerBytes.toString('hex'));
     
      // Debug log to file
      fs.appendFileSync('./server-stderr.log', `\n[${new Date().toISOString()}] Processing audio file: ${tempFilePath}, size: ${stats.size} bytes\n`);
      fs.appendFileSync('./server-stderr.log', `Header bytes: ${headerBytes.toString('hex')}\n`);
      
      // Use the file path for transcription
      try {
        console.log('Calling OpenAI Whisper API with stream...');
        
        const transcription = await openai.audio.transcriptions.create({
          file: fs.createReadStream(tempFilePath),
          model: "whisper-1",
          language: "en", // Default to English
        });
        
        console.log(`Transcription successful: "${transcription.text}"`);
        fs.appendFileSync('./server-stderr.log', `Transcription result: "${transcription.text}"\n`);
        return transcription.text;
      } catch (apiError) {
        console.error('Error from OpenAI API:', apiError);
        fs.appendFileSync('./server-stderr.log', `OpenAI API Error: ${JSON.stringify(apiError)}\n`);
        throw apiError;
      }
    } finally {
      // Clean up the temporary file
      try {
        fs.unlinkSync(tempFilePath);
        console.log(`Temporary file deleted: ${tempFilePath}`);
      } catch (cleanupError) {
        console.error('Error cleaning up temporary file:', cleanupError);
      }
    }
  } catch (error) {
    console.error('Error in transcription:', error);
    
    // For improved error handling, check specific errors
    if (error.toString().includes('401')) {
      console.error('Authentication error - Check your OpenAI API key');
    } else if (error.toString().includes('invalid_file_format')) {
      console.error('Invalid file format - Audio file may be corrupted or in an unsupported format');
    } else if (error.toString().includes('file_too_large')) {
      console.error('File too large - Audio file exceeds size limit');
    }
    
    throw error;
  }
}

/**
 * Translates text from source to target language
 */
export async function translateText(
  text: string, 
  sourceLanguage: string, 
  targetLanguage: string
): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a professional translator. Translate the following text from ${sourceLanguage} to ${targetLanguage}. Maintain the tone and meaning of the original text. Only respond with the translated text, no explanations or meta-commentary.`
        },
        {
          role: "user",
          content: text
        }
      ]
    });
    
    return completion.choices[0].message.content || "";
  } catch (error) {
    console.error('Error in translation:', error);
    throw error;
  }
}

/**
 * Converts text to speech in specified language
 */
export async function textToSpeech(text: string, language: string): Promise<Buffer> {
  try {
    // Map language codes to voices
    const voiceMap: Record<string, string> = {
      "en-US": "alloy",
      "es": "shimmer",
      "de": "onyx",
      "fr": "nova"
    };
    
    // Default to alloy if language not found
    const voice = voiceMap[language] || "alloy";
    
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice,
      input: text,
    });
    
    // Convert to buffer
    const buffer = Buffer.from(await mp3.arrayBuffer());
    return buffer;
  } catch (error) {
    console.error('Error in text-to-speech:', error);
    throw error;
  }
}
