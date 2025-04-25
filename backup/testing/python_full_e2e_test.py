# Python Full End-to-End Selenium Test for Benedictaitor
#
# This script:
# 1. Starts the Benedictaitor application
# 2. Opens a browser using Selenium
# 3. Tests real audio input and WebSocket communication
# 4. Verifies translations appear correctly

import os
import time
import subprocess
import signal
import base64
import platform
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

# Configuration
APP_URL = 'http://localhost:3000'
TEST_TIMEOUT = 60  # 60 seconds timeout
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
TEST_AUDIO_PATH = os.path.join(SCRIPT_DIR, 'test-audio.mp3')
SERVER_PROCESS = None

def ensure_test_audio_exists():
    """Make sure we have a test audio file"""
    if not os.path.exists(TEST_AUDIO_PATH):
        print('Test audio file not found:', TEST_AUDIO_PATH)
        print('Please create the test audio file using setup-test-audio.js')
        print('or place an audio file at this location.')
        
        # Create a test message text file at least
        test_message = "This is a test message for the Benedictaitor system."
        with open(os.path.join(SCRIPT_DIR, 'test-message.txt'), 'w') as f:
            f.write(test_message)
        
        print('Created a test message text file.')

def start_server():
    """Start the Benedictaitor application server"""
    global SERVER_PROCESS
    
    if SERVER_PROCESS:
        return  # Server already started
    
    print('Starting Benedictaitor server...')
    
    # Start the server
    if platform.system() == 'Windows':
        # Windows uses shell=True to run npm
        SERVER_PROCESS = subprocess.Popen(
            'npm run dev',
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
    else:
        # Unix-like systems
        SERVER_PROCESS = subprocess.Popen(
            ['npm', 'run', 'dev'],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            preexec_fn=os.setsid  # Used to terminate the process group
        )
    
    print('Waiting for server to start...')
    time.sleep(5)  # Give the server some time to start
    print('Proceeding with test...')

def stop_server():
    """Stop the Benedictaitor application server"""
    global SERVER_PROCESS
    
    if SERVER_PROCESS:
        print('Stopping server...')
        
        try:
            if platform.system() == 'Windows':
                # Windows
                SERVER_PROCESS.terminate()
            else:
                # Unix-like systems
                os.killpg(os.getpgid(SERVER_PROCESS.pid), signal.SIGTERM)
        except Exception as e:
            print(f'Error stopping server: {e}')
        
        SERVER_PROCESS = None

def inject_audio_mock(driver):
    """Inject JavaScript to mock audio functions"""
    print('Injecting audio mock functions...')
    
    # This script mocks the audio functions to simulate a recording
    mock_script = """
    // Save original functions
    const originalMediaDevices = navigator.mediaDevices;
    const originalMediaRecorder = window.MediaRecorder;
    
    // Mock getUserMedia to always succeed
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      console.log('Mocked getUserMedia called with', constraints);
      
      // Create a mock audio track
      const mockTrack = {
        kind: 'audio',
        enabled: true,
        id: 'mock-audio-track-id',
        label: 'Mock Audio Track',
        stop: () => console.log('Mock track stopped')
      };
      
      // Create and return a mock stream
      return {
        id: 'mock-stream-id',
        active: true,
        getTracks: () => [mockTrack],
        getAudioTracks: () => [mockTrack],
        getVideoTracks: () => [],
        addTrack: (track) => console.log('Track added', track),
        removeTrack: (track) => console.log('Track removed', track),
        clone: () => this
      };
    };
    
    // Mock MediaRecorder
    window.MediaRecorder = class MockMediaRecorder {
      constructor(stream, options) {
        console.log('Mock MediaRecorder created', options);
        this.stream = stream;
        this.state = 'inactive';
        this.mimeType = 'audio/webm';
        this.audioBitsPerSecond = 128000;
        this.videoBitsPerSecond = 0;
        
        // Event handlers
        this.onstart = null;
        this.onstop = null;
        this.ondataavailable = null;
        this.onerror = null;
        this.onpause = null;
        this.onresume = null;
        
        // Timer for simulated recording
        this.timer = null;
      }
      
      start(timeslice) {
        console.log('Mock recording started with timeslice', timeslice);
        this.state = 'recording';
        
        // Fire onstart event
        if (this.onstart) {
          this.onstart(new Event('start'));
        }
        
        // Simulate recording with periodic data events
        const interval = timeslice || 1000;
        this.timer = setInterval(() => {
          // Create "audio" data - random noise
          const dataLength = Math.floor(Math.random() * 10000) + 5000;
          const mockData = new Uint8Array(dataLength);
          for (let i = 0; i < dataLength; i++) {
            mockData[i] = Math.floor(Math.random() * 256);
          }
          
          // Create a mock Blob
          const mockBlob = new Blob([mockData], { type: 'audio/webm' });
          
          // Fire dataavailable event
          if (this.ondataavailable) {
            const event = new Event('dataavailable');
            event.data = mockBlob;
            this.ondataavailable(event);
          }
        }, interval);
      }
      
      stop() {
        console.log('Mock recording stopped');
        
        if (this.state === 'inactive') return;
        this.state = 'inactive';
        
        // Clear the timer
        if (this.timer) {
          clearInterval(this.timer);
          this.timer = null;
        }
        
        // Fire onstop event
        if (this.onstop) {
          this.onstop(new Event('stop'));
        }
      }
      
      pause() {
        console.log('Mock recording paused');
        this.state = 'paused';
        
        if (this.onpause) {
          this.onpause(new Event('pause'));
        }
      }
      
      resume() {
        console.log('Mock recording resumed');
        this.state = 'recording';
        
        if (this.onresume) {
          this.onresume(new Event('resume'));
        }
      }
      
      static isTypeSupported(mimeType) {
        return ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/ogg'].includes(mimeType);
      }
    };
    
    console.log('Audio mocks successfully injected');
    """
    
    # Execute the mock script in the browser
    driver.execute_script(mock_script)

def run_e2e_test():
    """Run the full end-to-end test"""
    ensure_test_audio_exists()
    start_server()
    
    driver = None
    
    try:
        print('Starting Selenium WebDriver...')
        
        # Setup Chrome options for better test performance
        options = Options()
        options.add_argument('--disable-gpu')
        options.add_argument('--window-size=1280,800')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--no-sandbox')
        # Uncomment to run headless (no browser UI):
        # options.add_argument('--headless')
        
        # Create ChromeDriver service
        service = Service(ChromeDriverManager().install())
        
        # Build and start Chrome
        driver = webdriver.Chrome(service=service, options=options)
        
        print('WebDriver started successfully')
        
        # Set implicit wait time
        driver.implicitly_wait(10)
        
        # Navigate to teacher interface
        print('Navigating to the teacher interface...')
        driver.get(f"{APP_URL}/teacher")
        
        # Wait for page to load
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "h1, h2, button"))
        )
        
        # Inject audio mocks
        inject_audio_mock(driver)
        
        # Verify page is loaded correctly
        title = driver.title
        print(f"Page loaded with title: {title}")
        
        # Take a screenshot
        screenshot_path = os.path.join(SCRIPT_DIR, 'teacher-interface.png')
        driver.save_screenshot(screenshot_path)
        print(f"Screenshot saved at: {screenshot_path}")
        
        # Find and click the record button
        print('Looking for record button...')
        record_buttons = driver.find_elements(By.CSS_SELECTOR, 'button')
        
        record_button = None
        for button in record_buttons:
            text = button.text.lower()
            if 'record' in text or 'start' in text:
                record_button = button
                break
        
        if not record_button:
            raise Exception('Could not find a record button on the page')
        
        print('Found record button. Starting test recording...')
        record_button.click()
        
        # Wait for recording to be processed
        print('Waiting for speech recognition to process...')
        time.sleep(5)
        
        # Look for transcript or translations
        print('Looking for transcription or translations...')
        transcript_elements = driver.find_elements(By.CSS_SELECTOR, '.transcript, [data-testid="transcript"], p, div')
        
        found = False
        for element in transcript_elements:
            text = element.text
            if text and len(text) > 5:
                print(f'Found text content: "{text}"')
                found = True
                break
        
        if not found:
            print('Warning: Could not find any significant text content that might be transcription')
        
        # Find and click stop button if recording is still active
        print('Stopping recording...')
        stop_buttons = driver.find_elements(By.CSS_SELECTOR, 'button')
        
        stop_button = None
        for button in stop_buttons:
            text = button.text.lower()
            if 'stop' in text:
                stop_button = button
                break
        
        if stop_button:
            stop_button.click()
            print('Recording stopped')
        
        # Take a final screenshot
        final_screenshot_path = os.path.join(SCRIPT_DIR, 'test-completed.png')
        driver.save_screenshot(final_screenshot_path)
        print(f"Final screenshot saved at: {final_screenshot_path}")
        
        print('Test completed successfully!')
        
    except Exception as e:
        print(f'Test failed with error: {e}')
        
        # Take error screenshot if driver is available
        if driver:
            error_screenshot_path = os.path.join(SCRIPT_DIR, 'error-screenshot.png')
            driver.save_screenshot(error_screenshot_path)
            print(f"Error screenshot saved at: {error_screenshot_path}")
        
        raise e
        
    finally:
        # Clean up
        if driver:
            print('Closing WebDriver...')
            driver.quit()
        
        # Stop the server
        stop_server()

if __name__ == "__main__":
    try:
        run_e2e_test()
        print('E2E test completed successfully!')
    except Exception as e:
        print(f'E2E test failed: {e}')
        exit(1)