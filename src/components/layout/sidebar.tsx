"use client";

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
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Documents", href: "/dashboard/documents", icon: FileText },
  { label: "Approvals", href: "/dashboard/approvals", icon: Stamp },
  { label: "Users", href: "/dashboard/users", icon: Users },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

interface SidebarProps {
  className?: string;
  isOpen?: boolean;
  onToggle?: () => void;
}

export function Sidebar({ className, isOpen, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

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
          {navItems.map((item) => {
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
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? (
              <Sun className="size-4" />
            ) : (
              <Moon className="size-4" />
            )}
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </Button>
        </div>
      </aside>
    </>
  );
}
