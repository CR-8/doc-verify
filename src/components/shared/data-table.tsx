"use client";

import * as React from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  pageSize?: number;
  className?: string;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  onRowClick,
  pageSize = 10,
  className,
}: DataTableProps<T>) {
  const [search, setSearch] = React.useState("");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [sortKey, setSortKey] = React.useState<string | null>(null);
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");

  const filtered = React.useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((item) =>
      columns.some((col) => {
        const val = item[col.key];
        return val != null && String(val).toLowerCase().includes(q);
      })
    );
  }, [data, search, columns]);

  const sorted = React.useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null || bVal == null) return 0;
      const cmp =
        typeof aVal === "number" && typeof bVal === "number"
          ? aVal - bVal
          : String(aVal).localeCompare(String(bVal));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const start = (safePage - 1) * pageSize;
  const page = sorted.slice(start, start + pageSize);

  React.useEffect(() => {
    setCurrentPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setCurrentPage(1);
          }}
          className="pl-9"
        />
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={cn(
                    col.sortable && "cursor-pointer select-none"
                  )}
                  onClick={() => col.sortable && toggleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && sortKey === col.key && (
                      <span className="text-xs">
                        {sortDir === "asc" ? "\u2191" : "\u2193"}
                      </span>
                    )}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {page.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center text-muted-foreground"
                >
                  No results
                </TableCell>
              </TableRow>
            ) : (
              page.map((item, i) => (
                <TableRow
                  key={(item.id as string) ?? i}
                  className={cn(
                    onRowClick && "cursor-pointer"
                  )}
                  onClick={() => onRowClick?.(item)}
                >
                  {columns.map((col) => (
                    <TableCell key={col.key}>
                      {col.render
                        ? col.render(item)
                        : (item[col.key] as React.ReactNode) ?? "-"}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {safePage} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="inline-flex items-center justify-center rounded-md border p-1.5 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(
                (p) =>
                  p === 1 ||
                  p === totalPages ||
                  Math.abs(p - safePage) <= 1
              )
              .map((p, idx, arr) => (
                <React.Fragment key={p}>
                  {idx > 0 && arr[idx - 1] !== p - 1 && (
                    <span className="px-1">...</span>
                  )}
                  <button
                    onClick={() => setCurrentPage(p)}
                    className={cn(
                      "inline-flex h-7 w-7 items-center justify-center rounded-md text-sm",
                      p === safePage
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    {p}
                  </button>
                </React.Fragment>
              ))}
            <button
              onClick={() =>
                setCurrentPage((p) => Math.min(totalPages, p + 1))
              }
              disabled={safePage >= totalPages}
              className="inline-flex items-center justify-center rounded-md border p-1.5 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
