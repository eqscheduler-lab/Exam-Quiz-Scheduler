import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";

import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/LoginPage";
import Dashboard from "@/pages/Dashboard";
import SchedulePage from "@/pages/SchedulePage";
import MyExamsPage from "@/pages/MyExamsPage";
import ManageStaff from "@/pages/ManageStaff";
import ManageSubjects from "@/pages/ManageSubjects";
import ManageClasses from "@/pages/ManageClasses";

function Router() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route>
          <Redirect to="/login" />
        </Route>
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/login">
        <Redirect to="/" />
      </Route>
      <Route path="/" component={Dashboard} />
      <Route path="/schedule" component={SchedulePage} />
      <Route path="/my-exams" component={MyExamsPage} />
      <Route path="/admin/users" component={ManageStaff} /> 
      <Route path="/admin/subjects" component={ManageSubjects} />
      <Route path="/admin/classes" component={ManageClasses} />
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
