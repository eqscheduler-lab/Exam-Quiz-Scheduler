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
import { UserX, Loader2, AlertTriangle, CheckCircle, Clock } from "lucide-react";
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
      day: "numeric"
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

  const isPastGracePeriod = (createdAt: Date | string | null) => {
    return getDaysSinceCreation(createdAt) >= 10;
  };

  const accountsPastGracePeriod = inactiveAccounts?.filter(a => isPastGracePeriod(a.createdAt) && a.isActive) || [];
  const accountsInGracePeriod = inactiveAccounts?.filter(a => !isPastGracePeriod(a.createdAt) && a.isActive) || [];

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold font-display">Inactive Accounts</h1>
              <p className="text-muted-foreground mt-1">
                Accounts that haven't logged in since activation
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="destructive" className="flex items-center gap-2 px-3 py-1.5">
                <AlertTriangle className="w-4 h-4" />
                {accountsPastGracePeriod.length} past 10 days
              </Badge>
              <Badge variant="outline" className="flex items-center gap-2 px-3 py-1.5">
                <Clock className="w-4 h-4" />
                {accountsInGracePeriod.length} in grace period
              </Badge>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserX className="w-5 h-5" />
                Accounts That Never Logged In
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : inactiveAccounts && inactiveAccounts.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-semibold">Name</TableHead>
                        <TableHead className="font-semibold">Username</TableHead>
                        <TableHead className="font-semibold">Email</TableHead>
                        <TableHead className="font-semibold">Role</TableHead>
                        <TableHead className="font-semibold">Created</TableHead>
                        <TableHead className="font-semibold">Days Since Creation</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="text-right font-semibold">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inactiveAccounts
                        .sort((a, b) => getDaysSinceCreation(b.createdAt) - getDaysSinceCreation(a.createdAt))
                        .map((account) => {
                          const daysSinceCreation = getDaysSinceCreation(account.createdAt);
                          const isPast10Days = daysSinceCreation >= 10;
                          
                          return (
                            <TableRow 
                              key={account.id} 
                              data-testid={`row-inactive-account-${account.id}`}
                              className={isPast10Days && account.isActive ? "bg-destructive/5" : ""}
                            >
                              <TableCell className="font-medium">{account.name}</TableCell>
                              <TableCell className="text-muted-foreground">{account.username}</TableCell>
                              <TableCell className="text-muted-foreground">{account.email}</TableCell>
                              <TableCell>
                                <Badge variant="secondary">{account.role}</Badge>
                              </TableCell>
                              <TableCell>{formatDate(account.createdAt)}</TableCell>
                              <TableCell>
                                <Badge variant={isPast10Days ? "destructive" : "outline"}>
                                  {daysSinceCreation} {daysSinceCreation === 1 ? "day" : "days"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {!account.isActive ? (
                                  <Badge variant="secondary">Deactivated</Badge>
                                ) : isPast10Days ? (
                                  <Badge variant="destructive">
                                    Eligible for Deactivation
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-amber-600 border-amber-300">
                                    Grace Period ({10 - daysSinceCreation} days left)
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {account.isActive && isPast10Days && (
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
                          );
                        })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-4" />
                  <h3 className="text-lg font-semibold">All Accounts Active</h3>
                  <p className="text-muted-foreground mt-1">
                    All staff accounts have logged in at least once.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>How This Works</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Grace Period:</strong> New accounts have 10 days to log in for the first time</li>
                <li><strong>Eligible for Deactivation:</strong> After 10 days without logging in, accounts can be deactivated</li>
                <li><strong>Deactivation:</strong> Deactivated accounts cannot log in until reactivated by an admin</li>
                <li>Admin accounts are not tracked for inactivity</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
