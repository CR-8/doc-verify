import { RequireRole } from "@/components/auth/require-role";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <RequireRole minRole="admin">{children}</RequireRole>;
}
