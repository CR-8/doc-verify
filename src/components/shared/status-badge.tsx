import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const statusVariantMap: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  processing: "secondary",
  approved: "default",
  active: "default",
  completed: "default",
  rejected: "destructive",
  failed: "destructive",
  expired: "destructive",
  pending_approval: "outline",
  draft: "outline",
  archived: "secondary",
  signed: "default",
};

interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status: string;
}

export function StatusBadge({ status, className, ...props }: StatusBadgeProps) {
  const variant = statusVariantMap[status.toLowerCase()] ?? "secondary";

  return (
    <Badge variant={variant} className={cn("capitalize", className)} {...props}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}
