"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileCheck, Shield, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FileUpload } from "@/components/shared/file-upload";

export default function VerifyPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [uploading, setUploading] = useState(false);

  function handleVerify() {
    if (!token.trim()) return;
    router.push(`/verify/${encodeURIComponent(token.trim())}`);
  }

  async function handleFileUpload(files: File[]) {
    if (files.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", files[0]);
      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const json = await res.json();
      const data = json.data ?? json;
      router.push(`/verify/${data.id ?? data.documentId ?? data.uploadId}`);
    } catch {
      setUploading(false);
    }
  }

  return (
    <div className="w-full max-w-lg px-4 py-12">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Verify Document Authenticity</CardTitle>
          <CardDescription>
            Enter your verification token or upload a document to check its authenticity.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <label className="text-sm font-medium">Verification Token</label>
            <div className="flex gap-2">
              <Input
                placeholder="Paste your verification token..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleVerify()}
              />
              <Button onClick={handleVerify} disabled={!token.trim()}>
                <FileCheck className="h-4 w-4" />
                Verify
              </Button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium">Upload Document</label>
            <FileUpload
              onFilesSelected={handleFileUpload}
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
              maxSize={10}
            />
            {uploading ? (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading...
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Upload the document file to verify its signature and authenticity.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
