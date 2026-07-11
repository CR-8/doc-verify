import * as React from "react";
import { cn } from "@/lib/utils";

interface DropdownMenuContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const DropdownMenuContext =
  React.createContext<DropdownMenuContextValue | null>(null);

function useDropdownMenuContext() {
  const ctx = React.useContext(DropdownMenuContext);
  if (!ctx)
    throw new Error(
      "DropdownMenu compound components must be used within <DropdownMenu />"
    );
  return ctx;
}

function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <DropdownMenuContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block">{children}</div>
    </DropdownMenuContext.Provider>
  );
}

interface DropdownMenuTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

function DropdownMenuTrigger({
  children,
  className,
  onClick,
  ...props
}: DropdownMenuTriggerProps) {
  const { open, setOpen } = useDropdownMenuContext();

  return (
    <button
      className={cn(className)}
      onClick={(e) => {
        onClick?.(e);
        setOpen(!open);
      }}
      {...props}
    >
      {children}
    </button>
  );
}

interface DropdownMenuContentProps
  extends React.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "end";
}

function DropdownMenuContent({
  children,
  className,
  align = "start",
  ...props
}: DropdownMenuContentProps) {
  const { open, setOpen } = useDropdownMenuContext();

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      <div
        className={cn(
          "absolute z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
          align === "end" ? "right-0" : "left-0",
          className
        )}
        onClick={() => setOpen(false)}
        {...props}
      >
        {children}
      </div>
    </>
  );
}

interface DropdownMenuItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  inset?: boolean;
}

function DropdownMenuItem({
  className,
  inset,
  children,
  ...props
}: DropdownMenuItemProps) {
  return (
    <button
      className={cn(
        "relative flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0",
        inset && "pl-8",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function DropdownMenuSeparator({ className }: { className?: string }) {
  return (
    <div className={cn("-mx-1 my-1 h-px bg-muted", className)} />
  );
}

function DropdownMenuLabel({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("px-2 py-1.5 text-sm font-semibold", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
};
