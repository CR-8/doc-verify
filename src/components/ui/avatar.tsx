import * as React from "react";
import { cn } from "@/lib/utils";

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  fallback?: string;
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, alt, fallback, ...props }, ref) => {
    const [imageError, setImageError] = React.useState(false);

    const initials = React.useMemo(() => {
      if (!fallback) return "";
      return fallback
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }, [fallback]);

    return (
      <div
        ref={ref}
        className={cn(
          "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
          className
        )}
        {...props}
      >
        {src && !imageError ? (
          <img
            src={src}
            alt={alt ?? ""}
            className="aspect-square h-full w-full"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
            {initials}
          </div>
        )}
      </div>
    );
  }
);
Avatar.displayName = "Avatar";

export { Avatar };
