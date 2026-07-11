import * as React from "react";
import { Loader2, Inbox, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface LoadingStateProps {
  type: "loading" | "empty" | "error";
  message?: string;
  action?: React.ReactNode;
  className?: string;
}

const defaultMessages = {
  loading: "Loading...",
  empty: "No data available",
  error: "Something went wrong",
};

export function LoadingState({
  type,
  message,
  action,
  className,
}: LoadingStateProps) {
  const msg = message ?? defaultMessages[type];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-16 text-center",
        className
      )}
    >
      {type === "loading" && (
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
      )}
      {type === "empty" && (
        <Inbox className="h-10 w-10 text-muted-foreground" />
      )}
      {type === "error" && (
        <AlertTriangle className="h-10 w-10 text-destructive" />
      )}

      <p className="text-sm text-muted-foreground">{msg}</p>

      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
