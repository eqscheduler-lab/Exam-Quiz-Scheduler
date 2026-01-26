import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, BarChart3, BookOpen, GraduationCap, FileText, ClipboardList } from "lucide-react";

interface AnalyticsData {
  classId: number;
  className: string;
  subjectId: number;
  subjectName: string;
  examCount: number;
  quizCount: number;
}

export default function Analytics() {
  const { data: analytics, isLoading } = useQuery<AnalyticsData[]>({
    queryKey: ["/api/analytics"],
  });

  const totalExams = analytics?.reduce((sum, a) => sum + a.examCount, 0) || 0;
  const totalQuizzes = analytics?.reduce((sum, a) => sum + a.quizCount, 0) || 0;
  const uniqueClasses = new Set(analytics?.map(a => a.classId)).size;
  const uniqueSubjects = new Set(analytics?.map(a => a.subjectId)).size;

  const classSummary = analytics?.reduce((acc, a) => {
    if (!acc[a.classId]) {
      acc[a.classId] = { className: a.className, exams: 0, quizzes: 0 };
    }
    acc[a.classId].exams += a.examCount;
    acc[a.classId].quizzes += a.quizCount;
    return acc;
  }, {} as Record<number, { className: string; exams: number; quizzes: number }>);

  const subjectSummary = analytics?.reduce((acc, a) => {
    if (!acc[a.subjectId]) {
      acc[a.subjectId] = { subjectName: a.subjectName, exams: 0, quizzes: 0 };
    }
    acc[a.subjectId].exams += a.examCount;
    acc[a.subjectId].quizzes += a.quizCount;
    return acc;
  }, {} as Record<number, { subjectName: string; exams: number; quizzes: number }>);

  return (
    <Layout title="System Analytics">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-primary" />
          <div>
            <h2 className="text-xl font-bold font-display">System Analytics</h2>
            <p className="text-muted-foreground text-sm">Overview of exams and quizzes conducted</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Homework</p>
                      <p className="text-2xl font-bold" data-testid="text-total-homework">{totalExams}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10">
                      <ClipboardList className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Quizzes</p>
                      <p className="text-2xl font-bold" data-testid="text-total-quizzes">{totalQuizzes}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-500/10">
                      <GraduationCap className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Classes</p>
                      <p className="text-2xl font-bold" data-testid="text-total-classes">{uniqueClasses}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <BookOpen className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Subjects</p>
                      <p className="text-2xl font-bold" data-testid="text-total-subjects">{uniqueSubjects}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GraduationCap className="w-5 h-5" />
                    By Class
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Class</TableHead>
                        <TableHead className="text-right">Homework</TableHead>
                        <TableHead className="text-right">Quizzes</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {classSummary && Object.entries(classSummary)
                        .sort((a, b) => a[1].className.localeCompare(b[1].className))
                        .map(([id, data]) => (
                        <TableRow key={id} data-testid={`row-class-${id}`}>
                          <TableCell className="font-medium">{data.className}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary">{data.exams}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline">{data.quizzes}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-bold">{data.exams + data.quizzes}</TableCell>
                        </TableRow>
                      ))}
                      {(!classSummary || Object.keys(classSummary).length === 0) && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                            No data available
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5" />
                    By Subject
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Subject</TableHead>
                        <TableHead className="text-right">Homework</TableHead>
                        <TableHead className="text-right">Quizzes</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subjectSummary && Object.entries(subjectSummary)
                        .sort((a, b) => a[1].subjectName.localeCompare(b[1].subjectName))
                        .map(([id, data]) => (
                        <TableRow key={id} data-testid={`row-subject-${id}`}>
                          <TableCell className="font-medium">{data.subjectName}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary">{data.exams}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline">{data.quizzes}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-bold">{data.exams + data.quizzes}</TableCell>
                        </TableRow>
                      ))}
                      {(!subjectSummary || Object.keys(subjectSummary).length === 0) && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                            No data available
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Detailed Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Class</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead className="text-right">Homework</TableHead>
                      <TableHead className="text-right">Quizzes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analytics?.map((item, idx) => (
                      <TableRow key={`${item.classId}-${item.subjectId}`} data-testid={`row-detail-${idx}`}>
                        <TableCell className="font-medium">{item.className}</TableCell>
                        <TableCell>{item.subjectName}</TableCell>
                        <TableCell className="text-right">{item.examCount}</TableCell>
                        <TableCell className="text-right">{item.quizCount}</TableCell>
                      </TableRow>
                    ))}
                    {(!analytics || analytics.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          No homework or quizzes have been scheduled yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
