import os
import json
from openai import OpenAI

# Initialize the client with your API key
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

try:
    # List available models
    print("Checking available models...")
    models = client.models.list()
    
    # Check if whisper-1 is available
    whisper_available = any(model.id == "whisper-1" for model in models.data)
    print(f"Whisper-1 model available: {whisper_available}")
    
    print("\nTesting chat completions...")
    # Test simple chat completion
    chat_completion = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": "Say hello"}],
        max_tokens=10
    )
    print(f"Chat response: {chat_completion.choices[0].message.content}")
    print("Chat API test successful!")
    
    # We can't easily test audio transcription without an audio file,
    # but we can check if the API endpoint is accessible
    print("\nYour OpenAI API key is valid and working for chat models.")
    print("Audio transcription requires valid audio files to test.")
    
except Exception as e:
    print(f"Error: {str(e)}")
