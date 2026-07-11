import { DashboardLayout } from "@/components/layout/dashboard-layout";

interface DashboardRouteLayoutProps {
  children: React.ReactNode;
}

function getTitleFromPath(path: string): string {
  const segment = path.split("/").pop() || "";
  return segment.charAt(0).toUpperCase() + segment.slice(1) || "Dashboard";
}

export default function DashboardRouteLayout({
  children,
}: DashboardRouteLayoutProps) {
  return (
    <DashboardLayout title="Dashboard">
      {children}
    </DashboardLayout>
  );
}
