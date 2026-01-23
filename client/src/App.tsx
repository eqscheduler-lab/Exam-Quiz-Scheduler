import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/LoginPage";
import Dashboard from "@/pages/Dashboard";
import SchedulePage from "@/pages/SchedulePage";
import MyExamsPage from "@/pages/MyExamsPage";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      
      {/* Protected Routes would logically be wrapped, but simple routing works with internal auth checks */}
      <Route path="/" component={Dashboard} />
      <Route path="/schedule" component={SchedulePage} />
      <Route path="/my-exams" component={MyExamsPage} />
      
      {/* Admin Placeholders - reusing MyExams or Dashboard for now as structure is similar */}
      <Route path="/admin/users" component={Dashboard} /> 
      <Route path="/admin/subjects" component={Dashboard} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
