import { useQuery, useMutation } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { UserX, Loader2, AlertTriangle, CheckCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function InactiveAccounts() {
  const { toast } = useToast();
  
  const { data: inactiveAccounts, isLoading } = useQuery<User[]>({
    queryKey: ["/api/inactive-accounts"],
  });

  const deactivateMutation = useMutation({
    mutationFn: async (userId: number) => {
      return apiRequest("POST", `/api/inactive-accounts/${userId}/deactivate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inactive-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Account marked as inactive" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to deactivate account", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const formatDate = (date: Date | string | null) => {
    if (!date) return "Never";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const getDaysSinceCreation = (createdAt: Date | string | null) => {
    if (!createdAt) return 0;
    const created = new Date(createdAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - created.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold font-display">Inactive Accounts</h1>
              <p className="text-muted-foreground mt-1">
                Accounts that haven't accessed the app since activation (10+ days)
              </p>
            </div>
            <Badge variant="outline" className="flex items-center gap-2 px-3 py-1.5">
              <UserX className="w-4 h-4" />
              {inactiveAccounts?.length || 0} accounts
            </Badge>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Accounts Pending Review
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : inactiveAccounts && inactiveAccounts.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Days Inactive</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inactiveAccounts.map((account) => (
                      <TableRow key={account.id} data-testid={`row-inactive-account-${account.id}`}>
                        <TableCell className="font-medium">{account.name}</TableCell>
                        <TableCell>{account.username}</TableCell>
                        <TableCell>{account.email}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{account.role}</Badge>
                        </TableCell>
                        <TableCell>{formatDate(account.createdAt)}</TableCell>
                        <TableCell>
                          <Badge variant="destructive">
                            {getDaysSinceCreation(account.createdAt)} days
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {account.isActive ? (
                            <Badge variant="outline" className="text-amber-600 border-amber-300">
                              Never Accessed
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Deactivated</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {account.isActive && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="destructive" 
                                  size="sm"
                                  disabled={deactivateMutation.isPending}
                                  data-testid={`button-deactivate-${account.id}`}
                                >
                                  {deactivateMutation.isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <>
                                      <UserX className="w-4 h-4 mr-1" />
                                      Deactivate
                                    </>
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Deactivate Account?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will mark <strong>{account.name}</strong>'s account as inactive. 
                                    They will not be able to log in until reactivated.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deactivateMutation.mutate(account.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Deactivate
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12">
                  <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-4" />
                  <h3 className="text-lg font-semibold">All Accounts Active</h3>
                  <p className="text-muted-foreground mt-1">
                    No accounts have been inactive for more than 10 days since creation.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>About This Page</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                This page shows accounts that were created but never accessed within 10 days of creation.
              </p>
              <ul className="list-disc list-inside space-y-1">
                <li>Accounts are flagged if they have never logged in since being created</li>
                <li>Only accounts created more than 10 days ago appear here</li>
                <li>Admin accounts are excluded from this tracking</li>
                <li>Deactivating an account prevents the user from logging in</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
