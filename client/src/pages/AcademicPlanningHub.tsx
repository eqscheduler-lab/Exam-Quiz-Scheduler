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
  XCircle
} from "lucide-react";

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

  const canApprove = user?.role === "ADMIN" || user?.role === "VICE_PRINCIPAL" || user?.role === "PRINCIPAL";

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

  const handleSupportSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const teamsLink = formData.get("teamsLink") as string || null;
    
    if (teamsLink && !/^https?:\/\/.+/i.test(teamsLink)) {
      toast({ title: "Invalid Teams link", description: "Please enter a valid URL starting with http:// or https://", variant: "destructive" });
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportPdf("summaries")}
                      data-testid="button-export-summaries"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export PDF
                    </Button>
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportPdf("support")}
                      data-testid="button-export-support"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export PDF
                    </Button>
                    <Dialog open={supportDialogOpen} onOpenChange={(open) => {
                      setSupportDialogOpen(open);
                      if (!open) setEditingSupport(null);
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
                              <Select name="sessionType" defaultValue={editingSupport?.sessionType || ""}>
                                <SelectTrigger data-testid="input-session-type">
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="online">Online</SelectItem>
                                  <SelectItem value="in_school">In School</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
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
                            <div className="grid grid-cols-3 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="sapetDay">SAPET Day</Label>
                                <Select name="sapetDay" defaultValue={editingSupport?.sapetDay || ""}>
                                  <SelectTrigger data-testid="input-sapet-day">
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
                                <Label htmlFor="sapetDate">SAPET Date</Label>
                                <Input 
                                  type="date"
                                  name="sapetDate"
                                  defaultValue={editingSupport?.sapetDate || ""}
                                  data-testid="input-sapet-date"
                                />
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
    </div>
  );
}
