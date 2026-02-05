import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Users, UserCheck } from "lucide-react";
import { type User, departments } from "@shared/schema";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function ManageDepartments() {
  const { data: staff, isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const getDepartmentStats = () => {
    if (!staff) return [];
    
    return departments.map(dept => {
      const members = staff.filter(s => s.department === dept && s.isActive);
      const leadTeachers = members.filter(m => m.role === "LEAD_TEACHER");
      const teachers = members.filter(m => m.role === "TEACHER");
      const others = members.filter(m => m.role !== "TEACHER" && m.role !== "LEAD_TEACHER");
      
      return {
        name: dept,
        displayName: dept.replace(/_/g, " "),
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

  return (
    <Layout title="Manage Departments">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Building2 className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Department Management</h1>
            <p className="text-muted-foreground">View and manage staff assignments by department</p>
          </div>
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
            ) : (
              <Accordion type="single" collapsible className="w-full" data-testid="accordion-departments">
                {departmentStats.map((dept) => (
                  <AccordionItem key={dept.name} value={dept.name} data-testid={`accordion-item-${dept.name}`}>
                    <AccordionTrigger className="hover:no-underline" data-testid={`accordion-trigger-${dept.name}`}>
                      <div className="flex items-center gap-4 w-full pr-4">
                        <span className="font-medium" data-testid={`text-dept-name-${dept.name}`}>{dept.displayName}</span>
                        <div className="flex gap-2 ml-auto">
                          {dept.leadTeachers.length > 0 && (
                            <Badge variant="default" className="text-xs" data-testid={`badge-lead-count-${dept.name}`}>
                              {dept.leadTeachers.length} Lead Teacher{dept.leadTeachers.length > 1 ? 's' : ''}
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-xs" data-testid={`badge-member-count-${dept.name}`}>
                            {dept.totalCount} member{dept.totalCount !== 1 ? 's' : ''}
                          </Badge>
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
    </Layout>
  );
}
