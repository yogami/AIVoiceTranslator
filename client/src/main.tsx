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
