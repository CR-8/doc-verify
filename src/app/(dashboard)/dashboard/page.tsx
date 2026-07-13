"use client";

import * as React from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/hooks/use-toast";
import {
  FileText,
  Clock,
  CheckCircle2,
  Users,
  ArrowRight,
  Upload,
  Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LoadingState } from "@/components/shared/loading-state";

interface DashboardData {
  totalDocuments: number;
  pendingApprovals: number;
  approvedToday: number;
  activeUsers: number;
  recentDocuments: Array<{
    id: string;
    title: string;
    status: string;
    uploadedBy?: string;
    createdAt: string;
  }>;
}

export default function DashboardPage() {
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function load() {
      try {
        // /api/users is admin-only; a failure there (or anywhere) should not
        // blank the whole dashboard, so each request settles independently.
        const [docsRes, apprRes, usersRes] = await Promise.allSettled([
          apiClient.get<any>("/api/documents"),
          apiClient.get<any>("/api/approvals"),
          apiClient.get<any>("/api/users"),
        ]);

        if (docsRes.status === "rejected" && apprRes.status === "rejected") {
          toast({
            title: "Failed to load dashboard",
            description: docsRes.reason instanceof Error ? docsRes.reason.message : undefined,
            variant: "destructive",
          });
        }

        const docsData = docsRes.status === "fulfilled" ? docsRes.value.data : null;
        const apprData = apprRes.status === "fulfilled" ? apprRes.value.data : null;
        const usersData = usersRes.status === "fulfilled" ? usersRes.value.data : null;

        const docList: any[] = Array.isArray(docsData?.documents) ? docsData.documents : [];
        const apprList: any[] = Array.isArray(apprData?.approvals) ? apprData.approvals : Array.isArray(apprData) ? apprData : [];
        const usersList: any[] = Array.isArray(usersData?.users) ? usersData.users : Array.isArray(usersData) ? usersData : [];

        const today = new Date().toISOString().slice(0, 10);
        const approvedToday = apprList.filter(
          (a: { status: string; date?: string; createdAt?: string }) =>
            a.status === "signed" && (a.date?.slice(0, 10) === today || a.createdAt?.slice(0, 10) === today)
        ).length;

        setData({
          totalDocuments: docsData?.total ?? docList.length,
          pendingApprovals: apprList.filter(
            (a: { status: string }) => a.status === "pending" || a.status === "pending_approval"
          ).length,
          approvedToday,
          activeUsers: usersList.filter(
            (u: { status: string }) => u.status === "active"
          ).length,
          recentDocuments: docList.slice(0, 5).map((d: { id: string; title: string; status: string; uploadedBy?: string; uploadedByName?: string; createdAt?: string; date?: string }) => ({
            id: d.id,
            title: d.title,
            status: d.status,
            uploadedBy: d.uploadedByName ?? d.uploadedBy,
            createdAt: d.createdAt ?? d.date ?? "",
          })),
        });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <LoadingState type="loading" />;

  if (!data) return null;

  const summaryCards = [
    { label: "Total Documents", value: data.totalDocuments, icon: FileText, color: "text-blue-600", bg: "bg-blue-100" },
    { label: "Pending Approvals", value: data.pendingApprovals, icon: Clock, color: "text-amber-600", bg: "bg-amber-100" },
    { label: "Approved Today", value: data.approvedToday, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-100" },
    { label: "Active Users", value: data.activeUsers, icon: Users, color: "text-violet-600", bg: "bg-violet-100" },
  ];

  const quickActions = [
    { label: "Upload Document", href: "/dashboard/documents", icon: Upload },
    { label: "View All Documents", href: "/dashboard/documents", icon: Eye },
    { label: "Pending Approvals", href: "/dashboard/approvals", icon: Clock },
    { label: "Manage Users", href: "/dashboard/users", icon: Users },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Overview of your document verification system"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.label}
                </CardTitle>
                <div className={`rounded-md p-2 ${card.bg}`}>
                  <Icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{card.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Recent Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Uploaded By</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentDocuments.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{doc.title}</TableCell>
                    <TableCell>
                      <StatusBadge status={doc.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {doc.uploadedBy ?? "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Button
                  key={action.label}
                  variant="outline"
                  className="w-full justify-start"
                  asChild
                >
                  <Link href={action.href}>
                    <Icon className="mr-2 h-4 w-4" />
                    {action.label}
                    <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
                  </Link>
                </Button>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
