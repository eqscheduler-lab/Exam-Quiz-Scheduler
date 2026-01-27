import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useExams } from "@/hooks/use-exams";
import { User, ExamEvent, Subject, Class } from "@shared/schema";
import { Users, BookOpen, FileText, ChevronRight, ArrowLeft, Calendar, Download } from "lucide-react";
import { format, startOfWeek } from "date-fns";

type ExamWithDetails = ExamEvent & { subject: Subject; creator: User; class: Class };

export default function TeacherOverview() {
  const [selectedTeacher, setSelectedTeacher] = useState<User | null>(null);

  const { data: teachers, isLoading: teachersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: allExams, isLoading: examsLoading } = useExams({});

  const teacherList = teachers?.filter(u => 
    u.role === "TEACHER" || u.role === "COORDINATOR"
  ).sort((a, b) => a.name.localeCompare(b.name)) || [];

  const teacherExams: ExamWithDetails[] = selectedTeacher 
    ? (allExams?.filter((e: ExamWithDetails) => e.createdByUserId === selectedTeacher.id) || [])
    : [];

  const homeworkList = teacherExams.filter((e: ExamWithDetails) => e.type === "HOMEWORK");
  const quizList = teacherExams.filter((e: ExamWithDetails) => e.type === "QUIZ");

  if (selectedTeacher) {
    return (
      <Layout title={`${selectedTeacher.name}'s Schedule`}>
        <div className="space-y-6">
          <Button 
            variant="ghost" 
            onClick={() => setSelectedTeacher(null)}
            className="flex items-center gap-2"
            data-testid="button-back-teachers"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Teachers
          </Button>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-2xl">
                {selectedTeacher.name.charAt(0)}
              </div>
              <div>
                <h2 className="text-2xl font-bold font-display">{selectedTeacher.name}</h2>
                <p className="text-muted-foreground">{selectedTeacher.email}</p>
                <Badge variant="secondary" className="mt-1">{selectedTeacher.role}</Badge>
              </div>
            </div>
            <Button
              onClick={() => {
                const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
                const weekStartStr = format(weekStart, 'yyyy-MM-dd');
                window.open(`/api/schedule/teacher-pdf?weekStart=${weekStartStr}&teacherId=${selectedTeacher.id}`, '_blank');
              }}
              data-testid="button-download-teacher-pdf"
            >
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2 text-purple-700 dark:text-purple-300">
                  <FileText className="w-5 h-5" />
                  Total Homework
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-900 dark:text-purple-100">
                  {homeworkList.length}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2 text-amber-700 dark:text-amber-300">
                  <BookOpen className="w-5 h-5" />
                  Total Quizzes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-amber-900 dark:text-amber-100">
                  {quizList.length}
                </div>
              </CardContent>
            </Card>
          </div>

          {examsLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-purple-600" />
                    Homework ({homeworkList.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 max-h-96 overflow-y-auto">
                  {homeworkList.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No homework scheduled</p>
                  ) : (
                    homeworkList.map((exam) => (
                      <div 
                        key={exam.id} 
                        className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                        data-testid={`homework-item-${exam.id}`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium">{exam.title}</h4>
                            <p className="text-sm text-muted-foreground">{exam.subject.name}</p>
                          </div>
                          <Badge variant="outline">{exam.class.name}</Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(exam.date), "MMM d, yyyy")} - Period {exam.period}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-amber-600" />
                    Quizzes ({quizList.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 max-h-96 overflow-y-auto">
                  {quizList.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No quizzes scheduled</p>
                  ) : (
                    quizList.map((exam) => (
                      <div 
                        key={exam.id} 
                        className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                        data-testid={`quiz-item-${exam.id}`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium">{exam.title}</h4>
                            <p className="text-sm text-muted-foreground">{exam.subject.name}</p>
                          </div>
                          <Badge variant="outline">{exam.class.name}</Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(exam.date), "MMM d, yyyy")} - Period {exam.period}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Teacher Overview">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Teaching Staff ({teacherList.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {teachersLoading ? (
              <div className="space-y-3">
                {[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />)}
              </div>
            ) : teacherList.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No teachers found</p>
            ) : (
              <div className="divide-y">
                {teacherList.map((teacher) => (
                  <button
                    key={teacher.id}
                    onClick={() => setSelectedTeacher(teacher)}
                    className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-left rounded-lg"
                    data-testid={`teacher-row-${teacher.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                        {teacher.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-medium">{teacher.name}</h3>
                        <p className="text-sm text-muted-foreground">{teacher.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary">{teacher.role}</Badge>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
