"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { roleGte, type RoleLevel } from "@/lib/auth/roles";

/**
 * Client-side role gate for admin-only pages. The backing APIs already enforce
 * roles, but without this the page shell would render (and fire failing
 * requests) for users who cannot use it. Redirects to /unauthorized instead.
 */
export function RequireRole({
  minRole,
  children,
}: {
  minRole: RoleLevel;
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const allowed = !!user && roleGte(user.role, minRole);

  React.useEffect(() => {
    if (!loading && !allowed) {
      router.replace("/unauthorized");
    }
  }, [loading, allowed, router]);

  if (loading || !allowed) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}
