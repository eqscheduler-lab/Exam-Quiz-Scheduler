import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  Download, 
  Shield, 
  GraduationCap, 
  Users,
  BookOpen,
  Calendar,
  BarChart3,
  Settings,
  UserPlus,
  FileUp,
  Clock,
  CheckCircle
} from "lucide-react";

export default function Documentation() {
  const handleDownload = async (type: string) => {
    try {
      const response = await fetch(`/api/documentation/${type}`, {
        credentials: "include"
      });
      
      if (!response.ok) throw new Error("Failed to download");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}-manual.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  const manuals = [
    {
      id: "admin",
      title: "Administrator Manual",
      description: "Complete guide for system administrators including user management, bulk imports, system settings, and analytics.",
      icon: Shield,
      color: "text-red-500",
      bgColor: "bg-red-50 dark:bg-red-950/20",
      borderColor: "border-red-200 dark:border-red-900",
      features: [
        { icon: UserPlus, text: "User Management - Create, edit, and manage staff accounts" },
        { icon: FileUp, text: "Bulk Import - Import staff, subjects, and classes via CSV" },
        { icon: Settings, text: "System Settings - Configure academic year and semesters" },
        { icon: BarChart3, text: "Analytics Dashboard - View utilization and scheduling stats" },
        { icon: Clock, text: "Inactive Accounts - Monitor and manage inactive users" },
        { icon: BookOpen, text: "Subject & Class Management - Organize academic structure" },
      ]
    },
    {
      id: "teacher",
      title: "Teacher Manual",
      description: "Guide for teachers to schedule homework and quizzes, view schedules, and manage their bookings.",
      icon: GraduationCap,
      color: "text-blue-500",
      bgColor: "bg-blue-50 dark:bg-blue-950/20",
      borderColor: "border-blue-200 dark:border-blue-900",
      features: [
        { icon: Calendar, text: "Schedule View - See all scheduled exams and homework" },
        { icon: BookOpen, text: "Create Bookings - Schedule quizzes and homework assignments" },
        { icon: Clock, text: "Bell Schedules - Understand period times for different grades" },
        { icon: CheckCircle, text: "My Bookings - View and cancel your own scheduled items" },
        { icon: FileText, text: "PDF Export - Download schedules for your classes" },
      ]
    },
    {
      id: "principal",
      title: "Principal / Vice Principal Manual",
      description: "Leadership guide for overseeing school scheduling, viewing teacher analytics, and accessing reports.",
      icon: Users,
      color: "text-purple-500",
      bgColor: "bg-purple-50 dark:bg-purple-950/20",
      borderColor: "border-purple-200 dark:border-purple-900",
      features: [
        { icon: BarChart3, text: "Analytics Overview - Monitor staff utilization and trends" },
        { icon: Users, text: "Teacher Overview - View all teacher activities and bookings" },
        { icon: Calendar, text: "Master Schedule - Access complete school-wide schedule" },
        { icon: FileText, text: "Reports - Generate and export scheduling reports" },
        { icon: BookOpen, text: "Class Monitoring - Track homework and quiz distribution" },
      ]
    }
  ];

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-5xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl font-bold font-display">Documentation</h1>
            <p className="text-muted-foreground mt-2">
              Download user manuals and guides for the Exam & Quiz Scheduler system
            </p>
          </div>

          <div className="grid gap-6">
            {manuals.map((manual) => (
              <Card key={manual.id} className={`${manual.bgColor} ${manual.borderColor} border-2`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-xl bg-white dark:bg-background shadow-sm`}>
                        <manual.icon className={`w-8 h-8 ${manual.color}`} />
                      </div>
                      <div>
                        <CardTitle className="text-xl flex items-center gap-2">
                          {manual.title}
                          <Badge variant="secondary" className="text-xs">PDF</Badge>
                        </CardTitle>
                        <CardDescription className="mt-1 text-base">
                          {manual.description}
                        </CardDescription>
                      </div>
                    </div>
                    <Button 
                      onClick={() => handleDownload(manual.id)}
                      className="shrink-0"
                      data-testid={`button-download-${manual.id}`}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download PDF
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <h4 className="font-semibold text-sm mb-3 text-muted-foreground uppercase tracking-wide">
                    What's Covered
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {manual.features.map((feature, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm">
                        <feature.icon className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                        <span>{feature.text}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Quick Reference
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-2">Booking Limits</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Quiz: Maximum 1 per class per day</li>
                    <li>• Homework: Unlimited per day</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Period Schedule</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Monday-Thursday: 8 periods</li>
                    <li>• Friday: 4 periods</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">User Roles</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Admin: Full system access</li>
                    <li>• Principal/VP: View all, manage reports</li>
                    <li>• Coordinator: Enhanced teacher access</li>
                    <li>• Teacher: Create and manage own bookings</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Grade Levels</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• G9-10: Separate bell schedule</li>
                    <li>• G11-12: Separate bell schedule</li>
                    <li>• All times in Asia/Dubai timezone</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
