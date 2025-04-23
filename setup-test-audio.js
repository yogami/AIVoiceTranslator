/**
 * Setup Test Audio for Benedictaitor E2E Testing
 * 
 * This script creates a proper audio file for testing purposes
 * using the OpenAI TTS API.
 */

const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

// Check for OpenAI API key
if (!process.env.OPENAI_API_KEY) {
  console.error('Error: OPENAI_API_KEY environment variable is not set.');
  console.error('Please set your OpenAI API key with:');
  console.error('  export OPENAI_API_KEY=your_api_key_here');
  process.exit(1);
}

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, 
});

// The text to convert to speech
const TEST_TEXT = `
This is a test message for the Benedictaitor translation system.
It should capture this audio and transcribe it for testing purposes.
The transcription should then be sent to the translation service, 
which should translate this text into multiple languages like 
Spanish, French, and German. This ensures the end-to-end pipeline 
is functioning correctly.
`.trim();

// Output path for the audio file
const OUTPUT_PATH = path.join(__dirname, 'test-audio.mp3');

async function generateTestAudio() {
  console.log('Generating test audio...');
  console.log(`Text to convert: "${TEST_TEXT}"`);
  
  try {
    // Generate speech using OpenAI TTS API
    const mp3 = await openai.audio.speech.create({
      model: "tts-1", // the newest OpenAI model for TTS
      voice: "alloy",
      input: TEST_TEXT,
    });
    
    // Convert to buffer
    const buffer = Buffer.from(await mp3.arrayBuffer());
    
    // Save to file
    fs.writeFileSync(OUTPUT_PATH, buffer);
    
    console.log(`Audio file saved to: ${OUTPUT_PATH}`);
    console.log('Test audio generated successfully!');
    
    // Also save the text for reference
    fs.writeFileSync(
      path.join(__dirname, 'test-message.txt'), 
      TEST_TEXT
    );
    console.log('Test message text saved for reference.');
    
    return OUTPUT_PATH;
  } catch (error) {
    console.error('Error generating test audio:');
    console.error(error);
    process.exit(1);
  }
}

// Run the function
generateTestAudio().then(() => {
  console.log('Setup complete!');
});