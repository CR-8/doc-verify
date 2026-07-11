"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingState } from "@/components/shared/loading-state";

interface DocumentSummary {
  id: string;
  title: string;
  status: string;
  fileName: string;
  uploadedBy: string;
  pageCount: number;
}

export default function ApproveDocumentPage() {
  const params = useParams<{ documentId: string }>();
  const router = useRouter();
  const [doc, setDoc] = React.useState<DocumentSummary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [pageOption, setPageOption] = React.useState("auto_append");
  const [pageNumber, setPageNumber] = React.useState("1");
  const [comments, setComments] = React.useState("");

  React.useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/documents/${params.documentId}`);
        if (!res.ok) { setDoc(null); return; }
        const json = await res.json();
        const d = json.document ?? json;
        setDoc({
          id: d.id,
          title: d.title,
          status: d.status,
          fileName: d.fileName,
          uploadedBy: d.uploadedBy,
          pageCount: d.pageCount ?? 1,
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

  const docId = doc.id;
  const pageOptions = Array.from({ length: doc.pageCount }, (_, i) => i + 1);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/documents/${docId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signaturePage: pageOption === "manual" ? Number(pageNumber) : undefined,
          pageSelectorType: pageOption === "auto_append" ? "auto_append" : "manual_page",
        }),
      });
      if (!res.ok) throw new Error("Approval failed");
      router.push(`/dashboard/documents/${docId}`);
    } catch {
      alert("Failed to approve document");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href={`/dashboard/documents/${doc.id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Document
          </Link>
        </Button>
        <PageHeader
          title="Approve Document"
          description="Review and digitally sign this document"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Document Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Title</p>
                  <p className="text-sm font-medium">{doc.title}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={doc.status} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">File</p>
                <p className="text-sm font-medium">{doc.fileName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pages</p>
                <p className="text-sm font-medium">{doc.pageCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" variant="outline" asChild>
              <Link href={`/dashboard/documents/${doc.id}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Cancel
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Signature Placement</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <Label>Signature Location</Label>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="placement"
                    value="auto_append"
                    checked={pageOption === "auto_append"}
                    onChange={() => setPageOption("auto_append")}
                    className="accent-primary"
                  />
                  <span className="text-sm">Auto-append to end of document</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="placement"
                    value="manual"
                    checked={pageOption === "manual"}
                    onChange={() => setPageOption("manual")}
                    className="accent-primary"
                  />
                  <span className="text-sm">Choose page number</span>
                </label>
              </div>
              {pageOption === "manual" && (
                <div className="ml-6">
                  <Select
                    value={pageNumber}
                    onChange={(e) => setPageNumber(e.target.value)}
                    className="w-32"
                  >
                    {pageOptions.map((p) => (
                      <option key={p} value={String(p)}>
                        Page {p}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-3">
              <Label htmlFor="comments">Comments (optional)</Label>
              <Textarea
                id="comments"
                placeholder="Add any notes or comments..."
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={4}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" asChild>
                <Link href={`/dashboard/documents/${doc.id}`}>Cancel</Link>
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Approve &amp; Sign
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
