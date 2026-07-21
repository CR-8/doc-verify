"use client";

import * as React from "react";
import { updateProfile } from "firebase/auth";
import {
  Mail, Shield, Briefcase, Building2, Phone, CalendarDays, Clock,
  Pencil, X, Save, Loader2, UserRound,
} from "lucide-react";
import { auth } from "@/lib/firebase/client";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/auth/auth-context";
import { toast } from "@/hooks/use-toast";
import { ROLE_LABELS, ROLE_DESCRIPTIONS, ROLE_BADGE_CLASSES } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/shared/status-badge";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/loading-state";

interface ProfileRecord {
  displayName?: string;
  email?: string;
  role?: string;
  designation?: string;
  department?: string;
  phone?: string;
  isActive?: boolean;
  createdAt?: unknown;
  lastLoginAt?: unknown;
}

// Firestore timestamps arrive over JSON as {_seconds} objects.
function toDisplayDate(value: unknown): string {
  if (!value) return "—";
  let date: Date | null = null;
  if (typeof value === "string") {
    date = new Date(value);
  } else if (typeof value === "object") {
    const ts = value as { _seconds?: number; seconds?: number };
    const s = ts._seconds ?? ts.seconds;
    if (typeof s === "number") date = new Date(s * 1000);
  }
  if (!date || isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="w-36 shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className="text-sm">{value || "—"}</span>
    </div>
  );
}

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = React.useState<ProfileRecord | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [formName, setFormName] = React.useState("");
  const [formDesignation, setFormDesignation] = React.useState("");
  const [formDepartment, setFormDepartment] = React.useState("");
  const [formPhone, setFormPhone] = React.useState("");

  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await apiClient.get<ProfileRecord>(`/api/users/${user.uid}`);
        if (!cancelled) setProfile(data ?? null);
      } catch {
        // Fall back to the auth-context info below.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (authLoading || (loading && !profile)) return <LoadingState type="loading" />;
  if (!user) return null;

  const displayName = profile?.displayName || user.displayName;
  const email = profile?.email || user.email;
  const role = (profile?.role || user.role) as keyof typeof ROLE_LABELS;
  const isActive = profile?.isActive ?? user.isActive;

  function startEditing() {
    setFormName(profile?.displayName || user?.displayName || "");
    setFormDesignation(profile?.designation ?? "");
    setFormDepartment(profile?.department ?? "");
    setFormPhone(profile?.phone ?? "");
    setEditing(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const name = formName.trim();
    if (!name) {
      toast({ title: "Name cannot be empty", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await apiClient.patch(`/api/users/${user.uid}`, {
        displayName: name,
        designation: formDesignation.trim(),
        department: formDepartment.trim(),
        phone: formPhone.trim(),
      });
      // Keep the Firebase Auth display name in sync so the header shows it too.
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: name }).catch(() => {});
      }
      setProfile((prev) => ({
        ...prev,
        displayName: name,
        designation: formDesignation.trim(),
        department: formDepartment.trim(),
        phone: formPhone.trim(),
      }));
      setEditing(false);
      toast({ title: "Profile updated" });
    } catch (err) {
      toast({
        title: "Failed to update profile",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile"
        description="Your account details"
        actions={
          !editing ? (
            <Button onClick={startEditing}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit Profile
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar
              src={user.photoURL ?? ""}
              alt={displayName}
              fallback={displayName}
              className="size-16 text-lg"
            />
            <div className="space-y-1">
              <CardTitle className="text-xl">{displayName}</CardTitle>
              <p className="text-sm text-muted-foreground">{email}</p>
              <div className="flex items-center gap-2 pt-1">
                <span
                  className={cn(
                    "inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                    ROLE_BADGE_CLASSES[role] ?? ROLE_BADGE_CLASSES.viewer
                  )}
                >
                  {ROLE_LABELS[role] ?? role}
                </span>
                <StatusBadge status={isActive ? "active" : "inactive"} />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Separator className="mb-4" />

          {editing ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="profile-name">
                    <UserRound className="mr-1 inline h-3.5 w-3.5" />
                    Full Name
                  </Label>
                  <Input
                    id="profile-name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Your real full name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-designation">
                    <Briefcase className="mr-1 inline h-3.5 w-3.5" />
                    Designation
                  </Label>
                  <Input
                    id="profile-designation"
                    value={formDesignation}
                    onChange={(e) => setFormDesignation(e.target.value)}
                    placeholder="e.g. Section Officer"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-department">
                    <Building2 className="mr-1 inline h-3.5 w-3.5" />
                    Department
                  </Label>
                  <Input
                    id="profile-department"
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                    placeholder="e.g. Finance"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-phone">
                    <Phone className="mr-1 inline h-3.5 w-3.5" />
                    Phone
                  </Label>
                  <Input
                    id="profile-phone"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                    maxLength={20}
                  />
                </div>
              </div>

              <div className="grid gap-x-8 sm:grid-cols-2">
                <InfoRow icon={Mail} label="Email" value={email} />
                <InfoRow icon={CalendarDays} label="Member since" value={toDisplayDate(profile?.createdAt)} />
                <InfoRow icon={Clock} label="Last login" value={toDisplayDate(profile?.lastLoginAt)} />
              </div>
              <p className="text-xs text-muted-foreground">
                Email, role, member-since and last-login are managed by the system and cannot be edited.
              </p>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setEditing(false)} disabled={saving}>
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save Changes
                </Button>
              </div>
            </form>
          ) : (
            <div className="grid gap-x-8 sm:grid-cols-2">
              <InfoRow icon={UserRound} label="Full Name" value={displayName} />
              <InfoRow icon={Mail} label="Email" value={email} />
              <InfoRow
                icon={Shield}
                label="Role"
                value={ROLE_DESCRIPTIONS[role] ? `${ROLE_LABELS[role]} — ${ROLE_DESCRIPTIONS[role]}` : role}
              />
              <InfoRow icon={Briefcase} label="Designation" value={profile?.designation} />
              <InfoRow icon={Building2} label="Department" value={profile?.department} />
              <InfoRow icon={Phone} label="Phone" value={profile?.phone} />
              <InfoRow icon={CalendarDays} label="Member since" value={toDisplayDate(profile?.createdAt)} />
              <InfoRow icon={Clock} label="Last login" value={toDisplayDate(profile?.lastLoginAt)} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
