"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Download,
  FileText,
  Calendar,
  User,
  Hash,
  Layers,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingState } from "@/components/shared/loading-state";

interface ApprovalRecord {
  id: string;
  approver: string;
  status: "signed" | "rejected" | "pending";
  date: string;
  comment?: string;
}

interface DocumentData {
  id: string;
  title: string;
  description: string;
  status: string;
  fileName: string;
  fileSize: number;
  pageCount: number;
  uploadedBy: string;
  uploadedAt: string;
  classification: string;
  requiredApprovals: number;
  currentApprovals: number;
  approvals: ApprovalRecord[];
  hasCertificate: boolean;
  certificateId?: string;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export default function DocumentDetailPage() {
  const params = useParams<{ documentId: string }>();
  const [doc, setDoc] = React.useState<DocumentData | null>(null);
  const [loading, setLoading] = React.useState(true);

  async function handleDownload(url: string) {
    try {
      await apiClient.download(url);
    } catch (err) {
      toast({
        title: "Failed to download file",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
  }

  React.useEffect(() => {
    async function load() {
      try {
        const { data } = await apiClient.get<any>(`/api/documents/${params.documentId}`);
        setDoc(data?.document ?? data ?? null);
      } catch (err) {
        toast({
          title: "Failed to load document",
          description: err instanceof Error ? err.message : undefined,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.documentId]);

  if (loading) return <LoadingState type="loading" />;

  if (!doc) {
    return (
      <div className="space-y-6">
        <PageHeader title="Document Not Found" />
        <p className="text-muted-foreground">
          The requested document could not be found.
        </p>
        <Button variant="outline" asChild>
          <Link href="/dashboard/documents">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Documents
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href="/dashboard/documents">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Documents
          </Link>
        </Button>
        <PageHeader title={doc.title} description={doc.description} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Document Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">File Name</p>
                  <p className="text-sm font-medium">{doc.fileName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={doc.status} />
              </div>
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Uploaded By</p>
                  <p className="text-sm font-medium">{doc.uploadedBy}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Upload Date</p>
                  <p className="text-sm font-medium">
                    {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleString() : "-"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Hash className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">File Size</p>
                  <p className="text-sm font-medium">{formatBytes(doc.fileSize)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Layers className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Pages</p>
                  <p className="text-sm font-medium">{doc.pageCount}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Classification</p>
                  <Badge variant="outline" className="capitalize">
                    {doc.classification}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Approval History</CardTitle>
            </CardHeader>
            <CardContent>
              {doc.approvals.length === 0 ? (
                <p className="text-sm text-muted-foreground">No approvals yet.</p>
              ) : (
                <div className="space-y-4">
                  {doc.approvals.map((approval, idx) => (
                    <div key={approval.id}>
                      {idx > 0 && <Separator className="mb-4" />}
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{approval.approver}</span>
                            {approval.status === "signed" ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            ) : approval.status === "rejected" ? (
                              <XCircle className="h-4 w-4 text-red-500" />
                            ) : (
                              <Clock className="h-4 w-4 text-amber-500" />
                            )}
                          </div>
                          {approval.comment && (
                            <p className="text-sm text-muted-foreground">
                              &ldquo;{approval.comment}&rdquo;
                            </p>
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {approval.date ? new Date(approval.date).toLocaleString() : "-"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full" variant="outline" onClick={() => handleDownload(`/api/documents/${doc.id}/download/public`)}>
                <Download className="mr-2 h-4 w-4" />
                Download Public PDF
              </Button>
              <Button className="w-full" variant="outline" onClick={() => handleDownload(`/api/documents/${doc.id}/download/internal`)}>
                <Download className="mr-2 h-4 w-4" />
                Download Internal PDF
              </Button>
              {doc.status === "pending_approval" && (
                <Button className="w-full" asChild>
                  <Link href={`/dashboard/documents/${doc.id}/approve`}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Approve Document
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>

          {doc.hasCertificate && doc.certificateId && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Certificate</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-3">
                  <ShieldCheck className="h-5 w-5 text-emerald-500" />
                  <div>
                    <p className="text-sm font-medium">Verification Certificate</p>
                    <p className="text-xs text-muted-foreground">{doc.certificateId}</p>
                  </div>
                </div>
                <Button className="w-full" variant="outline" onClick={() => handleDownload(`/api/certificates/${doc.certificateId}/download`)}>
                  <Download className="mr-2 h-4 w-4" />
                  Download Certificate
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Approval Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Approvals</span>
                <span className="font-medium">
                  {doc.currentApprovals}/{doc.requiredApprovals}
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: `${Math.min(100, (doc.currentApprovals / doc.requiredApprovals) * 100)}%`,
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
