import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Loader2, Shield, Monitor, Globe } from "lucide-react";

interface LoginAuditLog {
  id: number;
  userId: number;
  username: string;
  ipAddress: string | null;
  userAgent: string | null;
  loginAt: string;
  success: boolean;
  user: {
    id: number;
    name: string;
    role: string;
    email: string;
  };
}

export default function LoginAudit() {
  const { data: logs, isLoading } = useQuery<LoginAuditLog[]>({
    queryKey: ["/api/admin/login-audit"],
  });

  const parseUserAgent = (ua: string | null): string => {
    if (!ua) return "Unknown";
    if (ua.includes("Chrome")) return "Chrome";
    if (ua.includes("Firefox")) return "Firefox";
    if (ua.includes("Safari")) return "Safari";
    if (ua.includes("Edge")) return "Edge";
    return "Other Browser";
  };

  return (
    <Layout title="Login Audit">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-primary" />
          <div>
            <h2 className="text-xl font-bold font-display">Login Activity Log</h2>
            <p className="text-muted-foreground text-sm">Track who logged in, when, and from where</p>
          </div>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Login Time</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Browser</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading audit logs...
                    </div>
                  </TableCell>
                </TableRow>
              ) : logs?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No login activity recorded yet
                  </TableCell>
                </TableRow>
              ) : logs?.map((log) => (
                <TableRow key={log.id} data-testid={`row-login-${log.id}`}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{log.user.name}</div>
                      <div className="text-xs text-muted-foreground">{log.username}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{log.user.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {format(new Date(log.loginAt), "MMM d, yyyy")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(log.loginAt), "h:mm:ss a")}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Globe className="w-3 h-3 text-muted-foreground" />
                      <span className="font-mono text-sm">{log.ipAddress || "N/A"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Monitor className="w-3 h-3 text-muted-foreground" />
                      <span className="text-sm">{parseUserAgent(log.userAgent)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={log.success ? "default" : "destructive"}>
                      {log.success ? "Success" : "Failed"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </Layout>
  );
}
