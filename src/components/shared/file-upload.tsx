"use client";

import * as React from "react";
import { Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string;
  maxSize?: number;
  multiple?: boolean;
  className?: string;
}

export function FileUpload({
  onFilesSelected,
  accept,
  maxSize = 10,
  multiple = false,
  className,
}: FileUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [files, setFiles] = React.useState<File[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);

  function validate(f: File[]): File[] {
    const valid: File[] = [];
    for (const file of f) {
      if (accept) {
        const types = accept.split(",").map((t) => t.trim());
        const ext = "." + file.name.split(".").pop()?.toLowerCase();
        if (
          !types.some(
            (t) =>
              file.type.match(t.replace("*", ".*")) || ext === t
          )
        ) {
          setError(`File type ${file.type || ext} is not accepted`);
          return valid;
        }
      }
      if (file.size > maxSize * 1024 * 1024) {
        setError(
          `${file.name} exceeds the ${maxSize} MB size limit`
        );
        return valid;
      }
      valid.push(file);
    }
    return valid;
  }

  function handleFiles(f: File[]) {
    setError(null);
    const valid = validate(f);
    if (valid.length === 0) return;
    setFiles(multiple ? (prev) => [...prev, ...valid] : valid);
    onFilesSelected(multiple ? [...files, ...valid] : valid);
  }

  function removeFile(index: number) {
    const next = files.filter((_, i) => i !== index);
    setFiles(next);
    onFilesSelected(next);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length) handleFiles(dropped);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave() {
    setDragging(false);
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors",
          dragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50"
        )}
      >
        <Upload className="h-8 w-8 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">
            Drop files here or click to browse
          </p>
          <p className="text-xs text-muted-foreground">
            {accept ? `Accepted: ${accept}` : "All file types"}
            &nbsp;&middot;&nbsp;Max {maxSize} MB
          </p>
        </div>
        <Input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => {
            const selected = Array.from(e.target.files ?? []);
            if (selected.length) handleFiles(selected);
            e.target.value = "";
          }}
        />
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
            >
              <div className="min-w-0 flex-1 truncate">
                <span className="font-medium">{file.name}</span>
                <span className="ml-2 text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="ml-2 rounded p-0.5 hover:bg-muted"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Remove {file.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
