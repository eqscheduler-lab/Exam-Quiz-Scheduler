import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Download, Upload, Users, BookOpen, GraduationCap, CheckCircle, XCircle, Loader2, FileText } from "lucide-react";

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

export default function BulkImport() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [staffFile, setStaffFile] = useState<File | null>(null);
  const [subjectsFile, setSubjectsFile] = useState<File | null>(null);
  const [classesFile, setClassesFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const downloadTemplate = (type: "staff" | "subjects" | "classes") => {
    let csvContent = "";
    let filename = "";
    
    switch (type) {
      case "staff":
        csvContent = "name,username,email,role\nJohn Doe,johndoe,john.doe@school.edu,TEACHER\nJane Smith,janesmith,jane.smith@school.edu,COORDINATOR\nMike Admin,mikeadmin,mike.admin@school.edu,ADMIN";
        filename = "staff_template.csv";
        break;
      case "subjects":
        csvContent = "code,name\nMATH101,Mathematics\nPHYS101,Physics\nCHEM101,Chemistry\nENG101,English\nBIO101,Biology";
        filename = "subjects_template.csv";
        break;
      case "classes":
        csvContent = "name\nA9[AET]/1\nA9[AET]/2\nA10[AMT]/1\nA10[AMT]/2\nA11[ENI]/1\nA12[CAI]/1";
        filename = "classes_template.csv";
        break;
    }
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
    
    toast({ title: `${filename} downloaded`, description: "Fill in the template and upload it back." });
  };

  const importMutation = useMutation({
    mutationFn: async ({ type, file }: { type: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      
      const response = await fetch(`/api/admin/bulk-import/${type}`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Import failed");
      }
      
      return response.json();
    },
    onSuccess: (data: ImportResult, variables) => {
      setImportResult(data);
      
      if (variables.type === "staff") {
        queryClient.invalidateQueries({ queryKey: ["/api/users"] });
        setStaffFile(null);
      } else if (variables.type === "subjects") {
        queryClient.invalidateQueries({ queryKey: ["/api/subjects"] });
        setSubjectsFile(null);
      } else if (variables.type === "classes") {
        queryClient.invalidateQueries({ queryKey: ["/api/classes"] });
        setClassesFile(null);
      }
      
      toast({
        title: "Import completed",
        description: `${data.success} imported successfully, ${data.failed} failed.`,
        variant: data.failed > 0 ? "destructive" : "default",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleImport = (type: "staff" | "subjects" | "classes") => {
    let file: File | null = null;
    
    switch (type) {
      case "staff":
        file = staffFile;
        break;
      case "subjects":
        file = subjectsFile;
        break;
      case "classes":
        file = classesFile;
        break;
    }
    
    if (!file) {
      toast({ title: "No file selected", description: "Please select a CSV file to import.", variant: "destructive" });
      return;
    }
    
    setImportResult(null);
    importMutation.mutate({ type, file });
  };

  return (
    <Layout title="Bulk Import">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <FileText className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Bulk Import</h1>
            <p className="text-muted-foreground">Import staff, subjects, and classes from CSV files</p>
          </div>
        </div>

        <Alert>
          <FileText className="h-4 w-4" />
          <AlertTitle>How to use bulk import</AlertTitle>
          <AlertDescription>
            1. Download the template for the data type you want to import<br />
            2. Fill in the template with your data (keep the header row)<br />
            3. Upload the completed CSV file<br />
            4. Review the import results
          </AlertDescription>
        </Alert>

        {importResult && (
          <Alert variant={importResult.failed > 0 ? "destructive" : "default"}>
            {importResult.failed > 0 ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
            <AlertTitle>Import Results</AlertTitle>
            <AlertDescription>
              <div className="mt-2">
                <p><strong>{importResult.success}</strong> records imported successfully</p>
                <p><strong>{importResult.failed}</strong> records failed</p>
                {importResult.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="font-semibold">Errors:</p>
                    <ul className="list-disc pl-5 text-sm max-h-32 overflow-y-auto">
                      {importResult.errors.slice(0, 10).map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                      {importResult.errors.length > 10 && (
                        <li>...and {importResult.errors.length - 10} more errors</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="staff" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="staff" className="flex items-center gap-2" data-testid="tab-staff">
              <Users className="w-4 h-4" />
              Staff
            </TabsTrigger>
            <TabsTrigger value="subjects" className="flex items-center gap-2" data-testid="tab-subjects">
              <BookOpen className="w-4 h-4" />
              Subjects
            </TabsTrigger>
            <TabsTrigger value="classes" className="flex items-center gap-2" data-testid="tab-classes">
              <GraduationCap className="w-4 h-4" />
              Classes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="staff">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Import Staff Members
                </CardTitle>
                <CardDescription>
                  Import teachers, coordinators, and administrators. Required fields: name, username, email, role.
                  Valid roles: TEACHER, ADMIN, COORDINATOR, PRINCIPAL, VICE_PRINCIPAL.
                  Default password will be "Staff123" for all imported users.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <Button variant="outline" onClick={() => downloadTemplate("staff")} data-testid="button-download-staff-template">
                    <Download className="w-4 h-4 mr-2" />
                    Download Template
                  </Button>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="staff-file">Upload CSV File</Label>
                  <div className="flex gap-4">
                    <Input
                      id="staff-file"
                      type="file"
                      accept=".csv"
                      onChange={(e) => setStaffFile(e.target.files?.[0] || null)}
                      data-testid="input-staff-file"
                    />
                    <Button 
                      onClick={() => handleImport("staff")} 
                      disabled={!staffFile || importMutation.isPending}
                      data-testid="button-import-staff"
                    >
                      {importMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4 mr-2" />
                      )}
                      Import Staff
                    </Button>
                  </div>
                  {staffFile && <p className="text-sm text-muted-foreground">Selected: {staffFile.name}</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subjects">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  Import Subjects
                </CardTitle>
                <CardDescription>
                  Import subject codes and names. Required fields: code, name.
                  Example: MATH101, Mathematics
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <Button variant="outline" onClick={() => downloadTemplate("subjects")} data-testid="button-download-subjects-template">
                    <Download className="w-4 h-4 mr-2" />
                    Download Template
                  </Button>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="subjects-file">Upload CSV File</Label>
                  <div className="flex gap-4">
                    <Input
                      id="subjects-file"
                      type="file"
                      accept=".csv"
                      onChange={(e) => setSubjectsFile(e.target.files?.[0] || null)}
                      data-testid="input-subjects-file"
                    />
                    <Button 
                      onClick={() => handleImport("subjects")} 
                      disabled={!subjectsFile || importMutation.isPending}
                      data-testid="button-import-subjects"
                    >
                      {importMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4 mr-2" />
                      )}
                      Import Subjects
                    </Button>
                  </div>
                  {subjectsFile && <p className="text-sm text-muted-foreground">Selected: {subjectsFile.name}</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="classes">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5" />
                  Import Classes
                </CardTitle>
                <CardDescription>
                  Import class names. Required field: name.
                  Format: A[Grade][Program]/Section (e.g., A10[AMT]/1, A11[ENI]/2)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <Button variant="outline" onClick={() => downloadTemplate("classes")} data-testid="button-download-classes-template">
                    <Download className="w-4 h-4 mr-2" />
                    Download Template
                  </Button>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="classes-file">Upload CSV File</Label>
                  <div className="flex gap-4">
                    <Input
                      id="classes-file"
                      type="file"
                      accept=".csv"
                      onChange={(e) => setClassesFile(e.target.files?.[0] || null)}
                      data-testid="input-classes-file"
                    />
                    <Button 
                      onClick={() => handleImport("classes")} 
                      disabled={!classesFile || importMutation.isPending}
                      data-testid="button-import-classes"
                    >
                      {importMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4 mr-2" />
                      )}
                      Import Classes
                    </Button>
                  </div>
                  {classesFile && <p className="text-sm text-muted-foreground">Selected: {classesFile.name}</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
