import { useState } from 'react';

export interface ToastProps {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

export function useToast() {
  const [message, setMessage] = useState<ToastProps | null>(null);
  
  const toast = (props: ToastProps) => {
    setMessage(props);
    
    // Clear the toast after 3 seconds
    setTimeout(() => {
      setMessage(null);
    }, 3000);
  };
  
  return {
    toast,
    message,
  };
}