import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, Clock, AlertTriangle, Award, Download, GraduationCap } from "lucide-react";
import { format } from "date-fns";

interface VerifyResponse {
  valid: boolean;
  status: string;
  certificateId: string;
  recipientName: string;
  recipientRole: string;
  recipientDepartment: string | null;
  title: string;
  issuedAt: string;
  revokedAt: string | null;
  expiresAt: string | null;
  message?: string;
}

export default function VerifyCertificate() {
  const params = useParams<{ publicId: string }>();
  const publicId = params.publicId;

  const { data, isLoading, error } = useQuery<VerifyResponse>({
    queryKey: ["/api/verify", publicId],
    enabled: !!publicId,
  });

  const downloadPdf = () => {
    window.open(`/api/certificates/${publicId}/pdf`, '_blank');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg">
            <GraduationCap className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-lg">ExamScheduler</h1>
            <p className="text-xs text-muted-foreground">Certificate Verification</p>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center pt-12 px-4 pb-8">
        <div className="w-full max-w-lg">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-muted-foreground">Verifying certificate...</p>
            </div>
          )}

          {!isLoading && (!data || data.status === "NOT_FOUND") && (
            <Card>
              <CardContent className="flex flex-col items-center py-12 gap-4">
                <div className="bg-destructive/10 p-4 rounded-full">
                  <AlertTriangle className="h-10 w-10 text-destructive" />
                </div>
                <h2 className="text-xl font-bold" data-testid="text-verify-not-found">Certificate Not Found</h2>
                <p className="text-muted-foreground text-center">
                  The certificate ID provided does not match any records in our system. Please check the URL or QR code and try again.
                </p>
              </CardContent>
            </Card>
          )}

          {!isLoading && data && data.status !== "NOT_FOUND" && (
            <Card>
              <CardHeader className="text-center pb-2">
                {data.valid ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="bg-green-100 dark:bg-green-900/30 p-4 rounded-full">
                      <CheckCircle2 className="h-10 w-10 text-green-600" />
                    </div>
                    <Badge className="bg-green-600 text-sm px-4 py-1" data-testid="badge-verify-valid">
                      Valid Certificate
                    </Badge>
                  </div>
                ) : data.status === "REVOKED" ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="bg-destructive/10 p-4 rounded-full">
                      <XCircle className="h-10 w-10 text-destructive" />
                    </div>
                    <Badge variant="destructive" className="text-sm px-4 py-1" data-testid="badge-verify-revoked">
                      Revoked Certificate
                    </Badge>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="bg-muted p-4 rounded-full">
                      <Clock className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <Badge variant="secondary" className="text-sm px-4 py-1" data-testid="badge-verify-expired">
                      Expired Certificate
                    </Badge>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-6 pt-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">Certificate Title</p>
                  <h3 className="text-lg font-bold" data-testid="text-verify-title">{data.title}</h3>
                </div>

                <div className="border-t pt-4 space-y-4">
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Awarded To</p>
                      <p className="font-semibold text-lg" data-testid="text-verify-name">{data.recipientName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Role</p>
                      <p className="text-sm" data-testid="text-verify-role">{data.recipientRole}</p>
                    </div>
                  </div>

                  {data.recipientDepartment && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Department</p>
                      <p className="text-sm" data-testid="text-verify-department">{data.recipientDepartment}</p>
                    </div>
                  )}

                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Issued On</p>
                      <p className="text-sm" data-testid="text-verify-date">
                        {format(new Date(data.issuedAt), 'MMMM dd, yyyy')}
                      </p>
                    </div>
                    {data.revokedAt && (
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Revoked On</p>
                        <p className="text-sm text-destructive">
                          {format(new Date(data.revokedAt), 'MMMM dd, yyyy')}
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Certificate ID</p>
                    <p className="text-xs font-mono text-muted-foreground break-all" data-testid="text-verify-id">{data.certificateId}</p>
                  </div>
                </div>

                {data.valid && (
                  <div className="border-t pt-4">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={downloadPdf}
                      data-testid="button-download-verified-cert"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Certificate PDF
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <p className="text-center text-xs text-muted-foreground mt-6">
            This verification page confirms the authenticity of certificates issued by ExamScheduler.
          </p>
        </div>
      </main>
    </div>
  );
}
