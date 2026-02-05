import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Edit, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { type Class } from "@shared/schema";
import { useState } from "react";

type Student = {
  id: number;
  name: string;
  studentId: string;
  classId: number;
};

export default function ManageStudents() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [filterClassId, setFilterClassId] = useState<string>("all");
  
  const [formData, setFormData] = useState({
    name: "",
    studentId: "",
    classId: "",
  });

  const { data: classes } = useQuery<Class[]>({
    queryKey: ["/api/classes"],
  });

  const { data: students, isLoading } = useQuery<Student[]>({
    queryKey: ["/api/students", filterClassId],
    queryFn: async () => {
      const url = filterClassId !== "all" 
        ? `/api/students?classId=${filterClassId}` 
        : "/api/students";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch students");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, classId: Number(data.classId) }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Failed to create student");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      setDialogOpen(false);
      resetForm();
      toast({ title: "Success", description: "Student created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof formData }) => {
      const res = await fetch(`/api/students/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, classId: Number(data.classId) }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Failed to update student");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      setDialogOpen(false);
      resetForm();
      toast({ title: "Success", description: "Student updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/students/${id}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to delete student");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      toast({ title: "Success", description: "Student deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ name: "", studentId: "", classId: "" });
    setEditingStudent(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      name: student.name,
      studentId: student.studentId,
      classId: String(student.classId),
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingStudent) {
      updateMutation.mutate({ id: editingStudent.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getClassName = (classId: number) => {
    return classes?.find(c => c.id === classId)?.name || "Unknown";
  };

  return (
    <Layout title="Student Management">
      <div className="space-y-6">
        <div className="flex justify-between items-center gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-bold font-display">Manage Students</h2>
            <p className="text-muted-foreground text-sm">Add and manage students for attendance tracking</p>
          </div>
          <div className="flex gap-4 items-center">
            <Select value={filterClassId} onValueChange={setFilterClassId}>
              <SelectTrigger className="w-48" data-testid="select-filter-class">
                <SelectValue placeholder="Filter by class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes?.map(cls => (
                  <SelectItem key={cls.id} value={String(cls.id)}>{cls.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={openCreateDialog} data-testid="button-add-student">
              <Plus className="w-4 h-4 mr-2" />
              Add Student
            </Button>
          </div>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Class</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">Loading students...</TableCell>
                </TableRow>
              ) : students?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    No students found. Click "Add Student" to create one.
                  </TableCell>
                </TableRow>
              ) : students?.map((student) => (
                <TableRow key={student.id} data-testid={`row-student-${student.id}`}>
                  <TableCell className="font-mono">{student.studentId}</TableCell>
                  <TableCell className="font-medium">{student.name}</TableCell>
                  <TableCell>{getClassName(student.classId)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => openEditDialog(student)}
                        data-testid={`button-edit-student-${student.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteMutation.mutate(student.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-student-${student.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingStudent ? "Edit Student" : "Add New Student"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="studentId">Student ID</Label>
              <Input 
                id="studentId"
                placeholder="e.g. STU001"
                value={formData.studentId}
                onChange={(e) => setFormData(prev => ({ ...prev, studentId: e.target.value }))}
                required
                data-testid="input-student-id"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input 
                id="name"
                placeholder="Enter student name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
                data-testid="input-student-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="classId">Class</Label>
              <Select 
                value={formData.classId} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, classId: value }))}
              >
                <SelectTrigger data-testid="select-student-class">
                  <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent>
                  {classes?.map(cls => (
                    <SelectItem key={cls.id} value={String(cls.id)}>{cls.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending || updateMutation.isPending || !formData.name || !formData.studentId || !formData.classId}
                data-testid="button-save-student"
              >
                {editingStudent ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
