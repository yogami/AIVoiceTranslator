import { createContext, useContext } from 'react';

export interface ToastProps {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

// Create a context to share the toast state across components
interface ToastContextType {
  toast: (props: ToastProps) => void;
  message: ToastProps | null;
}

export const ToastContext = createContext<ToastContextType>({
  toast: () => {},
  message: null
});

export function useToast() {
  return useContext(ToastContext);
}