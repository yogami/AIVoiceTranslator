/// <reference types="vite/client" />

// Make this a module by adding an export
export {};

declare global {
  interface Window {
    VITE_API_URL?: string;
    VITE_WS_URL?: string;
    // For debugging if the script loaded
    RUNTIME_CONFIG_LOADED?: boolean; 
  }
  // These are defined by Vite's 'define' config
  const __VITE_API_URL__: string;
  const __VITE_WS_URL__: string;
}

console.log('[runtime-config.ts] Script start');

try {
  // Option 1: Use Vite's define feature (global constants)
  if (typeof __VITE_API_URL__ !== 'undefined') {
    window.VITE_API_URL = __VITE_API_URL__;
    console.log('[runtime-config.ts] Using __VITE_API_URL__:', window.VITE_API_URL);
  } else {
    console.error('[runtime-config.ts] __VITE_API_URL__ is not defined.');
  }

  if (typeof __VITE_WS_URL__ !== 'undefined') {
    window.VITE_WS_URL = __VITE_WS_URL__;
    console.log('[runtime-config.ts] Using __VITE_WS_URL__:', window.VITE_WS_URL);
  } else {
    console.error('[runtime-config.ts] __VITE_WS_URL__ is not defined.');
  }

  // Option 2: Fallback or primary use of import.meta.env (if define isn't preferred or has issues)
  // This requires Vite to process the file correctly.
  if (!window.VITE_API_URL && import.meta.env.VITE_API_URL) {
    window.VITE_API_URL = import.meta.env.VITE_API_URL;
    console.log('[runtime-config.ts] Using import.meta.env.VITE_API_URL:', window.VITE_API_URL);
  } else if (!window.VITE_API_URL) {
    // This log is now conditional to avoid logging if __VITE_API_URL__ was successful
    if (typeof __VITE_API_URL__ === 'undefined') {
      console.error('[runtime-config.ts] import.meta.env.VITE_API_URL is not available.');
    }
  }

  if (!window.VITE_WS_URL && import.meta.env.VITE_WS_URL) {
    window.VITE_WS_URL = import.meta.env.VITE_WS_URL;
    console.log('[runtime-config.ts] Using import.meta.env.VITE_WS_URL:', window.VITE_WS_URL);
  } else if (!window.VITE_WS_URL) {
    // This log is now conditional
    if (typeof __VITE_WS_URL__ === 'undefined') {
      console.error('[runtime-config.ts] import.meta.env.VITE_WS_URL is not available.');
    }
  }

  if (!window.VITE_API_URL || !window.VITE_WS_URL) {
    console.error('CRITICAL ERROR from runtime-config: VITE_API_URL or VITE_WS_URL could not be set.');
  }

} catch (error) {
  console.error('[runtime-config.ts] Error during execution:', error);
  window.VITE_API_URL = 'fallback_api_url_error';
  window.VITE_WS_URL = 'fallback_ws_url_error';
}

window.RUNTIME_CONFIG_LOADED = true;
console.log('[runtime-config.ts] Script end. window.VITE_API_URL:', window.VITE_API_URL, 'window.VITE_WS_URL:', window.VITE_WS_URL);
