import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus, Trash2, Edit, Loader2, Download, Award, Users, FileText,
  Send, Ban, Search, CheckCircle2, XCircle, Clock, QrCode
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { type User, type CertificateTemplate, type Certificate } from "@shared/schema";
import { useState } from "react";
import { format } from "date-fns";

const DEFAULT_HTML_TEMPLATE = `<div style="text-align: center; padding: 60px;">
  <h1 style="font-size: 36px; color: #1a365d; margin-bottom: 10px;">CERTIFICATE</h1>
  <h2 style="font-size: 18px; color: #4a5568; margin-bottom: 40px;">{{title}}</h2>
  <p style="font-size: 14px; color: #718096;">This certificate is awarded to</p>
  <h2 style="font-size: 28px; color: #1a365d; margin: 20px 0;">{{name}}</h2>
  <p style="font-size: 14px; color: #4a5568;">{{role}} {{department}}</p>
  <p style="font-size: 12px; color: #a0aec0; margin-top: 30px;">Issued on {{issued_at}}</p>
  <p style="font-size: 10px; color: #cbd5e0;">Certificate ID: {{certificate_id}}</p>
</div>`;

export default function CertificateManagement() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("certificates");

  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CertificateTemplate | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateHtml, setTemplateHtml] = useState(DEFAULT_HTML_TEMPLATE);
  const [templateCss, setTemplateCss] = useState("");

  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [issueTitle, setIssueTitle] = useState("");
  const [issueTemplateId, setIssueTemplateId] = useState<string>("");
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [staffSearch, setStaffSearch] = useState("");

  const { data: templates, isLoading: loadingTemplates } = useQuery<CertificateTemplate[]>({
    queryKey: ["/api/certificate-templates"],
  });

  const { data: allCertificates, isLoading: loadingCerts } = useQuery<(Certificate & { template: CertificateTemplate; recipient: User; issuer: User })[]>({
    queryKey: ["/api/certificates"],
  });

  const { data: allUsers } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const activeStaff = allUsers?.filter(u => u.isActive) || [];
  const filteredStaff = activeStaff.filter(u =>
    u.name.toLowerCase().includes(staffSearch.toLowerCase()) ||
    u.role.toLowerCase().includes(staffSearch.toLowerCase()) ||
    (u.department || "").toLowerCase().includes(staffSearch.toLowerCase())
  );

  const createTemplateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/certificate-templates", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/certificate-templates"] });
      toast({ title: "Template created" });
      closeTemplateDialog();
    },
    onError: (err: any) => {
      toast({ title: "Failed to create template", description: err.message, variant: "destructive" });
    }
  });

  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/certificate-templates/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/certificate-templates"] });
      toast({ title: "Template updated" });
      closeTemplateDialog();
    },
    onError: (err: any) => {
      toast({ title: "Failed to update template", description: err.message, variant: "destructive" });
    }
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/certificate-templates/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/certificate-templates"] });
      toast({ title: "Template deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to delete template", description: err.message, variant: "destructive" });
    }
  });

  const issueCertificatesMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/certificates/issue", data),
    onSuccess: async (res) => {
      const result = await res.json();
      qc.invalidateQueries({ queryKey: ["/api/certificates"] });
      toast({ title: `${result.issued} certificate(s) issued successfully` });
      closeIssueDialog();
    },
    onError: (err: any) => {
      toast({ title: "Failed to issue certificates", description: err.message, variant: "destructive" });
    }
  });

  const revokeMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/certificates/${id}/revoke`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/certificates"] });
      toast({ title: "Certificate revoked" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to revoke", description: err.message, variant: "destructive" });
    }
  });

  const closeTemplateDialog = () => {
    setTemplateDialogOpen(false);
    setEditingTemplate(null);
    setTemplateName("");
    setTemplateHtml(DEFAULT_HTML_TEMPLATE);
    setTemplateCss("");
  };

  const openEditTemplate = (t: CertificateTemplate) => {
    setEditingTemplate(t);
    setTemplateName(t.name);
    setTemplateHtml(t.htmlTemplate);
    setTemplateCss(t.cssTemplate);
    setTemplateDialogOpen(true);
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim()) {
      return toast({ title: "Template name is required", variant: "destructive" });
    }
    const data = { name: templateName, htmlTemplate: templateHtml, cssTemplate: templateCss };
    if (editingTemplate) {
      updateTemplateMutation.mutate({ id: editingTemplate.id, data });
    } else {
      createTemplateMutation.mutate(data);
    }
  };

  const closeIssueDialog = () => {
    setIssueDialogOpen(false);
    setIssueTitle("");
    setIssueTemplateId("");
    setSelectedUserIds([]);
    setStaffSearch("");
  };

  const handleIssue = () => {
    if (!issueTitle.trim() || !issueTemplateId || selectedUserIds.length === 0) {
      return toast({ title: "Please fill in all fields and select at least one staff member", variant: "destructive" });
    }
    issueCertificatesMutation.mutate({
      templateId: Number(issueTemplateId),
      userIds: selectedUserIds,
      title: issueTitle,
    });
  };

  const toggleUser = (userId: number) => {
    setSelectedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const selectAllFiltered = () => {
    const ids = filteredStaff.map(u => u.id);
    setSelectedUserIds(prev => {
      const newSet = new Set([...prev, ...ids]);
      return Array.from(newSet);
    });
  };

  const clearSelection = () => setSelectedUserIds([]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ISSUED":
        return <Badge className="bg-green-600" data-testid="badge-status-issued"><CheckCircle2 className="w-3 h-3 mr-1" />Valid</Badge>;
      case "REVOKED":
        return <Badge variant="destructive" data-testid="badge-status-revoked"><XCircle className="w-3 h-3 mr-1" />Revoked</Badge>;
      case "EXPIRED":
        return <Badge variant="secondary" data-testid="badge-status-expired"><Clock className="w-3 h-3 mr-1" />Expired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const downloadPdf = (publicId: string) => {
    window.open(`/api/certificates/${publicId}/pdf`, '_blank');
  };

  return (
    <Layout title="Certificate Management">
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Templates</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-template-count">{templates?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Certificates Issued</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-cert-count">{allCertificates?.filter(c => c.status === "ISSUED").length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Revoked</CardTitle>
              <Ban className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-revoked-count">{allCertificates?.filter(c => c.status === "REVOKED").length || 0}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="certificates" data-testid="tab-certificates">Certificates</TabsTrigger>
            <TabsTrigger value="templates" data-testid="tab-templates">Templates</TabsTrigger>
          </TabsList>

          <TabsContent value="certificates" className="space-y-4">
            <div className="flex justify-end">
              <Button
                onClick={() => setIssueDialogOpen(true)}
                disabled={!templates || templates.length === 0}
                data-testid="button-issue-certificates"
              >
                <Send className="h-4 w-4 mr-2" />
                Issue Certificates
              </Button>
            </div>

            {loadingCerts ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Recipient</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Template</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Issued</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allCertificates?.map(cert => (
                        <TableRow key={cert.id} data-testid={`row-cert-${cert.id}`}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{cert.recipientName}</div>
                              <div className="text-xs text-muted-foreground">{cert.recipientRole.replace(/_/g, ' ')}</div>
                            </div>
                          </TableCell>
                          <TableCell>{cert.title}</TableCell>
                          <TableCell className="text-muted-foreground">{cert.template.name}</TableCell>
                          <TableCell>{getStatusBadge(cert.status)}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(cert.issuedAt), 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => downloadPdf(cert.publicId)}
                                title="Download PDF"
                                data-testid={`button-download-cert-${cert.id}`}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => window.open(`/verify/${cert.publicId}`, '_blank')}
                                title="View verification page"
                                data-testid={`button-verify-cert-${cert.id}`}
                              >
                                <QrCode className="h-4 w-4" />
                              </Button>
                              {cert.status === "ISSUED" && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="text-destructive"
                                  onClick={() => revokeMutation.mutate(cert.id)}
                                  title="Revoke certificate"
                                  data-testid={`button-revoke-cert-${cert.id}`}
                                >
                                  <Ban className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!allCertificates || allCertificates.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            No certificates issued yet. Create a template first, then issue certificates.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="templates" className="space-y-4">
            <div className="flex justify-end">
              <Button
                onClick={() => { setEditingTemplate(null); setTemplateName(""); setTemplateHtml(DEFAULT_HTML_TEMPLATE); setTemplateCss(""); setTemplateDialogOpen(true); }}
                data-testid="button-create-template"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Template
              </Button>
            </div>

            {loadingTemplates ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Version</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {templates?.map(t => (
                        <TableRow key={t.id} data-testid={`row-template-${t.id}`}>
                          <TableCell className="font-medium">{t.name}</TableCell>
                          <TableCell>v{t.version}</TableCell>
                          <TableCell>
                            {t.isActive ? (
                              <Badge className="bg-green-600">Active</Badge>
                            ) : (
                              <Badge variant="secondary">Inactive</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(t.createdAt), 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => openEditTemplate(t)}
                                data-testid={`button-edit-template-${t.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-destructive"
                                onClick={() => deleteTemplateMutation.mutate(t.id)}
                                data-testid={`button-delete-template-${t.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!templates || templates.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            No templates yet. Create one to start issuing certificates.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={templateDialogOpen} onOpenChange={(open) => { if (!open) closeTemplateDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Edit Template" : "Create Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                placeholder="e.g. Professional Development Certificate"
                data-testid="input-template-name"
              />
            </div>
            <div className="space-y-2">
              <Label>HTML Template</Label>
              <p className="text-xs text-muted-foreground">
                Available placeholders: {"{{name}}"}, {"{{role}}"}, {"{{department}}"}, {"{{title}}"}, {"{{issued_at}}"}, {"{{certificate_id}}"}
              </p>
              <Textarea
                value={templateHtml}
                onChange={e => setTemplateHtml(e.target.value)}
                rows={12}
                className="font-mono text-sm"
                data-testid="input-template-html"
              />
            </div>
            <div className="space-y-2">
              <Label>CSS Styles (optional)</Label>
              <Textarea
                value={templateCss}
                onChange={e => setTemplateCss(e.target.value)}
                rows={4}
                className="font-mono text-sm"
                placeholder="body { font-family: serif; }"
                data-testid="input-template-css"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeTemplateDialog}>Cancel</Button>
            <Button
              onClick={handleSaveTemplate}
              disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
              data-testid="button-save-template"
            >
              {(createTemplateMutation.isPending || updateTemplateMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingTemplate ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={issueDialogOpen} onOpenChange={(open) => { if (!open) closeIssueDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Issue Certificates</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Certificate Title</Label>
              <Input
                value={issueTitle}
                onChange={e => setIssueTitle(e.target.value)}
                placeholder="e.g. Professional Development Completion"
                data-testid="input-issue-title"
              />
            </div>
            <div className="space-y-2">
              <Label>Template</Label>
              <Select value={issueTemplateId} onValueChange={setIssueTemplateId}>
                <SelectTrigger data-testid="select-issue-template">
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates?.filter(t => t.isActive).map(t => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label>Select Staff ({selectedUserIds.length} selected)</Label>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={selectAllFiltered} data-testid="button-select-all-staff">
                    Select All
                  </Button>
                  <Button size="sm" variant="outline" onClick={clearSelection} data-testid="button-clear-staff">
                    Clear
                  </Button>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={staffSearch}
                  onChange={e => setStaffSearch(e.target.value)}
                  placeholder="Search by name, role, or department..."
                  className="pl-9"
                  data-testid="input-search-staff"
                />
              </div>
              <div className="border rounded-md max-h-60 overflow-y-auto">
                {filteredStaff.map(u => (
                  <label
                    key={u.id}
                    className="flex items-center gap-3 px-3 py-2 cursor-pointer hover-elevate"
                    data-testid={`staff-row-${u.id}`}
                  >
                    <Checkbox
                      checked={selectedUserIds.includes(u.id)}
                      onCheckedChange={() => toggleUser(u.id)}
                      data-testid={`checkbox-staff-${u.id}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{u.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {u.role.replace(/_/g, ' ')}
                        {u.department ? ` - ${u.department.replace(/_/g, ' ')}` : ''}
                      </div>
                    </div>
                  </label>
                ))}
                {filteredStaff.length === 0 && (
                  <div className="text-center text-muted-foreground py-4 text-sm">No staff found</div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeIssueDialog}>Cancel</Button>
            <Button
              onClick={handleIssue}
              disabled={issueCertificatesMutation.isPending || selectedUserIds.length === 0}
              data-testid="button-confirm-issue"
            >
              {issueCertificatesMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Issue to {selectedUserIds.length} Staff
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
