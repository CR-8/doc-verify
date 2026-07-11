"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  className?: string;
}

export function DashboardLayout({
  children,
  title,
  className,
}: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className={cn("flex flex-1 flex-col", className)}>
        <Header
          title={title}
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        />

        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
