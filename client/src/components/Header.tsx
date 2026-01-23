import { useAuth } from "@/hooks/use-auth";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Header({ title }: { title: string }) {
  const { user } = useAuth();

  return (
    <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10 px-8 flex items-center justify-between">
      <h1 className="font-display font-bold text-xl text-foreground">{title}</h1>
      
      <div className="flex items-center gap-4">
        <div className="text-sm text-right hidden sm:block">
          <p className="text-muted-foreground">Today is</p>
          <p className="font-medium">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="h-8 w-px bg-border hidden sm:block"></div>
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-background"></span>
        </Button>
      </div>
    </header>
  );
}
