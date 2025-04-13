import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import TeacherPage from "./pages/TeacherPage";
import StudentPage from "./pages/StudentPage";
import QRCodePage from "./pages/QRCodePage";
import UsageGuidePage from "./pages/UsageGuidePage";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/teacher" component={TeacherPage} />
      <Route path="/student" component={StudentPage} />
      <Route path="/qrcode" component={QRCodePage} />
      <Route path="/guide" component={UsageGuidePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
