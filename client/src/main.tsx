import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

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
