import * as React from "react";
import { cn } from "@/lib/utils";

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error("Tabs compound components must be used within <Tabs />");
  return ctx;
}

interface TabsProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

function Tabs({
  value,
  defaultValue,
  onValueChange,
  children,
  className,
}: TabsProps) {
  const [internalValue, setInternalValue] = React.useState(
    defaultValue ?? ""
  );
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;
  const setCurrentValue = onValueChange ?? setInternalValue;

  return (
    <TabsContext.Provider
      value={{ value: currentValue, onValueChange: setCurrentValue }}
    >
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

function TabsList({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface TabsTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

function TabsTrigger({
  className,
  value,
  children,
  ...props
}: TabsTriggerProps) {
  const { value: selectedValue, onValueChange } = useTabsContext();
  const isActive = selectedValue === value;

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        isActive
          ? "bg-background text-foreground shadow"
          : "hover:bg-background/50 hover:text-foreground",
        className
      )}
      onClick={() => onValueChange(value)}
      {...props}
    >
      {children}
    </button>
  );
}

interface TabsContentProps
  extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

function TabsContent({
  className,
  value,
  children,
  ...props
}: TabsContentProps) {
  const { value: selectedValue } = useTabsContext();

  if (selectedValue !== value) return null;

  return (
    <div
      className={cn(
        "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
