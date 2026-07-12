"use client";

import * as React from "react";
import { UserPlus, Mail, Ban, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface UserRecord {
  [key: string]: unknown;
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  joinedDate: string;
}

const roleColors: Record<string, string> = {
  admin: "bg-blue-100 text-blue-700 border-blue-200",
  approver: "bg-amber-100 text-amber-700 border-amber-200",
  viewer: "bg-slate-100 text-slate-700 border-slate-200",
};

export default function UsersPage() {
  const [users, setUsers] = React.useState<UserRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [inviteName, setInviteName] = React.useState("");
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState("viewer");
  const [inviting, setInviting] = React.useState(false);

  React.useEffect(() => {
    async function load() {
      try {
        const { data } = await apiClient.get<any>("/api/users");
        const list = Array.isArray(data?.users) ? data.users : Array.isArray(data) ? data : [];
        setUsers(
          list.map((u: UserRecord) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            status: u.status,
            joinedDate: u.joinedDate ?? u.createdAt ?? "",
          }))
        );
      } catch (err) {
        toast({
          title: "Failed to load users",
          description: err instanceof Error ? err.message : undefined,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    try {
      const { data: userData } = await apiClient.post<any>("/api/users", {
        name: inviteName, email: inviteEmail, role: inviteRole,
      });
      setUsers((prev) => [
        ...prev,
        {
          id: userData?.user?.id ?? userData?.id ?? String(Date.now()),
          name: inviteName,
          email: inviteEmail,
          role: inviteRole,
          status: "active",
          joinedDate: new Date().toISOString(),
        },
      ]);
      setInviteOpen(false);
      setInviteName("");
      setInviteEmail("");
      setInviteRole("viewer");
    } catch {
      alert("Failed to invite user");
    } finally {
      setInviting(false);
    }
  }

  async function handleDeactivate(id: string) {
    if (!confirm("Deactivate this user?")) return;
    try {
      await apiClient.post(`/api/users/${id}/deactivate`);
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status: "inactive" } : u)));
    } catch {
      alert("Failed to deactivate user");
    }
  }

  const columns: Column<UserRecord>[] = [
    { key: "name", header: "Name", sortable: true },
    { key: "email", header: "Email", sortable: true },
    {
      key: "role",
      header: "Role",
      render: (item) => (
        <Badge variant="outline" className={roleColors[item.role] ?? ""}>
          {item.role.charAt(0).toUpperCase() + item.role.slice(1)}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: "joinedDate",
      header: "Joined Date",
      sortable: true,
      render: (item) => <span>{item.joinedDate ? new Date(item.joinedDate).toLocaleDateString() : "-"}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      render: (item) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" title="Send Email" onClick={() => window.location.href = `mailto:${item.email}`}>
            <Mail className="h-4 w-4" />
          </Button>
          {item.role !== "admin" && item.status === "active" && (
            <Button variant="ghost" size="icon" title="Deactivate" onClick={() => handleDeactivate(item.id)}>
              <Ban className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  if (loading) return <LoadingState type="loading" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Manage users and their access roles"
        actions={
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Invite User
          </Button>
        }
      />

      <DataTable columns={columns} data={users} pageSize={10} />

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
            <DialogDescription>
              Send an invitation to join the document verification system.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-name">Name</Label>
              <Input
                id="invite-name"
                placeholder="Enter full name"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="Enter email address"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select
                id="invite-role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
              >
                <option value="viewer">Viewer</option>
                <option value="approver">Approver</option>
                <option value="admin">Admin</option>
              </Select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={inviting}>
                {inviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <UserPlus className="mr-2 h-4 w-4" />
                Send Invitation
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
