import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { 
  Calendar, 
  BookOpen, 
  Users, 
  LayoutDashboard, 
  LogOut, 
  GraduationCap 
} from "lucide-react";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  
  if (!user) return null;

  const isActive = (path: string) => location === path;

  const isAdmin = ["ADMIN", "PRINCIPAL", "VICE_PRINCIPAL"].includes(user.role);
  const isTeacher = user.role === "TEACHER" || user.role === "COORDINATOR";

  return (
    <div className="h-screen w-64 bg-card border-r border-border flex flex-col fixed left-0 top-0 z-20 shadow-xl shadow-black/5">
      <div className="p-6 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg">
            <GraduationCap className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg leading-none">ExamScheduler</h1>
            <p className="text-xs text-muted-foreground mt-1">Academic Portal</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Main
        </div>
        
        <Link href="/" className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
          isActive("/") 
            ? "bg-primary/10 text-primary shadow-sm" 
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}>
          <LayoutDashboard className="w-4 h-4" />
          Dashboard
        </Link>

        <Link href="/schedule" className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
          isActive("/schedule") 
            ? "bg-primary/10 text-primary shadow-sm" 
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}>
          <Calendar className="w-4 h-4" />
          Master Schedule
        </Link>

        {isTeacher && (
          <Link href="/my-exams" className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
            isActive("/my-exams") 
              ? "bg-primary/10 text-primary shadow-sm" 
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}>
            <BookOpen className="w-4 h-4" />
            My Exams
          </Link>
        )}

        {isAdmin && (
          <>
            <div className="px-3 py-2 mt-6 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Administration
            </div>
            
            <Link href="/admin/users" className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
              isActive("/admin/users") 
                ? "bg-primary/10 text-primary shadow-sm" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}>
              <Users className="w-4 h-4" />
              Manage Staff
            </Link>

            <Link href="/admin/subjects" className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
              isActive("/admin/subjects") 
                ? "bg-primary/10 text-primary shadow-sm" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}>
              <BookOpen className="w-4 h-4" />
              Manage Subjects
            </Link>

            <Link href="/admin/classes" className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
              isActive("/admin/classes") 
                ? "bg-primary/10 text-primary shadow-sm" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}>
              <GraduationCap className="w-4 h-4" />
              Manage Classes
            </Link>
          </>
        )}
      </nav>

      <div className="p-4 border-t border-border/50 bg-muted/20">
        <div className="flex items-center gap-3 px-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
            {user.name.charAt(0)}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate capitalize">{user.role.toLowerCase()}</p>
          </div>
        </div>
        <button
          onClick={() => logout()}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
