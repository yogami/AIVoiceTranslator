import { useState, useEffect, useCallback } from 'react';
import { AudioCapture } from '@/lib/audioCapture';

export interface AudioDevice {
  id: string;
  label: string;
}

interface UseAudioCaptureOptions {
  chunkDuration?: number;
  onDataAvailable?: (base64Data: string) => void;
}

export function useAudioCapture(options: UseAudioCaptureOptions = {}) {
  const [audioCapture, setAudioCapture] = useState<AudioCapture | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [volume, setVolume] = useState<number>(0);
  const [isSupportedBrowser, setIsSupportedBrowser] = useState(true);

  // Initialize audio capture
  useEffect(() => {
    // Check if browser supports MediaRecorder
    if (typeof window !== 'undefined' && 
        typeof window.MediaRecorder === 'undefined') {
      setIsSupportedBrowser(false);
      setError(new Error('MediaRecorder is not supported in this browser'));
      return;
    }

    const capture = new AudioCapture({
      chunkDuration: options.chunkDuration || 3000,
      onDataAvailable: async (blob) => {
        try {
          const base64 = await AudioCapture.blobToBase64(blob);
          options.onDataAvailable?.(base64);
        } catch (err) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      },
      onStart: () => {
        setIsRecording(true);
      },
      onStop: () => {
        setIsRecording(false);
      },
      onError: (err) => {
        setError(err);
        setIsRecording(false);
      }
    });

    setAudioCapture(capture);

    // Clean up on unmount
    return () => {
      if (capture.isActive()) {
        capture.stop();
      }
    };
  }, [options.chunkDuration, options.onDataAvailable]);

  // Load audio devices
  const loadDevices = useCallback(async () => {
    if (!audioCapture) return;
    
    try {
      setIsLoading(true);
      const deviceList = await audioCapture.getAudioDevices();
      
      const formattedDevices = deviceList.map(device => ({
        id: device.deviceId,
        label: device.label || `Microphone ${device.deviceId.slice(0, 4)}...`
      }));
      
      setDevices(formattedDevices);
      
      // Select first device if none selected
      if (!selectedDeviceId && formattedDevices.length > 0) {
        setSelectedDeviceId(formattedDevices[0].id);
      }
      
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsLoading(false);
    }
  }, [audioCapture, selectedDeviceId]);

  // Start recording
  const startRecording = useCallback(async () => {
    if (!audioCapture || isRecording) return false;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const success = await audioCapture.start(selectedDeviceId);
      setIsLoading(false);
      return success;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsLoading(false);
      return false;
    }
  }, [audioCapture, isRecording, selectedDeviceId]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (!audioCapture || !isRecording) return false;
    
    try {
      const success = audioCapture.stop();
      return success;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      return false;
    }
  }, [audioCapture, isRecording]);

  // Toggle recording
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      return stopRecording();
    } else {
      return startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Select a different device
  const selectDevice = useCallback((deviceId: string) => {
    setSelectedDeviceId(deviceId);
    
    if (isRecording && audioCapture) {
      audioCapture.stop();
      audioCapture.start(deviceId);
    }
  }, [audioCapture, isRecording]);

  // Request permission if not already granted
  const requestPermission = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null); // Clear any previous errors
      console.log('Requesting microphone permission...');
      
      // Check current permission status if API is available
      let currentPermission = 'unknown';
      if (navigator?.permissions?.query) {
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          currentPermission = permissionStatus.state;
          console.log('Current microphone permission status:', currentPermission);
          
          // Set up a listener for permission changes
          permissionStatus.onchange = () => {
            console.log('Microphone permission changed to:', permissionStatus.state);
            
            // If permission was revoked, we need to update our state and potentially stop recording
            if (permissionStatus.state === 'denied' && isRecording && audioCapture) {
              console.log('Permission revoked while recording, stopping...');
              audioCapture.stop();
              setIsRecording(false);
              setError(new Error('Microphone permission was revoked'));
            }
            
            // If permission was granted, reload devices
            if (permissionStatus.state === 'granted') {
              console.log('Permission was granted, loading devices...');
              loadDevices();
            }
          };
        } catch (e) {
          console.warn('Could not query microphone permission status:', e);
        }
      }
      
      // If permission is already denied, show a more helpful message
      if (currentPermission === 'denied') {
        const message = 'Microphone access was previously denied. Please reset permissions in your browser settings and try again.';
        console.warn(message);
        setError(new Error(message));
        setIsLoading(false);
        return false;
      }
      
      // Otherwise, proceed with requesting permission
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('Microphone permission granted, access stream obtained');
        
        // Stop the stream right away, we just needed the permission
        stream.getTracks().forEach(track => track.stop());
        console.log('Audio tracks stopped');
        
        // Refresh device list after getting permission
        await loadDevices();
        
        setIsLoading(false);
        return true;
      } catch (error) {
        console.error('Error accessing microphone:', error);
        
        // Provide user-friendly error messages based on the error
        let userMessage = 'Could not access microphone. ';
        
        // Cast to any to access error properties (not ideal but works for browser errors)
        const mediaError = error as any;
        
        if (mediaError && typeof mediaError === 'object') {
          if (mediaError.name === 'NotAllowedError' || mediaError.name === 'PermissionDeniedError') {
            userMessage += 'Permission was denied. Please allow microphone access in your browser settings.';
          } else if (mediaError.name === 'NotFoundError') {
            userMessage += 'No microphone found. Please connect a microphone and try again.';
          } else if (mediaError.name === 'NotReadableError' || mediaError.name === 'AbortError') {
            userMessage += 'Microphone is already in use by another application or not working properly.';
          } else {
            userMessage += `Error: ${mediaError.message || mediaError.name || 'Unknown error'}`;
          }
        } else {
          userMessage += 'Unknown error occurred.';
        }
        
        setError(new Error(userMessage));
        setIsLoading(false);
        return false;
      }
    } catch (err) {
      console.error('Unexpected error requesting microphone permission:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsLoading(false);
      return false;
    }
  }, [audioCapture, isRecording, loadDevices]);

  return {
    isRecording,
    devices,
    selectedDeviceId,
    error,
    isLoading,
    volume,
    isSupportedBrowser,
    startRecording,
    stopRecording,
    toggleRecording,
    selectDevice,
    loadDevices,
    requestPermission
  };
}
