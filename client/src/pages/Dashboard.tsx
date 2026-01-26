import { useAuth } from "@/hooks/use-auth";
import { useExams } from "@/hooks/use-exams";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, CheckCircle, Clock, BookOpen, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";

export default function Dashboard() {
  const { user } = useAuth();
  
  // Fetch exams for today for the current user (if teacher) or all (if admin/leadership)
  const today = new Date();
  const weekStart = format(today, "yyyy-MM-dd"); // Use a stable string for key
  const isTeacher = user?.role === "TEACHER";
  
  const { data: exams, isLoading } = useExams({
    weekStart: weekStart,
    teacherId: isTeacher ? user?.id : undefined,
  });

  const todaysExams = exams?.filter(e => {
    const examDate = new Date(e.date);
    return examDate.getDate() === today.getDate() && 
           examDate.getMonth() === today.getMonth() &&
           examDate.getFullYear() === today.getFullYear();
  }) || [];

  const upcomingExams = exams?.filter(e => new Date(e.date) > today).slice(0, 5) || [];

  return (
    <Layout title="Dashboard">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-none shadow-lg shadow-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium opacity-90">Today's Exams</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold font-display">{todaysExams.length}</div>
            <p className="text-sm opacity-80 mt-1">Scheduled for today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Quick Action</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Link href="/schedule">
              <Button className="w-full mt-2" variant="outline">View Master Schedule</Button>
            </Link>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">System Status</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display">Active</div>
            <p className="text-xs text-muted-foreground mt-1">Fall Semester 2024</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold font-display">Today's Schedule</h2>
            <span className="text-sm text-muted-foreground">{format(today, "MMMM d, yyyy")}</span>
          </div>

          {isLoading ? (
            <div className="space-y-3">
               {[1,2,3].map(i => <div key={i} className="h-24 bg-muted/50 rounded-xl animate-pulse" />)}
            </div>
          ) : todaysExams.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                <div className="p-3 bg-muted rounded-full mb-3">
                  <Clock className="w-6 h-6 text-muted-foreground" />
                </div>
                <h3 className="font-medium text-foreground">No exams scheduled today</h3>
                <p className="text-sm text-muted-foreground mt-1">Enjoy the free day!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {todaysExams.map((exam) => (
                <div key={exam.id} className="group relative bg-card p-4 rounded-xl border border-border shadow-sm hover:shadow-md transition-all duration-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                          Period {exam.period}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {exam.classProgram} - {exam.section}
                        </span>
                      </div>
                      <h3 className="font-bold text-lg">{exam.subject.name}</h3>
                      <p className="text-sm text-muted-foreground">{exam.title}</p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-2 py-1 rounded-md text-xs font-semibold ${
                        exam.type === 'EXAM' 
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' 
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                      }`}>
                        {exam.type}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-2 text-xs text-muted-foreground">
                    <BookOpen className="w-3 h-3" />
                    <span>Proctor: {exam.creator.name}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <h2 className="text-xl font-bold font-display">Upcoming This Week</h2>
          
          <Card>
             <CardContent className="p-0">
               {upcomingExams.length === 0 ? (
                 <div className="p-8 text-center text-muted-foreground">No upcoming exams found.</div>
               ) : (
                 <div className="divide-y divide-border">
                   {upcomingExams.map((exam) => (
                     <div key={exam.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                       <div className="flex items-center gap-4">
                         <div className="flex flex-col items-center justify-center w-12 h-12 bg-primary/5 rounded-lg border border-primary/10">
                            <span className="text-xs font-bold text-primary uppercase">{format(new Date(exam.date), "MMM")}</span>
                            <span className="text-lg font-bold leading-none text-foreground">{format(new Date(exam.date), "d")}</span>
                         </div>
                         <div>
                           <p className="font-medium text-foreground">{exam.subject.name}</p>
                           <p className="text-xs text-muted-foreground">{exam.classProgram}-{exam.section} • Period {exam.period}</p>
                         </div>
                       </div>
                       <div className="text-sm font-medium text-muted-foreground">
                         {format(new Date(exam.date), "EEEE")}
                       </div>
                     </div>
                   ))}
                 </div>
               )}
             </CardContent>
          </Card>

          {user?.role === 'ADMIN' && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <h4 className="font-semibold text-amber-800 dark:text-amber-400 text-sm">Admin Notice</h4>
                <p className="text-sm text-amber-700 dark:text-amber-500 mt-1">
                  End of term schedule finalization is due next Friday. Please review all subject allocations.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
