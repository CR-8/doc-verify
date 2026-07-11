"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye, Download, Trash2, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingState } from "@/components/shared/loading-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface DocumentRecord {
  [key: string]: unknown;
  id: string;
  title: string;
  status: string;
  uploadedBy: string;
  createdAt: string;
  fileName?: string;
}

const statusOptions = [
  { value: "all", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "processing", label: "Processing" },
  { value: "pending_approval", label: "Pending Approval" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "archived", label: "Archived" },
];

export default function DocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = React.useState<DocumentRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [uploadStep, setUploadStep] = React.useState<"select" | "details">("select");
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [uploadId, setUploadId] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [requiredApprovals, setRequiredApprovals] = React.useState("1");
  const [classification, setClassification] = React.useState("internal");

  async function loadDocuments() {
    setLoading(true);
    try {
      const res = await fetch("/api/documents");
      const json = await res.json();
      const list = Array.isArray(json.documents) ? json.documents : [];
      setDocuments(
        list.map((d: DocumentRecord) => ({
          id: d.id,
          title: d.title,
          status: d.status,
          uploadedBy: d.uploadedBy ?? "-",
          createdAt: d.createdAt ?? d.date ?? "",
        }))
      );
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    loadDocuments();
  }, []);

  const filtered = React.useMemo(
    () =>
      statusFilter === "all"
        ? documents
        : documents.filter((d) => d.status === statusFilter),
    [documents, statusFilter]
  );

  async function handleFileSelect(file: File) {
    setSelectedFile(file);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/documents/upload", { method: "POST", body: formData });
      const json = await res.json();
      setUploadId(json.uploadId);
      setUploadStep("details");
    } catch {
      alert("Failed to upload file");
    } finally {
      setUploading(false);
    }
  }

  async function handleCompleteUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadId) return;
    setUploading(true);
    try {
      const res = await fetch("/api/documents/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadId,
          title,
          description,
          requiredApprovals: Number(requiredApprovals),
          classification,
        }),
      });
      if (!res.ok) throw new Error("Failed to complete upload");
      setUploadOpen(false);
      setUploadStep("select");
      setSelectedFile(null);
      setUploadId(null);
      setTitle("");
      setDescription("");
      setRequiredApprovals("1");
      setClassification("internal");
      loadDocuments();
    } catch {
      alert("Failed to create document");
    } finally {
      setUploading(false);
    }
  }

  function handleResetUpload() {
    setUploadOpen(false);
    setUploadStep("select");
    setSelectedFile(null);
    setUploadId(null);
    setTitle("");
    setDescription("");
    setRequiredApprovals("1");
    setClassification("internal");
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this document?")) return;
    try {
      await fetch(`/api/documents/${id}`, { method: "DELETE" });
      loadDocuments();
    } catch {
      alert("Failed to delete document");
    }
  }

  const columns: Column<DocumentRecord>[] = [
    { key: "title", header: "Title", sortable: true },
    {
      key: "status",
      header: "Status",
      render: (item) => <StatusBadge status={item.status} />,
    },
    { key: "uploadedBy", header: "Uploaded By", sortable: true },
    {
      key: "createdAt",
      header: "Date",
      sortable: true,
      render: (item) => <span>{new Date(item.createdAt).toLocaleDateString()}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      render: (item) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" title="View" onClick={() => router.push(`/dashboard/documents/${item.id}`)}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" title="Download" onClick={() => window.open(`/api/documents/${item.id}/download/public`, "_blank")}>
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" title="Delete" onClick={() => handleDelete(item.id)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  if (loading) return <LoadingState type="loading" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="Manage and track all uploaded documents"
        actions={
          <Button onClick={() => setUploadOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Upload Document
          </Button>
        }
      />

      <div className="flex items-center gap-4">
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-48"
        >
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </div>

      <DataTable columns={columns} data={filtered} pageSize={10} />

      <Dialog open={uploadOpen} onOpenChange={(open) => { if (!open) handleResetUpload(); }}>
        <DialogContent>
          {uploadStep === "select" ? (
            <>
              <DialogHeader>
                <DialogTitle>Upload Document</DialogTitle>
                <DialogDescription>
                  Select a PDF or document file to upload for verification.
                </DialogDescription>
              </DialogHeader>
              <div
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f); }}
                onDragOver={(e) => e.preventDefault()}
              >
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
                  className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:text-primary-foreground"
                />
              </div>
              {uploading && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Uploading...
                </div>
              )}
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Document Details</DialogTitle>
                <DialogDescription>Provide metadata for the uploaded document.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCompleteUpload} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="requiredApprovals">Required Approvals</Label>
                  <Input id="requiredApprovals" type="number" min={1} value={requiredApprovals} onChange={(e) => setRequiredApprovals(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="classification">Classification</Label>
                  <Select id="classification" value={classification} onChange={(e) => setClassification(e.target.value)}>
                    <option value="public">Public</option>
                    <option value="internal">Internal</option>
                    <option value="confidential">Confidential</option>
                    <option value="restricted">Restricted</option>
                  </Select>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={handleResetUpload}>Cancel</Button>
                  <Button type="submit" disabled={uploading}>
                    {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Document
                  </Button>
                </div>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
