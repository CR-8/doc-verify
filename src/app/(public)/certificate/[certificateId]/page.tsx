"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { QrCode, Download, ShieldCheck, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/shared/loading-state";

interface CertificateData {
  id: string;
  documentId: string;
  signerName: string;
  signerDesignation: string;
  documentTitle: string;
  documentHash: string;
  signedAt: string;
  verificationToken: string;
  certificateHash: string;
}

export default function CertificatePage() {
  const params = useParams();
  const certificateId = params.certificateId as string;
  const [cert, setCert] = useState<CertificateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/certificates/${encodeURIComponent(certificateId)}`)
      .then((r) => r.json())
      .then((envelope: { success: boolean; data?: CertificateData; error?: { message?: string } }) => {
        if (!envelope.success || !envelope.data) {
          throw new Error(envelope.error?.message ?? "Failed to load certificate");
        }
        setCert(envelope.data);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [certificateId]);

  async function handleDownload() {
    try {
      const res = await fetch(`/api/certificates/${encodeURIComponent(certificateId)}/download`);
      if (!res.ok) throw new Error("Download failed");
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="?([^"]+)"?/i);
      const fileName = match?.[1] ?? "certificate.pdf";
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    }
  }

  if (loading) return <LoadingState type="loading" />;
  if (error) return <LoadingState type="error" message={error} />;
  if (!cert) return <LoadingState type="empty" />;

  return (
    <div className="w-full max-w-xl px-4 py-12">
      <Card className="border-2">
        <CardHeader className="border-b bg-muted/30 pb-6 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl tracking-tight">Certificate of Verification</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            This certificate confirms the authenticity and integrity of the signed document.
          </p>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          <div className="text-center">
            <Badge variant="outline" className="px-3 py-1 text-xs font-mono">
              ID: {cert.id}
            </Badge>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <div>
              <p className="text-muted-foreground">Document Title</p>
              <p className="mt-0.5 font-medium">{cert.documentTitle}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Signer Name</p>
              <p className="mt-0.5 font-medium">{cert.signerName}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Designation</p>
              <p className="mt-0.5 font-medium">{cert.signerDesignation}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Date Signed</p>
              <p className="mt-0.5 font-medium">
                {new Date(cert.signedAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-muted-foreground">Document Hash (SHA-256)</p>
              <p className="mt-0.5 break-all font-mono text-xs text-muted-foreground">
                {cert.documentHash}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-muted-foreground">Certificate Hash</p>
              <p className="mt-0.5 break-all font-mono text-xs text-muted-foreground">
                {cert.certificateHash}
              </p>
            </div>
          </div>

          <Separator />

          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-xs text-muted-foreground">Scan to verify authenticity</p>
            <div className="flex h-32 w-32 items-center justify-center rounded-lg border-2 bg-muted">
              <QrCode className="h-12 w-12 text-muted-foreground" />
            </div>
          </div>

          <div className="flex gap-3">
            <Button className="flex-1 gap-2" onClick={handleDownload}>
              <Download className="h-4 w-4" />
              Download Certificate
            </Button>
            <Link href={`/verify/${cert.verificationToken}`} className="flex-1">
              <Button variant="outline" className="w-full gap-2">
                <ExternalLink className="h-4 w-4" />
                Verify Document
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
