import React from 'react';
import { useToast } from '@/hooks/use-toast';

export function Toaster() {
  const { message } = useToast();
  
  if (!message) return null;
  
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div 
        className={`rounded-lg p-4 shadow-lg transition-all duration-300 ease-in-out max-w-sm ${
          message.variant === 'destructive' ? 'bg-red-500 text-white' : 'bg-white border'
        }`}
        role="alert"
      >
        {message.title && (
          <h4 className="font-medium">{message.title}</h4>
        )}
        {message.description && (
          <p className="text-sm mt-1">{message.description}</p>
        )}
      </div>
    </div>
  );
}