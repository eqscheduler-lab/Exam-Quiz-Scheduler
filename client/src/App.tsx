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
import LoginAudit from "@/pages/LoginAudit";
import Analytics from "@/pages/Analytics";
import BulkImport from "@/pages/BulkImport";
import TeacherOverview from "@/pages/TeacherOverview";
import InactiveAccounts from "@/pages/InactiveAccounts";
import Documentation from "@/pages/Documentation";

function ProtectedRoute({ component: Component, allowedRoles }: { component: React.ComponentType; allowedRoles: string[] }) {
  const { user } = useAuth();
  if (!user || !allowedRoles.includes(user.role)) {
    return <Redirect to="/" />;
  }
  return <Component />;
}

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
      <Route path="/admin/users">
        <ProtectedRoute component={ManageStaff} allowedRoles={["ADMIN"]} />
      </Route>
      <Route path="/admin/subjects">
        <ProtectedRoute component={ManageSubjects} allowedRoles={["ADMIN"]} />
      </Route>
      <Route path="/admin/classes">
        <ProtectedRoute component={ManageClasses} allowedRoles={["ADMIN"]} />
      </Route>
      <Route path="/admin/login-audit">
        <ProtectedRoute component={LoginAudit} allowedRoles={["ADMIN"]} />
      </Route>
      <Route path="/admin/bulk-import">
        <ProtectedRoute component={BulkImport} allowedRoles={["ADMIN"]} />
      </Route>
      <Route path="/admin/documentation">
        <ProtectedRoute component={Documentation} allowedRoles={["ADMIN"]} />
      </Route>
      <Route path="/analytics">
        <ProtectedRoute component={Analytics} allowedRoles={["ADMIN", "PRINCIPAL", "VICE_PRINCIPAL"]} />
      </Route>
      <Route path="/teacher-overview">
        <ProtectedRoute component={TeacherOverview} allowedRoles={["ADMIN", "PRINCIPAL", "VICE_PRINCIPAL"]} />
      </Route>
      <Route path="/inactive-accounts">
        <ProtectedRoute component={InactiveAccounts} allowedRoles={["ADMIN", "PRINCIPAL", "VICE_PRINCIPAL"]} />
      </Route>
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
