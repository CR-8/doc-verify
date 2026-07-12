"use client";

import * as React from "react";
import { Eye, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingState } from "@/components/shared/loading-state";

interface ApprovalRecord {
  [key: string]: unknown;
  id: string;
  document: string;
  documentId: string;
  approver: string;
  status: string;
  date: string;
}

const statusOptions = [
  { value: "all", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "signed", label: "Signed" },
  { value: "rejected", label: "Rejected" },
];

export default function ApprovalsPage() {
  const router = useRouter();
  const [approvals, setApprovals] = React.useState<ApprovalRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [rejecting, setRejecting] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function load() {
      try {
        const { data } = await apiClient.get<any>("/api/approvals");
        const list = Array.isArray(data?.approvals) ? data.approvals : Array.isArray(data) ? data : [];
        setApprovals(
          list.map((a: ApprovalRecord) => ({
            id: a.id,
            document: a.document ?? a.documentTitle ?? "-",
            documentId: a.documentId ?? (typeof a.document === "object" && a.document ? (a.document as Record<string, unknown>).id as string : "") ?? "",
            approver: a.approver ?? "-",
            status: a.status,
            date: a.date ?? a.createdAt ?? "",
          }))
        );
      } catch (err) {
        toast({
          title: "Failed to load approvals",
          description: err instanceof Error ? err.message : undefined,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleReject(id: string) {
    if (!confirm("Reject this approval?")) return;
    setRejecting(id);
    try {
      await apiClient.post(`/api/approvals/${id}/reject`);
      setApprovals((prev) => prev.map((a) => (a.id === id ? { ...a, status: "rejected" } : a)));
    } catch {
      alert("Failed to reject approval");
    } finally {
      setRejecting(null);
    }
  }

  const filtered = React.useMemo(
    () =>
      statusFilter === "all"
        ? approvals
        : approvals.filter((a) => a.status === statusFilter),
    [approvals, statusFilter]
  );

  const columns: Column<ApprovalRecord>[] = [
    {
      key: "document",
      header: "Document",
      sortable: true,
      render: (item) => (
        <Link
          href={`/dashboard/documents/${item.documentId}`}
          className="font-medium hover:underline"
        >
          {item.document}
        </Link>
      ),
    },
    { key: "approver", header: "Approver", sortable: true },
    {
      key: "status",
      header: "Status",
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: "date",
      header: "Date",
      sortable: true,
      render: (item) => <span>{item.date ? new Date(item.date).toLocaleDateString() : "-"}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      render: (item) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" title="View Document" asChild>
            <Link href={`/dashboard/documents/${item.documentId}`}>
              <Eye className="h-4 w-4" />
            </Link>
          </Button>
          {item.status === "pending" && (
            <>
              <Button variant="ghost" size="icon" title="Approve" asChild>
                <Link href={`/dashboard/documents/${item.documentId}/approve`}>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="Reject"
                onClick={() => handleReject(item.id)}
                disabled={rejecting === item.id}
              >
                {rejecting === item.id ? (
                  <Loader2 className="h-4 w-4 animate-spin text-destructive" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  if (loading) return <LoadingState type="loading" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approvals"
        description="Track document approvals and signing status"
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
    </div>
  );
}
