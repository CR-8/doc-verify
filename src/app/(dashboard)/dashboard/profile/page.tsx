"use client";

import * as React from "react";
import { Mail, Shield, Briefcase, Building2, Phone, CalendarDays, Clock } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/auth/auth-context";
import { ROLE_LABELS, ROLE_DESCRIPTIONS, ROLE_BADGE_CLASSES } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" description="Your account details" />

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
          <div className="grid gap-x-8 sm:grid-cols-2">
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
        </CardContent>
      </Card>
    </div>
  );
}
