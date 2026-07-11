import * as React from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}

const sideClasses = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

function Tooltip({ children, content, side = "top", className }: TooltipProps) {
  return (
    <div className="group relative inline-flex">
      {children}
      <div
        className={cn(
          "absolute z-50 hidden rounded-md bg-primary px-2.5 py-1.5 text-xs text-primary-foreground whitespace-nowrap group-hover:inline-flex",
          sideClasses[side],
          className
        )}
      >
        {content}
      </div>
    </div>
  );
}

function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export { Tooltip, TooltipProvider };
