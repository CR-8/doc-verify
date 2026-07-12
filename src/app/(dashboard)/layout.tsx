import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { RequireAuth } from "@/components/auth/require-auth";

interface DashboardRouteLayoutProps {
  children: React.ReactNode;
}

export default function DashboardRouteLayout({
  children,
}: DashboardRouteLayoutProps) {
  return (
    <RequireAuth>
      <DashboardLayout title="Dashboard">
        {children}
      </DashboardLayout>
    </RequireAuth>
  );
}
