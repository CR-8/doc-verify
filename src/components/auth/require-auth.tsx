"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";

const PUBLIC_PATHS = ["/login", "/signup", "/", "/verify", "/certificate", "/sign", "/unauthorized"];

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [showContent, setShowContent] = React.useState(false);

  React.useEffect(() => {
    if (loading) return;

    const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
    if (isPublic) {
      setShowContent(true);
      return;
    }

    if (!user) {
      router.replace("/login");
    } else {
      setShowContent(true);
    }
  }, [user, loading, pathname, router]);

  if (!showContent) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}
