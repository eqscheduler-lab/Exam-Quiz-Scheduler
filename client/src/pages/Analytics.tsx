import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Loader2, BarChart3, BookOpen, GraduationCap, FileText, ClipboardList, Trash2, AlertTriangle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";

const COLORS = {
  homework: "#9333ea",
  quiz: "#f59e0b"
};

interface AnalyticsData {
  classId: number;
  className: string;
  subjectId: number;
  subjectName: string;
  examCount: number;
  quizCount: number;
}

export default function Analytics() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  
  const { data: analytics, isLoading } = useQuery<AnalyticsData[]>({
    queryKey: ["/api/analytics"],
  });

  const clearHistoryMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/factory-reset");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/analytics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/exams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/classes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subjects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "History cleared successfully" });
      setIsClearDialogOpen(false);
      setConfirmText("");
    },
    onError: (error: any) => {
      toast({ title: "Failed to clear history", description: error.message, variant: "destructive" });
    }
  });

  const handleClearHistory = () => {
    if (confirmText === "CLEAR ALL DATA") {
      clearHistoryMutation.mutate();
    }
  };

  const isAdmin = user?.role === "ADMIN";
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

  const pieChartData = [
    { name: "Homework", value: totalExams, color: COLORS.homework },
    { name: "Quizzes", value: totalQuizzes, color: COLORS.quiz }
  ].filter(d => d.value > 0);

  const classChartData = classSummary ? Object.entries(classSummary)
    .sort((a, b) => a[1].className.localeCompare(b[1].className))
    .map(([_, data]) => ({
      name: data.className,
      Homework: data.exams,
      Quizzes: data.quizzes
    })) : [];

  const subjectChartData = subjectSummary ? Object.entries(subjectSummary)
    .sort((a, b) => a[1].subjectName.localeCompare(b[1].subjectName))
    .map(([_, data]) => ({
      name: data.subjectName,
      Homework: data.exams,
      Quizzes: data.quizzes
    })) : [];

  return (
    <Layout title="System Analytics">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-primary" />
            <div>
              <h2 className="text-xl font-bold font-display">System Analytics</h2>
              <p className="text-muted-foreground text-sm">Overview of homework and quizzes conducted</p>
            </div>
          </div>
          
          {isAdmin && (
            <Button 
              variant="destructive" 
              size="sm"
              onClick={() => setIsClearDialogOpen(true)}
              data-testid="button-clear-history"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear History
            </Button>
          )}
        </div>

        <Dialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                Clear All History
              </DialogTitle>
              <DialogDescription>
                This action will permanently delete all data including homework, quizzes, subjects, classes, and non-admin users. Admin accounts will be preserved.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                <p className="text-sm text-destructive font-medium">This action cannot be undone!</p>
              </div>
              <div className="space-y-2">
                <Label>Type <span className="font-mono font-bold">CLEAR ALL DATA</span> to confirm</Label>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Type confirmation text..."
                  data-testid="input-confirm-clear"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsClearDialogOpen(false); setConfirmText(""); }}>
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleClearHistory}
                disabled={confirmText !== "CLEAR ALL DATA" || clearHistoryMutation.isPending}
                data-testid="button-confirm-clear"
              >
                {clearHistoryMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Clearing...</>
                ) : (
                  "Clear All Data"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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

            {/* Overview Pie Chart */}
            {pieChartData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Distribution Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {pieChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Class Chart and Table */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GraduationCap className="w-5 h-5" />
                    By Class - Chart
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {classChartData.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={classChartData} layout="vertical" margin={{ left: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="Homework" fill={COLORS.homework} />
                          <Bar dataKey="Quizzes" fill={COLORS.quiz} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No data available</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GraduationCap className="w-5 h-5" />
                    By Class - Table
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
                    By Subject - Table
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

            {/* Subject Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  By Subject - Chart
                </CardTitle>
              </CardHeader>
              <CardContent>
                {subjectChartData.length > 0 ? (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={subjectChartData} margin={{ bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={80} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="Homework" fill={COLORS.homework} />
                        <Bar dataKey="Quizzes" fill={COLORS.quiz} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No data available</p>
                )}
              </CardContent>
            </Card>

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
