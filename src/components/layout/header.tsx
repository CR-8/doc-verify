"use client";

import { Search, Menu, LogOut, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface HeaderProps {
  title: string;
  onMenuToggle?: () => void;
  className?: string;
}

const mockUser = {
  name: "John Doe",
  email: "john@docverify.com",
};

export function Header({ title, onMenuToggle, className }: HeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 lg:px-6",
        className
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuToggle}
      >
        <Menu className="size-4" />
      </Button>

      <h1 className="text-lg font-semibold truncate">{title}</h1>

      <div className="hidden sm:flex flex-1 items-center justify-end gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search documents..."
            className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar
                src=""
                alt={mockUser.name}
                fallback={mockUser.name}
                className="size-8"
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">{mockUser.name}</p>
                <p className="text-xs font-normal text-muted-foreground">
                  {mockUser.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="size-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive">
              <LogOut className="size-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
