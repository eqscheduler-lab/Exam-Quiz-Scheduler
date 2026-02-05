import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Users, Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { type User, type Department } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function ManageDepartments() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deletingDept, setDeletingDept] = useState<Department | null>(null);
  const [formData, setFormData] = useState({ name: "", displayName: "" });

  const { data: departments = [], isLoading: deptsLoading } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const { data: staff, isLoading: staffLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const isLoading = deptsLoading || staffLoading;

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; displayName: string }) => {
      return apiRequest("POST", "/api/departments", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setIsAddDialogOpen(false);
      setFormData({ name: "", displayName: "" });
      toast({ title: "Department created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create department", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { name?: string; displayName?: string } }) => {
      return apiRequest("PATCH", `/api/departments/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setEditingDept(null);
      setFormData({ name: "", displayName: "" });
      toast({ title: "Department updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update department", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/departments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setDeletingDept(null);
      toast({ title: "Department deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete department", variant: "destructive" });
    },
  });

  const getDepartmentStats = () => {
    if (!staff || !departments) return [];
    
    return departments.map(dept => {
      const members = staff.filter(s => s.department === dept.name && s.isActive);
      const leadTeachers = members.filter(m => m.role === "LEAD_TEACHER");
      const teachers = members.filter(m => m.role === "TEACHER");
      const others = members.filter(m => m.role !== "TEACHER" && m.role !== "LEAD_TEACHER");
      
      return {
        ...dept,
        members,
        leadTeachers,
        teachers,
        others,
        totalCount: members.length,
      };
    });
  };

  const unassignedStaff = staff?.filter(s => !s.department && s.isActive) || [];
  const departmentStats = getDepartmentStats();
  const totalAssigned = departmentStats.reduce((sum, d) => sum + d.totalCount, 0);

  const handleOpenAdd = () => {
    setFormData({ name: "", displayName: "" });
    setIsAddDialogOpen(true);
  };

  const handleOpenEdit = (dept: Department) => {
    setFormData({ name: dept.name, displayName: dept.displayName });
    setEditingDept(dept);
  };

  const handleSubmitAdd = () => {
    if (!formData.displayName.trim()) {
      toast({ title: "Please enter a department name", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      name: formData.displayName.toUpperCase().replace(/\s+/g, "_"),
      displayName: formData.displayName.trim(),
    });
  };

  const handleSubmitEdit = () => {
    if (!editingDept || !formData.displayName.trim()) return;
    updateMutation.mutate({
      id: editingDept.id,
      data: {
        name: formData.displayName.toUpperCase().replace(/\s+/g, "_"),
        displayName: formData.displayName.trim(),
      },
    });
  };

  const handleDelete = () => {
    if (!deletingDept) return;
    deleteMutation.mutate(deletingDept.id);
  };

  return (
    <Layout title="Manage Departments">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Department Management</h1>
              <p className="text-muted-foreground">Add, edit, and manage school departments</p>
            </div>
          </div>
          <Button onClick={handleOpenAdd} data-testid="button-add-department">
            <Plus className="w-4 h-4 mr-2" />
            Add Department
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card data-testid="card-total-departments">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Departments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-departments">{departments.length}</div>
            </CardContent>
          </Card>
          <Card data-testid="card-staff-assigned">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Staff Assigned</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-staff-assigned">{totalAssigned}</div>
            </CardContent>
          </Card>
          <Card data-testid="card-unassigned-staff">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Unassigned Staff</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500" data-testid="text-unassigned-count">{unassignedStaff.length}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Departments Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading departments...</div>
            ) : departments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No departments found. Click "Add Department" to create one.
              </div>
            ) : (
              <Accordion type="single" collapsible className="w-full" data-testid="accordion-departments">
                {departmentStats.map((dept) => (
                  <AccordionItem key={dept.id} value={dept.name} data-testid={`accordion-item-${dept.name}`}>
                    <AccordionTrigger className="hover:no-underline" data-testid={`accordion-trigger-${dept.name}`}>
                      <div className="flex items-center gap-4 w-full pr-4">
                        <span className="font-medium" data-testid={`text-dept-name-${dept.name}`}>{dept.displayName}</span>
                        <div className="flex gap-2 ml-auto items-center">
                          {dept.leadTeachers.length > 0 && (
                            <Badge variant="default" className="text-xs" data-testid={`badge-lead-count-${dept.name}`}>
                              {dept.leadTeachers.length} Lead Teacher{dept.leadTeachers.length > 1 ? 's' : ''}
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-xs" data-testid={`badge-member-count-${dept.name}`}>
                            {dept.totalCount} member{dept.totalCount !== 1 ? 's' : ''}
                          </Badge>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8"
                            onClick={(e) => { e.stopPropagation(); handleOpenEdit(dept); }}
                            data-testid={`button-edit-${dept.name}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); setDeletingDept(dept); }}
                            data-testid={`button-delete-${dept.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      {dept.members.length === 0 ? (
                        <div className="text-muted-foreground text-sm py-4 text-center">
                          No staff assigned to this department
                        </div>
                      ) : (
                        <Table data-testid={`table-dept-members-${dept.name}`}>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Role</TableHead>
                              <TableHead>Email</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {dept.members.map((member) => (
                              <TableRow key={member.id} data-testid={`row-member-${member.id}`}>
                                <TableCell className="font-medium" data-testid={`text-member-name-${member.id}`}>{member.name}</TableCell>
                                <TableCell>
                                  <Badge 
                                    variant={member.role === "LEAD_TEACHER" ? "default" : "outline"} 
                                    className="text-xs"
                                    data-testid={`badge-member-role-${member.id}`}
                                  >
                                    {member.role.replace(/_/g, " ")}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-muted-foreground" data-testid={`text-member-email-${member.id}`}>{member.email}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </CardContent>
        </Card>

        {unassignedStaff.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-600">
                <Users className="w-5 h-5" />
                Unassigned Staff ({unassignedStaff.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                These staff members have not been assigned to a department. Edit their profile in Staff Management to assign them.
              </p>
              <Table data-testid="table-unassigned-staff">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Email</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unassignedStaff.map((member) => (
                    <TableRow key={member.id} data-testid={`row-unassigned-${member.id}`}>
                      <TableCell className="font-medium" data-testid={`text-unassigned-name-${member.id}`}>{member.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs" data-testid={`badge-unassigned-role-${member.id}`}>
                          {member.role.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground" data-testid={`text-unassigned-email-${member.id}`}>{member.email}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Department</DialogTitle>
            <DialogDescription>
              Enter a name for the new department.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Department Name</Label>
              <Input
                id="displayName"
                placeholder="e.g., Computer Science"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                data-testid="input-department-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} data-testid="button-cancel-add">
              Cancel
            </Button>
            <Button onClick={handleSubmitAdd} disabled={createMutation.isPending} data-testid="button-save-department">
              {createMutation.isPending ? "Creating..." : "Create Department"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingDept} onOpenChange={(open) => !open && setEditingDept(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Department</DialogTitle>
            <DialogDescription>
              Update the department name.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editDisplayName">Department Name</Label>
              <Input
                id="editDisplayName"
                placeholder="e.g., Computer Science"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                data-testid="input-edit-department-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingDept(null)} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button onClick={handleSubmitEdit} disabled={updateMutation.isPending} data-testid="button-update-department">
              {updateMutation.isPending ? "Updating..." : "Update Department"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingDept} onOpenChange={(open) => !open && setDeletingDept(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Department</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the "{deletingDept?.displayName}" department? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="button-confirm-delete">
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
