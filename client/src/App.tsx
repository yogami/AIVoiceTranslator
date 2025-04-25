import React, { useState, createContext } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import NotFound from "./pages/not-found";
import Home from "./pages/Home";
import UsageGuidePage from "./pages/UsageGuidePage";
import StudentPage from "./pages/StudentPage";

// Simple toast context
import { useToast } from "./hooks/use-toast";

// Define toast interfaces
interface ToastProps {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

// Create toast context
interface ToastContextType {
  toast: (props: ToastProps) => void;
  message: ToastProps | null;
}

const ToastContext = createContext<ToastContextType>({
  toast: () => {},
  message: null
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/guide" component={UsageGuidePage} />
      <Route path="/student" component={StudentPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

// Simple Toaster component
function Toaster({ message }: { message: ToastProps | null }) {
  if (!message) return null;
  
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div 
        className={`rounded-lg p-4 shadow-lg transition-all duration-300 ease-in-out max-w-sm ${
          message.variant === 'destructive' ? 'bg-red-500 text-white' : 'bg-white border'
        }`}
        role="alert"
      >
        {message.title && <h4 className="font-medium">{message.title}</h4>}
        {message.description && <p className="text-sm mt-1">{message.description}</p>}
      </div>
    </div>
  );
}

function App() {
  const [toastMessage, setToastMessage] = useState<ToastProps | null>(null);
  
  const toast = (props: ToastProps) => {
    setToastMessage(props);
    
    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ToastContext.Provider value={{ toast, message: toastMessage }}>
        <Router />
        <Toaster message={toastMessage} />
      </ToastContext.Provider>
    </QueryClientProvider>
  );
}

export default App;
