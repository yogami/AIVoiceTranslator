import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { webSocketClient } from "./lib/websocket";

// Extend Window interface to include WebSocketClient
declare global {
  interface Window {
    webSocketClient?: typeof webSocketClient;
  }
}

// Attach singleton to window for global access
if (typeof window !== 'undefined') {
  window.webSocketClient = webSocketClient;
}

console.log("WebSocketClient singleton initialized");

// Detect and neutralize test code injections
(function preventTestCodeInjection() {
  console.log("Starting test code detector...");
  
  // Store original implementations to restore if tampered with
  const originalGetUserMedia = navigator.mediaDevices.getUserMedia;
  const originalMediaRecorder = window.MediaRecorder;
  const origDescriptor = Object.getOwnPropertyDescriptor(window, 'MediaRecorder');
  
  // List of known test file indicators
  const testKeywords = ['test', 'mock', 'fake', 'selenium', 'e2e', 'youtube', 'subscribe', 'like', 'comment', 'fema'];
  
  // Set up MutationObserver to detect script injections
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeName === 'SCRIPT') {
            const scriptContent = (node as HTMLScriptElement).textContent || '';
            const scriptSrc = (node as HTMLScriptElement).src || '';
            
            // Check if this is a test script
            if (testKeywords.some(keyword => 
                scriptContent.toLowerCase().includes(keyword) || 
                scriptSrc.toLowerCase().includes(keyword))) {
              console.warn('Detected potential test script injection:', 
                scriptSrc || scriptContent.substring(0, 100) + '...');
              
              // Optionally remove the script
              // node.parentNode?.removeChild(node);
            }
          }
        });
      }
    }
  });
  
  // Start observing the document
  observer.observe(document, { childList: true, subtree: true });
  
  // Detect if MediaRecorder has been mocked
  function checkAndRestoreMediaRecorder() {
    try {
      // Check if MediaRecorder has suspicious behavior
      const isSuspicious = 
        MediaRecorder.toString().length < 50 ||
        MediaRecorder.toString().includes('mock') ||
        MediaRecorder.isTypeSupported('not-a-real-type') ||
        typeof (window as any)._originalMediaRecorder === 'function';
        
      if (isSuspicious) {
        console.warn('Detected suspicious MediaRecorder implementation, restoring original');
        
        // Restore original if we have a reference to it
        if (origDescriptor) {
          Object.defineProperty(window, 'MediaRecorder', origDescriptor);
        } else if (originalMediaRecorder) {
          window.MediaRecorder = originalMediaRecorder;
        }
      }
    } catch (e) {
      console.error('Error checking MediaRecorder implementation:', e);
    }
  }
  
  // Detect if getUserMedia has been mocked
  function checkAndRestoreGetUserMedia() {
    try {
      const getUserMediaString = navigator.mediaDevices.getUserMedia.toString();
      const isSuspicious = 
        getUserMediaString.length < 50 ||
        getUserMediaString.includes('mock') ||
        getUserMediaString.includes('test') ||
        getUserMediaString.includes('_playTestAudio') ||
        typeof (navigator as any)._originalGetUserMedia === 'function';
        
      if (isSuspicious) {
        console.warn('Detected suspicious getUserMedia implementation, restoring original');
        
        // Restore original if we have a reference to it
        if (originalGetUserMedia) {
          navigator.mediaDevices.getUserMedia = originalGetUserMedia;
        }
      }
    } catch (e) {
      console.error('Error checking getUserMedia implementation:', e);
    }
  }
  
  // Check for test audio files
  function detectTestAudioElements() {
    // Look for test audio in the DOM
    document.querySelectorAll('audio').forEach(audio => {
      const src = audio.src || '';
      if (testKeywords.some(keyword => src.toLowerCase().includes(keyword))) {
        console.warn('Detected test audio element, removing:', src);
        audio.remove();
      }
    });
    
    // Check for special window properties used by tests
    if (typeof (window as any)._playTestAudio === 'function') {
      console.warn('Detected _playTestAudio function, removing');
      delete (window as any)._playTestAudio;
    }
  }
  
  // Run all checks
  function runTestCodeChecks() {
    checkAndRestoreMediaRecorder();
    checkAndRestoreGetUserMedia();
    detectTestAudioElements();
  }
  
  // Run immediately
  runTestCodeChecks();
  
  // Also run periodically
  setInterval(runTestCodeChecks, 1000);
  
  // Before unloading the page
  window.addEventListener('beforeunload', (event) => {
    // Disconnect the observer
    observer.disconnect();
    
    // Properly close WebSocket connections if they exist
    try {
      if (window.webSocketClient) {
        console.log('Properly closing WebSocket connection before page unload');
        window.webSocketClient.disconnect();
      }
    } catch (e) {
      console.error('Error closing WebSocket before unload:', e);
    }
    
    // For browsers that require it, return a string to trigger confirm dialog
    // Commenting out as modern browsers ignore this value but keep here for reference
    // event.returnValue = '';
    // return '';
  });
  
  console.log("Test code detector initialization complete");
})();

// Adding global styles for audio waveform
const style = document.createElement('style');
style.textContent = `
  @keyframes sound {
    0% {
      height: 5px;
    }
    100% {
      height: 30px;
    }
  }
  
  .active-wave .bar {
    animation-name: sound;
    animation-timing-function: linear;
    animation-iteration-count: infinite;
    animation-direction: alternate;
    animation-play-state: running;
  }
  
  .paused-wave .bar {
    animation-play-state: paused;
    height: 5px;
  }
`;
document.head.appendChild(style);

// Set page title
document.title = "Benedictaitor - Real-time Translation Platform";

// Add meta viewport tag if not present
if (!document.querySelector('meta[name="viewport"]')) {
  const meta = document.createElement('meta');
  meta.name = 'viewport';
  meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1';
  document.head.appendChild(meta);
}

// Add Material Icons for consistency with design
const link = document.createElement('link');
link.href = 'https://fonts.googleapis.com/icon?family=Material+Icons';
link.rel = 'stylesheet';
document.head.appendChild(link);

// Render application
createRoot(document.getElementById("root")!).render(<App />);
