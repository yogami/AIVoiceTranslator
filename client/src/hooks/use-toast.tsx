// A simple implementation of useToast
// In practice, a real context system would be used
// This is a temporary solution for our demo

export interface ToastProps {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

let lastToast: ToastProps | null = null;
let toastCallback: ((toast: ToastProps) => void) | null = null;

export function setToastHandler(callback: (toast: ToastProps) => void) {
  toastCallback = callback;
}

export function useToast() {
  return {
    toast: (props: ToastProps) => {
      lastToast = props;
      if (toastCallback) {
        toastCallback(props);
      } else {
        console.log('Toast displayed:', props);
      }
    }
  };
}