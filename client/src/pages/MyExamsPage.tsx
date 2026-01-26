import { useAuth } from "@/hooks/use-auth";
import { useExams } from "@/hooks/use-exams";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { ExamDialog } from "@/components/ExamDialog";
import { format } from "date-fns";
import { Calendar, Clock, Loader2, FileEdit } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MyExamsPage() {
  const { user } = useAuth();
  
  // Fetch ALL exams, then filter client side for MVP (ideally API filters by teacherId)
  // Our API route schema supports teacherId filter
  const { data: exams, isLoading } = useExams({
    teacherId: user?.id
  });

  return (
    <Layout title="My Exams">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
             <h2 className="text-lg font-semibold">Managed Assessments</h2>
             <p className="text-muted-foreground text-sm">Exams and quizzes created by you</p>
          </div>
          <ExamDialog mode="create" />
        </div>

        {isLoading ? (
           <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>
        ) : !exams || exams.length === 0 ? (
           <div className="text-center p-12 border-2 border-dashed border-border rounded-xl">
             <p className="text-muted-foreground">You haven't scheduled any exams yet.</p>
           </div>
        ) : (
          <div className="grid gap-4">
            {exams.map((exam) => (
              <Card key={exam.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6 flex items-center justify-between">
                  <div className="flex gap-6 items-center">
                    <div className="flex flex-col items-center justify-center w-16 h-16 bg-muted rounded-xl border border-border">
                        <span className="text-xs font-bold uppercase text-muted-foreground">{format(new Date(exam.date), "MMM")}</span>
                        <span className="text-2xl font-bold text-foreground">{format(new Date(exam.date), "d")}</span>
                    </div>
                    
                    <div>
                      <h3 className="font-bold text-lg text-foreground">{exam.subject.name} <span className="text-muted-foreground font-normal">({exam.subject.code})</span></h3>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>Period {exam.period}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="px-1.5 py-0.5 rounded-md bg-muted text-foreground font-medium text-xs">
                            {exam.classProgram}-{exam.section}
                          </span>
                        </div>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-medium",
                          exam.type === 'HOMEWORK' ? "bg-purple-100 text-purple-700" : "bg-amber-100 text-amber-700"
                        )}>
                          {exam.type}
                        </span>
                      </div>
                    </div>
                  </div>

                  <ExamDialog 
                    mode="edit" 
                    examId={exam.id}
                    defaultValues={exam}
                    trigger={
                      <button className="p-2 hover:bg-muted rounded-full transition-colors">
                        <FileEdit className="w-5 h-5 text-muted-foreground hover:text-primary" />
                      </button>
                    } 
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
