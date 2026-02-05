import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
  DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { 
  Plus, 
  Download, 
  Check, 
  X, 
  Edit, 
  Trash2, 
  Send,
  FileText,
  Users,
  ExternalLink,
  Loader2,
  CheckCircle,
  Mail,
  XCircle,
  ClipboardCheck
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

type Term = "TERM_1" | "TERM_2" | "TERM_3";
type Status = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";

interface LearningSummary {
  id: number;
  term: Term;
  weekNumber: number;
  grade: string;
  classId: number;
  subjectId: number;
  teacherId: number;
  upcomingTopics: string | null;
  quizDay: string | null;
  quizDate: string | null;
  quizTime: string | null;
  status: Status;
  approvedById: number | null;
  approvalComments: string | null;
  linkedExamId: number | null;
  class: { id: number; name: string };
  subject: { id: number; name: string; code: string };
  teacher: { id: number; name: string };
  createdAt: string;
  updatedAt: string;
}

interface LearningSupport {
  id: number;
  term: Term;
  weekNumber: number;
  grade: string;
  classId: number;
  subjectId: number;
  teacherId: number;
  sessionType: string | null;
  teamsLink: string | null;
  location: string | null;
  sapetDay: string | null;
  sapetDate: string | null;
  sapetTime: string | null;
  status: Status;
  approvedById: number | null;
  approvalComments: string | null;
  class: { id: number; name: string };
  subject: { id: number; name: string; code: string };
  teacher: { id: number; name: string };
  createdAt: string;
  updatedAt: string;
}

interface ClassItem {
  id: number;
  name: string;
  grade?: string;
}

interface Subject {
  id: number;
  name: string;
  code: string;
}

interface Student {
  id: number;
  name: string;
  studentId: string;
  classId: number;
}

interface AttendanceRecord {
  id: number;
  learningSupportId: number;
  studentId: number;
  status: "PRESENT" | "ABSENT";
  student: Student;
}

const TERMS: { value: Term; label: string }[] = [
  { value: "TERM_1", label: "Term 1" },
  { value: "TERM_2", label: "Term 2" },
  { value: "TERM_3", label: "Term 3" },
];

const WEEKS = Array.from({ length: 15 }, (_, i) => i + 1);

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const getStatusBadge = (status: Status) => {
  switch (status) {
    case "DRAFT":
      return <Badge variant="secondary">Draft</Badge>;
    case "PENDING_APPROVAL":
      return <Badge variant="outline" className="text-amber-600 border-amber-600">Pending</Badge>;
    case "APPROVED":
      return <Badge className="bg-green-600">Approved</Badge>;
    case "REJECTED":
      return <Badge variant="destructive">Rejected</Badge>;
  }
};

export default function AcademicPlanningHub() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [selectedTerm, setSelectedTerm] = useState<Term>("TERM_1");
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [activeTab, setActiveTab] = useState("summaries");
  
  const [summaryDialogOpen, setSummaryDialogOpen] = useState(false);
  const [supportDialogOpen, setSupportDialogOpen] = useState(false);
  const [editingSummary, setEditingSummary] = useState<LearningSummary | null>(null);
  const [editingSupport, setEditingSupport] = useState<LearningSupport | null>(null);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [approvalAction, setApprovalAction] = useState<{ type: "summary" | "support"; id: number; action: "approve" | "reject" } | null>(null);
  const [approvalComments, setApprovalComments] = useState("");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailAddresses, setEmailAddresses] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailType, setEmailType] = useState<"summaries" | "support">("support");
  const [supportSessionType, setSupportSessionType] = useState<string>("");
  const [sapetDate, setSapetDate] = useState<string>("");
  const [sapetDateError, setSapetDateError] = useState<string>("");
  const [attendanceDialogOpen, setAttendanceDialogOpen] = useState(false);
  const [attendanceSession, setAttendanceSession] = useState<LearningSupport | null>(null);
  const [attendanceData, setAttendanceData] = useState<Record<number, "PRESENT" | "ABSENT">>({});

  const canApprove = user?.role === "ADMIN" || user?.role === "VICE_PRINCIPAL" || user?.role === "PRINCIPAL" || user?.role === "LEAD_TEACHER";
  const isAdmin = user?.role === "ADMIN";

  const { data: summaries = [], isLoading: summariesLoading } = useQuery<LearningSummary[]>({
    queryKey: [`/api/learning-summaries?term=${selectedTerm}&weekNumber=${selectedWeek}`],
  });

  const { data: support = [], isLoading: supportLoading } = useQuery<LearningSupport[]>({
    queryKey: [`/api/learning-support?term=${selectedTerm}&weekNumber=${selectedWeek}`],
  });

  const { data: classes = [] } = useQuery<ClassItem[]>({
    queryKey: ["/api/classes"]
  });

  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ["/api/subjects"]
  });

  const { data: attendanceStudents = [], isLoading: studentsLoading } = useQuery<Student[]>({
    queryKey: ["/api/learning-support", attendanceSession?.id, "students"],
    queryFn: async () => {
      if (!attendanceSession) return [];
      const res = await fetch(`/api/learning-support/${attendanceSession.id}/students`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch students");
      return res.json();
    },
    enabled: !!attendanceSession
  });

  const { data: existingAttendance = [], isLoading: attendanceLoading } = useQuery<AttendanceRecord[]>({
    queryKey: ["/api/learning-support", attendanceSession?.id, "attendance"],
    queryFn: async () => {
      if (!attendanceSession) return [];
      const res = await fetch(`/api/learning-support/${attendanceSession.id}/attendance`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch attendance");
      return res.json();
    },
    enabled: !!attendanceSession
  });

  const invalidateSummaries = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/learning-summaries?term=${selectedTerm}&weekNumber=${selectedWeek}`] });
  };

  const invalidateSupport = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/learning-support?term=${selectedTerm}&weekNumber=${selectedWeek}`] });
  };

  const createSummaryMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/learning-summaries", data),
    onSuccess: () => {
      invalidateSummaries();
      toast({ title: "Learning summary created" });
      setSummaryDialogOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Failed to create", description: err.message, variant: "destructive" });
    }
  });

  const updateSummaryMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/learning-summaries/${id}`, data),
    onSuccess: () => {
      invalidateSummaries();
      toast({ title: "Learning summary updated" });
      setSummaryDialogOpen(false);
      setEditingSummary(null);
    }
  });

  const deleteSummaryMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/learning-summaries/${id}`),
    onSuccess: () => {
      invalidateSummaries();
      toast({ title: "Learning summary deleted" });
    }
  });

  const submitSummaryMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/learning-summaries/${id}/submit`),
    onSuccess: () => {
      invalidateSummaries();
      toast({ title: "Submitted for approval" });
    }
  });

  const approveSummaryMutation = useMutation({
    mutationFn: ({ id, comments }: { id: number; comments?: string }) => 
      apiRequest("POST", `/api/learning-summaries/${id}/approve`, { comments }),
    onSuccess: () => {
      invalidateSummaries();
      toast({ title: "Approved successfully" });
      setApprovalDialogOpen(false);
      setApprovalAction(null);
    }
  });

  const rejectSummaryMutation = useMutation({
    mutationFn: ({ id, comments }: { id: number; comments?: string }) => 
      apiRequest("POST", `/api/learning-summaries/${id}/reject`, { comments }),
    onSuccess: () => {
      invalidateSummaries();
      toast({ title: "Rejected" });
      setApprovalDialogOpen(false);
      setApprovalAction(null);
    }
  });

  const createSupportMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/learning-support", data),
    onSuccess: () => {
      invalidateSupport();
      toast({ title: "Learning support created" });
      setSupportDialogOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Failed to create", description: err.message, variant: "destructive" });
    }
  });

  const updateSupportMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/learning-support/${id}`, data),
    onSuccess: () => {
      invalidateSupport();
      toast({ title: "Learning support updated" });
      setSupportDialogOpen(false);
      setEditingSupport(null);
    }
  });

  const deleteSupportMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/learning-support/${id}`),
    onSuccess: () => {
      invalidateSupport();
      toast({ title: "Learning support deleted" });
    }
  });

  const saveAttendanceMutation = useMutation({
    mutationFn: ({ sessionId, attendance }: { sessionId: number; attendance: { studentId: number; status: "PRESENT" | "ABSENT" }[] }) => 
      apiRequest("POST", `/api/learning-support/${sessionId}/attendance`, { attendance }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/learning-support", attendanceSession?.id, "attendance"] });
      toast({ title: "Attendance saved successfully" });
      setAttendanceDialogOpen(false);
      setAttendanceSession(null);
      setAttendanceData({});
    },
    onError: (err: any) => {
      toast({ title: "Failed to save attendance", description: err.message, variant: "destructive" });
    }
  });

  const submitSupportMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/learning-support/${id}/submit`),
    onSuccess: () => {
      invalidateSupport();
      toast({ title: "Submitted for approval" });
    }
  });

  const approveSupportMutation = useMutation({
    mutationFn: ({ id, comments }: { id: number; comments?: string }) => 
      apiRequest("POST", `/api/learning-support/${id}/approve`, { comments }),
    onSuccess: () => {
      invalidateSupport();
      toast({ title: "Approved successfully" });
      setApprovalDialogOpen(false);
      setApprovalAction(null);
    }
  });

  const rejectSupportMutation = useMutation({
    mutationFn: ({ id, comments }: { id: number; comments?: string }) => 
      apiRequest("POST", `/api/learning-support/${id}/reject`, { comments }),
    onSuccess: () => {
      invalidateSupport();
      toast({ title: "Rejected" });
      setApprovalDialogOpen(false);
      setApprovalAction(null);
    }
  });

  const handleApprovalSubmit = () => {
    if (!approvalAction) return;
    
    if (approvalAction.type === "summary") {
      if (approvalAction.action === "approve") {
        approveSummaryMutation.mutate({ id: approvalAction.id, comments: approvalComments });
      } else {
        rejectSummaryMutation.mutate({ id: approvalAction.id, comments: approvalComments });
      }
    } else {
      if (approvalAction.action === "approve") {
        approveSupportMutation.mutate({ id: approvalAction.id, comments: approvalComments });
      } else {
        rejectSupportMutation.mutate({ id: approvalAction.id, comments: approvalComments });
      }
    }
  };

  const handleSummarySubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      term: selectedTerm,
      weekNumber: selectedWeek,
      grade: formData.get("grade") as string,
      classId: Number(formData.get("classId")),
      subjectId: Number(formData.get("subjectId")),
      upcomingTopics: formData.get("upcomingTopics") as string || null,
      quizDay: formData.get("quizDay") as string || null,
      quizDate: formData.get("quizDate") as string || null,
      quizTime: formData.get("quizTime") as string || null,
    };

    if (editingSummary) {
      updateSummaryMutation.mutate({ id: editingSummary.id, data });
    } else {
      createSummaryMutation.mutate(data);
    }
  };

  const openAttendanceDialog = (session: LearningSupport) => {
    setAttendanceSession(session);
    setAttendanceData({});
    setAttendanceDialogOpen(true);
  };

  const handleSaveAttendance = () => {
    if (!attendanceSession) return;
    
    const attendance = attendanceStudents.map(student => ({
      studentId: student.id,
      status: attendanceData[student.id] || "ABSENT" as const
    }));
    
    saveAttendanceMutation.mutate({
      sessionId: attendanceSession.id,
      attendance
    });
  };

  // Initialize attendance data when existing records are loaded
  const attendanceSessionId = attendanceSession?.id;
  const existingAttendanceLength = existingAttendance.length;
  
  // Using a ref-like approach to track if we've initialized for this session
  const [initializedForSession, setInitializedForSession] = useState<number | null>(null);
  
  if (attendanceSessionId && existingAttendanceLength > 0 && initializedForSession !== attendanceSessionId) {
    const data: Record<number, "PRESENT" | "ABSENT"> = {};
    existingAttendance.forEach(record => {
      data[record.studentId] = record.status;
    });
    setAttendanceData(data);
    setInitializedForSession(attendanceSessionId);
  }
  
  // Reset initialization tracker when dialog closes
  if (!attendanceDialogOpen && initializedForSession !== null) {
    setInitializedForSession(null);
  }

  const handleSupportSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const teamsLink = formData.get("teamsLink") as string || null;
    
    if (teamsLink && !/^https?:\/\/.+/i.test(teamsLink)) {
      toast({ title: "Invalid Teams link", description: "Please enter a valid URL starting with http:// or https://", variant: "destructive" });
      return;
    }
    
    if (sapetDateError) {
      toast({ title: "Invalid date", description: "Please select a Saturday or Sunday for SAPET Date", variant: "destructive" });
      return;
    }
    
    const data = {
      term: selectedTerm,
      weekNumber: selectedWeek,
      grade: formData.get("grade") as string,
      classId: Number(formData.get("classId")),
      subjectId: Number(formData.get("subjectId")),
      sessionType: formData.get("sessionType") as string || null,
      teamsLink,
      sapetDay: formData.get("sapetDay") as string || null,
      sapetDate: formData.get("sapetDate") as string || null,
      sapetTime: formData.get("sapetTime") as string || null,
    };

    if (editingSupport) {
      updateSupportMutation.mutate({ id: editingSupport.id, data });
    } else {
      createSupportMutation.mutate(data);
    }
  };

  const exportPdf = (type: "summaries" | "support") => {
    const url = `/api/academic-planning/pdf/${type}?term=${selectedTerm}&weekNumber=${selectedWeek}`;
    window.open(url, '_blank');
  };

  const sendTimetableEmail = async () => {
    if (!emailAddresses.trim()) {
      toast({ title: "Error", description: "Please enter at least one email address", variant: "destructive" });
      return;
    }
    
    const emails = emailAddresses.split(/[,;\n]/).map(e => e.trim()).filter(e => e);
    if (emails.length === 0) {
      toast({ title: "Error", description: "Please enter valid email addresses", variant: "destructive" });
      return;
    }
    
    setEmailSending(true);
    try {
      const endpoint = emailType === "summaries" 
        ? "/api/learning-summaries/email" 
        : "/api/learning-support/email-timetable";
      await apiRequest("POST", endpoint, {
        emails,
        term: selectedTerm,
        weekNumber: selectedWeek
      });
      toast({ title: "Success", description: `${emailType === "summaries" ? "Summaries" : "Timetable"} sent to ${emails.length} email(s)` });
      setEmailDialogOpen(false);
      setEmailAddresses("");
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to send email", variant: "destructive" });
    } finally {
      setEmailSending(false);
    }
  };

  const openEmailDialog = (type: "summaries" | "support") => {
    setEmailType(type);
    setEmailDialogOpen(true);
  };

  const pendingSummaries = summaries.filter(s => s.status === "PENDING_APPROVAL").length;
  const pendingSupport = support.filter(s => s.status === "PENDING_APPROVAL").length;

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      <main className="ml-64 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">Academic Planning Hub</h1>
              <p className="text-muted-foreground">Manage learning summaries and support schedules</p>
            </div>
            
            <div className="flex items-center gap-4">
              <Select value={selectedTerm} onValueChange={(v) => setSelectedTerm(v as Term)}>
                <SelectTrigger className="w-32" data-testid="select-term">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TERMS.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={String(selectedWeek)} onValueChange={(v) => setSelectedWeek(Number(v))}>
                <SelectTrigger className="w-28" data-testid="select-week">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKS.map(w => (
                    <SelectItem key={w} value={String(w)}>Week {w}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {canApprove && (pendingSummaries > 0 || pendingSupport > 0) && (
            <Card className="mb-6 border-amber-500 bg-amber-50 dark:bg-amber-950/20">
              <CardContent className="py-4">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-500">
                  <FileText className="w-4 h-4" />
                  <span className="font-medium">
                    {pendingSummaries + pendingSupport} entries pending approval
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="summaries" data-testid="tab-summaries">
                <FileText className="w-4 h-4 mr-2" />
                Learning Summaries
              </TabsTrigger>
              <TabsTrigger value="support" data-testid="tab-support">
                <Users className="w-4 h-4 mr-2" />
                Learning Support (SAPET)
              </TabsTrigger>
              {canApprove && (
                <TabsTrigger value="pending" data-testid="tab-pending">
                  <Check className="w-4 h-4 mr-2" />
                  Pending Approvals
                  {(pendingSummaries + pendingSupport) > 0 && (
                    <Badge variant="destructive" className="ml-2">{pendingSummaries + pendingSupport}</Badge>
                  )}
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="summaries">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <CardTitle>Learning Summaries</CardTitle>
                  <div className="flex gap-2">
                    {canApprove && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEmailDialog("summaries")}
                          data-testid="button-email-summaries"
                        >
                          <Mail className="w-4 h-4 mr-2" />
                          Email Report
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => exportPdf("summaries")}
                          data-testid="button-export-summaries"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Export PDF
                        </Button>
                      </>
                    )}
                    <Dialog open={summaryDialogOpen} onOpenChange={(open) => {
                      setSummaryDialogOpen(open);
                      if (!open) setEditingSummary(null);
                    }}>
                      <DialogTrigger asChild>
                        <Button size="sm" data-testid="button-add-summary">
                          <Plus className="w-4 h-4 mr-2" />
                          Add Entry
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>
                            {editingSummary ? "Edit" : "Add"} Learning Summary
                          </DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSummarySubmit}>
                          <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="term">Term</Label>
                                <Select name="term" defaultValue={editingSummary?.term || selectedTerm}>
                                  <SelectTrigger data-testid="input-term">
                                    <SelectValue placeholder="Select term" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="TERM_1">Term 1</SelectItem>
                                    <SelectItem value="TERM_2">Term 2</SelectItem>
                                    <SelectItem value="TERM_3">Term 3</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="weekNumber">Week</Label>
                                <Select name="weekNumber" defaultValue={editingSummary?.weekNumber?.toString() || selectedWeek.toString()}>
                                  <SelectTrigger data-testid="input-week">
                                    <SelectValue placeholder="Select week" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Array.from({ length: 15 }, (_, i) => i + 1).map(w => (
                                      <SelectItem key={w} value={w.toString()}>Week {w}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="grade">Grade</Label>
                                <Select name="grade" defaultValue={editingSummary?.grade || ""}>
                                  <SelectTrigger data-testid="input-grade">
                                    <SelectValue placeholder="Select grade" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {["9", "10", "11", "12"].map(g => (
                                      <SelectItem key={g} value={g}>Grade {g}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="classId">Class</Label>
                                <Select name="classId" defaultValue={editingSummary?.classId?.toString() || ""}>
                                  <SelectTrigger data-testid="input-class">
                                    <SelectValue placeholder="Select class" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {classes.map(c => (
                                      <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="subjectId">Subject</Label>
                              <Select name="subjectId" defaultValue={editingSummary?.subjectId?.toString() || ""}>
                                <SelectTrigger data-testid="input-subject">
                                  <SelectValue placeholder="Select subject" />
                                </SelectTrigger>
                                <SelectContent>
                                  {subjects.map(s => (
                                    <SelectItem key={s.id} value={s.id.toString()}>{s.code} - {s.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="upcomingTopics">Upcoming Topics</Label>
                              <Textarea 
                                name="upcomingTopics"
                                defaultValue={editingSummary?.upcomingTopics || ""}
                                placeholder="Enter topics for the upcoming week..."
                                data-testid="input-topics"
                              />
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="quizDay">Quiz Day</Label>
                                <Select name="quizDay" defaultValue={editingSummary?.quizDay || ""}>
                                  <SelectTrigger data-testid="input-quiz-day">
                                    <SelectValue placeholder="Day" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {DAYS.map(d => (
                                      <SelectItem key={d} value={d}>{d}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="quizDate">Quiz Date</Label>
                                <Input 
                                  type="date"
                                  name="quizDate"
                                  defaultValue={editingSummary?.quizDate || ""}
                                  data-testid="input-quiz-date"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="quizTime">Period</Label>
                                <Select name="quizTime" defaultValue={editingSummary?.quizTime || ""}>
                                  <SelectTrigger data-testid="input-quiz-period">
                                    <SelectValue placeholder="Period" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {[1, 2, 3, 4, 5, 6, 7, 8].map(p => (
                                      <SelectItem key={p} value={p.toString()}>Period {p}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button type="submit" data-testid="button-save-summary">
                              {editingSummary ? "Update" : "Create"}
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
              </CardHeader>
              <CardContent>
                {summariesLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : summaries.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No learning summaries for this week. Click "Add Entry" to create one.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Grade</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Topics</TableHead>
                        <TableHead>Quiz</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summaries.map((s) => {
                        const cls = classes.find(c => c.id === s.classId);
                        const subj = subjects.find(sub => sub.id === s.subjectId);
                        const isOwner = s.teacherId === user?.id;
                        return (
                          <TableRow key={s.id} data-testid={`row-summary-${s.id}`}>
                            <TableCell>Grade {s.grade}</TableCell>
                            <TableCell>{cls?.name || "-"}</TableCell>
                            <TableCell>{subj?.code || "-"}</TableCell>
                            <TableCell className="max-w-[200px] truncate">{s.upcomingTopics || "-"}</TableCell>
                            <TableCell>
                              {s.quizDay ? (
                                <span>{s.quizDay}{s.quizTime ? ` P${s.quizTime}` : ""}</span>
                              ) : "-"}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(s.status)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                {isOwner && s.status === "DRAFT" && (
                                  <>
                                    <Button 
                                      size="icon" 
                                      variant="ghost"
                                      onClick={() => { setEditingSummary(s); setSummaryDialogOpen(true); }}
                                      data-testid={`button-edit-summary-${s.id}`}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                      size="icon" 
                                      variant="ghost"
                                      onClick={() => submitSummaryMutation.mutate(s.id)}
                                      data-testid={`button-submit-summary-${s.id}`}
                                    >
                                      <Send className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                      size="icon" 
                                      variant="ghost"
                                      onClick={() => deleteSummaryMutation.mutate(s.id)}
                                      data-testid={`button-delete-summary-${s.id}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                                {isOwner && s.status === "APPROVED" && (
                                  <Button 
                                    size="icon" 
                                    variant="ghost"
                                    onClick={() => { setEditingSummary(s); setSummaryDialogOpen(true); }}
                                    data-testid={`button-edit-approved-summary-${s.id}`}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                )}
                                {canApprove && s.status === "PENDING_APPROVAL" && (
                                  <>
                                    <Button 
                                      size="icon" 
                                      variant="ghost"
                                      className="text-green-600"
                                      onClick={() => { setApprovalAction({ type: "summary", id: s.id, action: "approve" }); setApprovalDialogOpen(true); }}
                                      data-testid={`button-approve-summary-${s.id}`}
                                    >
                                      <CheckCircle className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                      size="icon" 
                                      variant="ghost"
                                      className="text-red-600"
                                      onClick={() => { setApprovalAction({ type: "summary", id: s.id, action: "reject" }); setApprovalDialogOpen(true); }}
                                      data-testid={`button-reject-summary-${s.id}`}
                                    >
                                      <XCircle className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

            <TabsContent value="support">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <CardTitle>Learning Support (SAPET Program)</CardTitle>
                  <div className="flex gap-2">
                    {canApprove && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEmailDialog("support")}
                          data-testid="button-email-timetable"
                        >
                          <Mail className="w-4 h-4 mr-2" />
                          Email Timetable
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => exportPdf("support")}
                          data-testid="button-export-support"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Export PDF
                        </Button>
                      </>
                    )}
                    <Dialog open={supportDialogOpen} onOpenChange={(open) => {
                      setSupportDialogOpen(open);
                      if (!open) {
                        setEditingSupport(null);
                        setSupportSessionType("");
                        setSapetDate("");
                        setSapetDateError("");
                      } else if (editingSupport) {
                        setSupportSessionType(editingSupport.sessionType || "");
                        setSapetDate(editingSupport.sapetDate || "");
                        setSapetDateError("");
                      }
                    }}>
                      <DialogTrigger asChild>
                        <Button size="sm" data-testid="button-add-support">
                          <Plus className="w-4 h-4 mr-2" />
                          Add Entry
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>
                            {editingSupport ? "Edit" : "Add"} Learning Support
                          </DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSupportSubmit}>
                          <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="term">Term</Label>
                                <Select name="term" defaultValue={editingSupport?.term || selectedTerm}>
                                  <SelectTrigger data-testid="input-support-term">
                                    <SelectValue placeholder="Select term" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="TERM_1">Term 1</SelectItem>
                                    <SelectItem value="TERM_2">Term 2</SelectItem>
                                    <SelectItem value="TERM_3">Term 3</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="weekNumber">Week</Label>
                                <Select name="weekNumber" defaultValue={editingSupport?.weekNumber?.toString() || selectedWeek.toString()}>
                                  <SelectTrigger data-testid="input-support-week">
                                    <SelectValue placeholder="Select week" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Array.from({ length: 15 }, (_, i) => i + 1).map(w => (
                                      <SelectItem key={w} value={w.toString()}>Week {w}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="grade">Grade</Label>
                                <Select name="grade" defaultValue={editingSupport?.grade || ""}>
                                  <SelectTrigger data-testid="input-support-grade">
                                    <SelectValue placeholder="Select grade" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {["9", "10", "11", "12"].map(g => (
                                      <SelectItem key={g} value={g}>Grade {g}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="classId">Class</Label>
                                <Select name="classId" defaultValue={editingSupport?.classId?.toString() || ""}>
                                  <SelectTrigger data-testid="input-support-class">
                                    <SelectValue placeholder="Select class" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {classes.map(c => (
                                      <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="subjectId">Subject</Label>
                              <Select name="subjectId" defaultValue={editingSupport?.subjectId?.toString() || ""}>
                                <SelectTrigger data-testid="input-support-subject">
                                  <SelectValue placeholder="Select subject" />
                                </SelectTrigger>
                                <SelectContent>
                                  {subjects.map(s => (
                                    <SelectItem key={s.id} value={s.id.toString()}>{s.code} - {s.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="sessionType">Session Type</Label>
                              <Select 
                                name="sessionType" 
                                defaultValue={editingSupport?.sessionType || ""}
                                onValueChange={(value) => setSupportSessionType(value)}
                              >
                                <SelectTrigger data-testid="input-session-type">
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="online">Online</SelectItem>
                                  <SelectItem value="in_school">In School</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {(supportSessionType === "online" || (!supportSessionType && editingSupport?.sessionType === "online")) && (
                              <div className="space-y-2">
                                <Label htmlFor="teamsLink">Teams Link</Label>
                                <Input 
                                  type="url"
                                  name="teamsLink"
                                  defaultValue={editingSupport?.teamsLink || ""}
                                  placeholder="https://teams.microsoft.com/..."
                                  data-testid="input-teams-link"
                                />
                              </div>
                            )}
                            {(supportSessionType === "in_school" || (!supportSessionType && editingSupport?.sessionType === "in_school")) && (
                              <div className="space-y-2">
                                <Label htmlFor="location">Location</Label>
                                <Input 
                                  type="text"
                                  name="location"
                                  defaultValue={editingSupport?.location || ""}
                                  placeholder="e.g., Room 101, Library, Lab A"
                                  data-testid="input-location"
                                />
                              </div>
                            )}
                            <div className="grid grid-cols-3 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="sapetDay">SAPET Day</Label>
                                <Select name="sapetDay" defaultValue={editingSupport?.sapetDay || ""}>
                                  <SelectTrigger data-testid="input-sapet-day">
                                    <SelectValue placeholder="Select day" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Saturday">Saturday</SelectItem>
                                    <SelectItem value="Sunday">Sunday</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="sapetDate">SAPET Date</Label>
                                <Input 
                                  type="date"
                                  name="sapetDate"
                                  value={sapetDate}
                                  onChange={(e) => {
                                    const dateValue = e.target.value;
                                    if (dateValue) {
                                      const date = new Date(dateValue + "T00:00:00");
                                      const day = date.getDay();
                                      if (day !== 0 && day !== 6) {
                                        setSapetDateError("Please select a Saturday or Sunday");
                                        setSapetDate(dateValue);
                                      } else {
                                        setSapetDateError("");
                                        setSapetDate(dateValue);
                                      }
                                    } else {
                                      setSapetDateError("");
                                      setSapetDate("");
                                    }
                                  }}
                                  data-testid="input-sapet-date"
                                />
                                {sapetDateError && (
                                  <p className="text-sm text-destructive">{sapetDateError}</p>
                                )}
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="sapetTime">SAPET Time</Label>
                                <Input 
                                  type="time"
                                  name="sapetTime"
                                  defaultValue={editingSupport?.sapetTime || ""}
                                  data-testid="input-sapet-time"
                                />
                              </div>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button type="submit" data-testid="button-save-support">
                              {editingSupport ? "Update" : "Create"}
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {supportLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                    </div>
                  ) : support.filter(s => s.status === "APPROVED").length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No approved sessions for this term and week. Sessions will appear here once approved.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <div className="grid grid-cols-6 gap-2 min-w-[900px]">
                        <div className="font-semibold text-sm p-2 bg-muted rounded-md text-center">Time</div>
                        {DAYS.map(day => (
                          <div key={day} className="font-semibold text-sm p-2 bg-muted rounded-md text-center">{day}</div>
                        ))}
                        
                        {(() => {
                          const approvedSupport = support.filter(s => s.status === "APPROVED");
                          const supportByDay: Record<string, typeof support> = {};
                          DAYS.forEach(day => { supportByDay[day] = []; });
                          approvedSupport.forEach(s => {
                            if (s.sapetDay && supportByDay[s.sapetDay]) {
                              supportByDay[s.sapetDay].push(s);
                            }
                          });
                          const unscheduled = approvedSupport.filter(s => !s.sapetDay);
                          const maxSessions = Math.max(1, ...DAYS.map(d => supportByDay[d].length));
                          
                          return (
                            <>
                              {Array.from({ length: maxSessions }).map((_, rowIdx) => (
                                <>
                                  <div key={`time-${rowIdx}`} className="text-xs p-2 bg-muted/50 rounded-md flex items-center justify-center">
                                    Session {rowIdx + 1}
                                  </div>
                                  {DAYS.map(day => {
                                    const session = supportByDay[day][rowIdx];
                                    if (!session) {
                                      return <div key={`${day}-${rowIdx}`} className="p-2 border border-dashed border-muted rounded-md min-h-[120px]" />;
                                    }
                                    return (
                                      <div 
                                        key={session.id} 
                                        className="p-3 border rounded-md min-h-[120px] bg-card hover-elevate"
                                        data-testid={`cell-support-${session.id}`}
                                      >
                                        <div className="space-y-1.5">
                                          <div className="font-medium text-sm">G{session.grade} - {session.class.name}</div>
                                          <div className="text-xs text-muted-foreground">{session.subject.code} - {session.subject.name}</div>
                                          <div className="text-xs">
                                            <Badge variant="outline" className="text-xs">
                                              {session.sessionType === "online" ? "Online" : session.sessionType === "in_school" ? "In School" : "TBD"}
                                            </Badge>
                                          </div>
                                          {session.sapetTime && (
                                            <div className="text-xs text-muted-foreground">Time: {session.sapetTime}</div>
                                          )}
                                          {session.sapetDate && (
                                            <div className="text-xs text-muted-foreground">Date: {format(new Date(session.sapetDate), "MMM d")}</div>
                                          )}
                                          {session.teamsLink && (
                                            <a 
                                              href={session.teamsLink} 
                                              target="_blank" 
                                              rel="noopener noreferrer"
                                              className="flex items-center gap-1 text-xs text-primary hover:underline"
                                            >
                                              <ExternalLink className="w-3 h-3" />
                                              Teams Link
                                            </a>
                                          )}
                                          {(user?.id === session.teacherId || canApprove) && (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="mt-2 w-full text-xs"
                                              onClick={() => openAttendanceDialog(session)}
                                              data-testid={`button-attendance-${session.id}`}
                                            >
                                              <ClipboardCheck className="w-3 h-3 mr-1" />
                                              Attendance
                                            </Button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </>
                              ))}
                              {unscheduled.length > 0 && (
                                <>
                                  <div className="col-span-6 mt-4 pt-4 border-t">
                                    <h4 className="font-medium text-sm mb-2">Unscheduled Sessions</h4>
                                  </div>
                                  {unscheduled.map(session => (
                                    <div 
                                      key={session.id} 
                                      className="col-span-6 p-3 border rounded-md bg-card flex items-center gap-4"
                                      data-testid={`cell-unscheduled-${session.id}`}
                                    >
                                      <span className="font-medium text-sm">G{session.grade} - {session.class.name}</span>
                                      <span className="text-xs text-muted-foreground">{session.subject.code}</span>
                                      <Badge variant="outline" className="text-xs">
                                        {session.sessionType === "online" ? "Online" : session.sessionType === "in_school" ? "In School" : "TBD"}
                                      </Badge>
                                      {session.teamsLink && (
                                        <a href={session.teamsLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                                          <ExternalLink className="w-3 h-3" /> Teams
                                        </a>
                                      )}
                                      {(user?.id === session.teacherId || canApprove) && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="text-xs ml-auto"
                                          onClick={() => openAttendanceDialog(session)}
                                          data-testid={`button-attendance-unscheduled-${session.id}`}
                                        >
                                          <ClipboardCheck className="w-3 h-3 mr-1" />
                                          Attendance
                                        </Button>
                                      )}
                                    </div>
                                  ))}
                                </>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                  
                  {/* All Entries Table - Shows Draft, Pending, and Approved entries */}
                  <div className="mt-6 pt-6 border-t">
                    <h3 className="font-semibold mb-4">All Entries</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Grade</TableHead>
                          <TableHead>Class</TableHead>
                          <TableHead>Subject</TableHead>
                          <TableHead>Session Type</TableHead>
                          <TableHead>Day/Time</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {support.map(s => {
                          const isOwner = user?.id === s.teacherId;
                          return (
                            <TableRow key={s.id} data-testid={`row-support-${s.id}`}>
                              <TableCell>G{s.grade}</TableCell>
                              <TableCell>{s.class.name}</TableCell>
                              <TableCell>{s.subject.code}</TableCell>
                              <TableCell>
                                {s.sessionType === "online" ? "Online" : s.sessionType === "in_school" ? "In School" : "-"}
                              </TableCell>
                              <TableCell>
                                {s.sapetDay ? `${s.sapetDay}${s.sapetTime ? ` ${s.sapetTime}` : ""}` : "-"}
                              </TableCell>
                              <TableCell>
                                {getStatusBadge(s.status)}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  {isOwner && s.status === "DRAFT" && (
                                    <>
                                      <Button 
                                        size="icon" 
                                        variant="ghost"
                                        onClick={() => { setEditingSupport(s); setSupportSessionType(s.sessionType || ""); setSapetDate(s.sapetDate ? format(new Date(s.sapetDate), "yyyy-MM-dd") : ""); setSupportDialogOpen(true); }}
                                        data-testid={`button-edit-support-${s.id}`}
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <Button 
                                        size="icon" 
                                        variant="ghost"
                                        onClick={() => submitSupportMutation.mutate(s.id)}
                                        data-testid={`button-submit-support-${s.id}`}
                                      >
                                        <Send className="h-4 w-4" />
                                      </Button>
                                      <Button 
                                        size="icon" 
                                        variant="ghost"
                                        onClick={() => deleteSupportMutation.mutate(s.id)}
                                        data-testid={`button-delete-support-${s.id}`}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </>
                                  )}
                                  {s.status === "APPROVED" && (
                                    <>
                                      {isOwner && (
                                        <Button 
                                          size="icon" 
                                          variant="ghost"
                                          onClick={() => { setEditingSupport(s); setSupportSessionType(s.sessionType || ""); setSapetDate(s.sapetDate ? format(new Date(s.sapetDate), "yyyy-MM-dd") : ""); setSupportDialogOpen(true); }}
                                          data-testid={`button-edit-approved-support-${s.id}`}
                                        >
                                          <Edit className="h-4 w-4" />
                                        </Button>
                                      )}
                                      {(isOwner || canApprove) && (
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          onClick={() => openAttendanceDialog(s)}
                                          data-testid={`button-attendance-support-${s.id}`}
                                        >
                                          <ClipboardCheck className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </>
                                  )}
                                  {canApprove && s.status === "PENDING_APPROVAL" && (
                                    <>
                                      <Button 
                                        size="icon" 
                                        variant="ghost"
                                        className="text-green-600"
                                        onClick={() => { setApprovalAction({ type: "support", id: s.id, action: "approve" }); setApprovalDialogOpen(true); }}
                                        data-testid={`button-approve-support-${s.id}`}
                                      >
                                        <CheckCircle className="h-4 w-4" />
                                      </Button>
                                      <Button 
                                        size="icon" 
                                        variant="ghost"
                                        className="text-red-600"
                                        onClick={() => { setApprovalAction({ type: "support", id: s.id, action: "reject" }); setApprovalDialogOpen(true); }}
                                        data-testid={`button-reject-support-${s.id}`}
                                      >
                                        <XCircle className="h-4 w-4" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {support.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                              No entries yet. Click "Add Entry" to create one.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {canApprove && (
              <TabsContent value="pending">
                <Card>
                  <CardHeader>
                    <CardTitle>Pending Approvals</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(pendingSummaries + pendingSupport) === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No entries pending approval
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {summaries.filter(s => s.status === "PENDING_APPROVAL").length > 0 && (
                          <div>
                            <h3 className="font-semibold mb-3 flex items-center gap-2">
                              <FileText className="w-4 h-4" />
                              Learning Summaries ({summaries.filter(s => s.status === "PENDING_APPROVAL").length})
                            </h3>
                            <div className="space-y-2">
                              {summaries.filter(s => s.status === "PENDING_APPROVAL").map(s => (
                                <div key={s.id} className="p-4 border rounded-lg bg-card flex items-center justify-between gap-4" data-testid={`pending-summary-${s.id}`}>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-1">
                                      <span className="font-medium">G{s.grade} - {s.class.name}</span>
                                      <span className="text-sm text-muted-foreground">{s.subject.code} - {s.subject.name}</span>
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      {s.upcomingTopics ? s.upcomingTopics.substring(0, 100) + (s.upcomingTopics.length > 100 ? "..." : "") : "No topics specified"}
                                    </div>
                                    {s.quizDay && (
                                      <div className="text-sm mt-1">
                                        Quiz: {s.quizDay} {s.quizTime && `Period ${s.quizTime}`} {s.quizDate && `(${format(new Date(s.quizDate), "MMM d")})`}
                                      </div>
                                    )}
                                    <div className="text-xs text-muted-foreground mt-1">
                                      By: {s.teacher.name} | Term {selectedTerm.replace("TERM_", "")} Week {selectedWeek}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-green-600 border-green-600"
                                      onClick={() => {
                                        setApprovalAction({ type: "summary", id: s.id, action: "approve" });
                                        setApprovalComments("");
                                        setApprovalDialogOpen(true);
                                      }}
                                      data-testid={`button-approve-pending-summary-${s.id}`}
                                    >
                                      <Check className="w-4 h-4 mr-1" />
                                      Approve
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-red-600 border-red-600"
                                      onClick={() => {
                                        setApprovalAction({ type: "summary", id: s.id, action: "reject" });
                                        setApprovalComments("");
                                        setApprovalDialogOpen(true);
                                      }}
                                      data-testid={`button-reject-pending-summary-${s.id}`}
                                    >
                                      <X className="w-4 h-4 mr-1" />
                                      Reject
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {support.filter(s => s.status === "PENDING_APPROVAL").length > 0 && (
                          <div>
                            <h3 className="font-semibold mb-3 flex items-center gap-2">
                              <Users className="w-4 h-4" />
                              Learning Support ({support.filter(s => s.status === "PENDING_APPROVAL").length})
                            </h3>
                            <div className="space-y-2">
                              {support.filter(s => s.status === "PENDING_APPROVAL").map(s => (
                                <div key={s.id} className="p-4 border rounded-lg bg-card flex items-center justify-between gap-4" data-testid={`pending-support-${s.id}`}>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-1">
                                      <span className="font-medium">G{s.grade} - {s.class.name}</span>
                                      <span className="text-sm text-muted-foreground">{s.subject.code} - {s.subject.name}</span>
                                      <Badge variant="outline">
                                        {s.sessionType === "online" ? "Online" : s.sessionType === "in_school" ? "In School" : "TBD"}
                                      </Badge>
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      {s.sapetDay && `${s.sapetDay}`} {s.sapetTime && `at ${s.sapetTime}`} {s.sapetDate && `(${format(new Date(s.sapetDate), "MMM d")})`}
                                    </div>
                                    {s.teamsLink && (
                                      <a href={s.teamsLink} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1 mt-1">
                                        <ExternalLink className="w-3 h-3" /> Teams Link
                                      </a>
                                    )}
                                    <div className="text-xs text-muted-foreground mt-1">
                                      By: {s.teacher.name} | Term {selectedTerm.replace("TERM_", "")} Week {selectedWeek}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-green-600 border-green-600"
                                      onClick={() => {
                                        setApprovalAction({ type: "support", id: s.id, action: "approve" });
                                        setApprovalComments("");
                                        setApprovalDialogOpen(true);
                                      }}
                                      data-testid={`button-approve-pending-support-${s.id}`}
                                    >
                                      <Check className="w-4 h-4 mr-1" />
                                      Approve
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-red-600 border-red-600"
                                      onClick={() => {
                                        setApprovalAction({ type: "support", id: s.id, action: "reject" });
                                        setApprovalComments("");
                                        setApprovalDialogOpen(true);
                                      }}
                                      data-testid={`button-reject-pending-support-${s.id}`}
                                    >
                                      <X className="w-4 h-4 mr-1" />
                                      Reject
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </main>

      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approvalAction?.action === "approve" ? "Approve" : "Reject"} Entry
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Comments (optional)</Label>
              <Textarea
                value={approvalComments}
                onChange={(e) => setApprovalComments(e.target.value)}
                placeholder="Add any comments..."
                data-testid="input-approval-comments"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovalDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleApprovalSubmit}
              variant={approvalAction?.action === "reject" ? "destructive" : "default"}
              data-testid="button-confirm-approval"
            >
              {approvalAction?.action === "approve" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Email {emailType === "summaries" ? "Learning Summaries" : "Learning Support Timetable"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Send the {emailType === "summaries" ? "Learning Summaries report" : "Learning Support timetable"} for Term {selectedTerm.replace("TERM_", "")} Week {selectedWeek} to the specified email addresses.
            </p>
            <div className="space-y-2">
              <Label htmlFor="emails">Email Addresses</Label>
              <Textarea
                id="emails"
                value={emailAddresses}
                onChange={(e) => setEmailAddresses(e.target.value)}
                placeholder="Enter email addresses (separated by commas or new lines)"
                rows={4}
                data-testid="input-email-addresses"
              />
              <p className="text-xs text-muted-foreground">
                Separate multiple emails with commas, semicolons, or new lines.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={sendTimetableEmail}
              disabled={emailSending}
              data-testid="button-send-email"
            >
              {emailSending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Email
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={attendanceDialogOpen} onOpenChange={(open) => {
        setAttendanceDialogOpen(open);
        if (!open) {
          setAttendanceSession(null);
          setAttendanceData({});
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5" />
              Mark Attendance
            </DialogTitle>
          </DialogHeader>
          
          {attendanceSession && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Class:</span> {attendanceSession.class.name}</div>
                  <div><span className="text-muted-foreground">Subject:</span> {attendanceSession.subject.code} - {attendanceSession.subject.name}</div>
                  <div><span className="text-muted-foreground">Day:</span> {attendanceSession.sapetDay || "Not scheduled"}</div>
                  <div><span className="text-muted-foreground">Time:</span> {attendanceSession.sapetTime || "Not set"}</div>
                </div>
              </div>

              {(studentsLoading || attendanceLoading) ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="ml-2">Loading students...</span>
                </div>
              ) : attendanceStudents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No students found in this class. Please add students to the class first.
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-4">
                    <Label className="text-base font-medium">Student List ({attendanceStudents.length} students)</Label>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const allPresent: Record<number, "PRESENT" | "ABSENT"> = {};
                          attendanceStudents.forEach(s => allPresent[s.id] = "PRESENT");
                          setAttendanceData(allPresent);
                        }}
                        data-testid="button-mark-all-present"
                      >
                        <Check className="w-3 h-3 mr-1" />
                        Mark All Present
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const allAbsent: Record<number, "PRESENT" | "ABSENT"> = {};
                          attendanceStudents.forEach(s => allAbsent[s.id] = "ABSENT");
                          setAttendanceData(allAbsent);
                        }}
                        data-testid="button-mark-all-absent"
                      >
                        <X className="w-3 h-3 mr-1" />
                        Mark All Absent
                      </Button>
                    </div>
                  </div>
                  
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[60px]">#</TableHead>
                        <TableHead>Student ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead className="text-center w-[100px]">Present</TableHead>
                        <TableHead className="text-center w-[100px]">Absent</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendanceStudents.map((student, index) => (
                        <TableRow key={student.id} data-testid={`row-student-${student.id}`}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>{student.studentId}</TableCell>
                          <TableCell>{student.name}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center">
                              <Checkbox
                                id={`attendance-present-${student.id}`}
                                checked={attendanceData[student.id] === "PRESENT"}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setAttendanceData(prev => ({
                                      ...prev,
                                      [student.id]: "PRESENT"
                                    }));
                                  }
                                }}
                                data-testid={`checkbox-present-${student.id}`}
                                className="border-green-500 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                              />
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center">
                              <Checkbox
                                id={`attendance-absent-${student.id}`}
                                checked={attendanceData[student.id] === "ABSENT"}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setAttendanceData(prev => ({
                                      ...prev,
                                      [student.id]: "ABSENT"
                                    }));
                                  }
                                }}
                                data-testid={`checkbox-absent-${student.id}`}
                                className="border-red-500 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  <div className="flex justify-between items-center pt-4 border-t mt-4">
                    <div className="text-sm text-muted-foreground">
                      Present: {Object.values(attendanceData).filter(s => s === "PRESENT").length} | 
                      Absent: {attendanceStudents.length - Object.values(attendanceData).filter(s => s === "PRESENT").length}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setAttendanceDialogOpen(false);
                          setAttendanceSession(null);
                          setAttendanceData({});
                        }}
                        data-testid="button-cancel-attendance"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSaveAttendance}
                        disabled={saveAttendanceMutation.isPending}
                        data-testid="button-save-attendance"
                      >
                        {saveAttendanceMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4 mr-2" />
                            Save Attendance
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
