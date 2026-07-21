"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  Stamp,
  Users,
  Settings,
  X,
  Moon,
  Sun,
  Crown,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/auth/auth-context";
import { roleGte, type RoleLevel } from "@/lib/auth/roles";

const PLAN_SUMMARY: Record<string, { label: string; capacity: string }> = {
  free: { label: "FREE Plan", capacity: "10 uploads" },
  pro: { label: "PRO Plan", capacity: "25 uploads / month" },
  super: { label: "SUPER Plan", capacity: "100 uploads / 3 months" },
  ultra: { label: "ULTRA Plan", capacity: "Unlimited uploads" },
  business: { label: "BUSINESS Plan", capacity: "Custom capacity" },
};

// `minRole` mirrors the role each backing API enforces, so the nav only shows
// destinations the user can actually open (documents/approvals require viewer,
// user & settings management require admin).
const navItems: Array<{ label: string; href: string; icon: typeof LayoutDashboard; minRole: RoleLevel }> = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, minRole: "viewer" },
  { label: "Documents", href: "/dashboard/documents", icon: FileText, minRole: "viewer" },
  { label: "Approvals", href: "/dashboard/approvals", icon: Stamp, minRole: "viewer" },
  { label: "Users", href: "/dashboard/users", icon: Users, minRole: "admin" },
  { label: "Settings", href: "/dashboard/settings", icon: Settings, minRole: "admin" },
];

interface SidebarProps {
  className?: string;
  isOpen?: boolean;
  onToggle?: () => void;
}

export function Sidebar({ className, isOpen, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const { user } = useAuth();
  // Avoid a hydration mismatch: the theme is unknown until mounted.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";

  const [plan, setPlan] = React.useState<string>("free");
  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;
    apiClient
      .get<{ plan?: string }>(`/api/users/${user.uid}`)
      .then(({ data }) => {
        if (!cancelled && data?.plan) setPlan(data.plan);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);
  const planInfo = PLAN_SUMMARY[plan] ?? PLAN_SUMMARY.free;
  const visibleNavItems = navItems.filter(
    (item) => user && roleGte(user.role, item.minRole)
  );

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onToggle}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-background transition-transform duration-300 lg:static lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
          className
        )}
      >
        <div className="flex h-14 items-center justify-between border-b px-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-semibold"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
              DV
            </div>
            <span className="text-lg">DocVerify</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onToggle}
          >
            <X className="size-4" />
          </Button>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" &&
                pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t p-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => setTheme(isDark ? "light" : "dark")}
          >
            {isDark ? (
              <Sun className="size-4" />
            ) : (
              <Moon className="size-4" />
            )}
            {isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          </Button>
        </div>

        <div className="border-t p-3">
          <Link
            href="/dashboard/plans"
            className="flex items-center justify-between rounded-md border bg-accent/40 px-3 py-2 transition-colors hover:bg-accent"
          >
            <span className="flex items-center gap-2">
              <Crown className="size-4 text-amber-500" />
              <span className="flex flex-col leading-tight">
                <span className="text-sm font-medium">{planInfo.label}</span>
                <span className="text-[11px] text-muted-foreground">{planInfo.capacity}</span>
              </span>
            </span>
            {plan === "free" && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
                Upgrade
              </span>
            )}
          </Link>
        </div>
      </aside>
    </>
  );
}
