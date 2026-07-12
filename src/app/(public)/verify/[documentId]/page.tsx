"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle2, XCircle, AlertCircle, QrCode, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingState } from "@/components/shared/loading-state";

interface SignatureData {
  signerName: string;
  signedAt: string;
  verificationToken: string;
}

interface DocumentData {
  title: string;
  sha256Hash: string;
  status: string;
  uploadedAt: string;
}

interface VerifyResponse {
  valid: boolean;
  document: DocumentData | null;
  signature?: SignatureData | null;
}

interface ApiEnvelope {
  success: boolean;
  data?: VerifyResponse;
  error?: { message?: string };
}

export default function VerifyResultPage() {
  const params = useParams();
  const documentId = params.documentId as string;
  const [data, setData] = useState<VerifyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/verify/${encodeURIComponent(documentId)}`)
      .then((r) => r.json())
      .then((envelope: ApiEnvelope) => {
        if (!envelope.success || !envelope.data) {
          throw new Error(envelope.error?.message ?? "Verification failed");
        }
        setData(envelope.data);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [documentId]);

  if (loading) return <LoadingState type="loading" />;
  if (error) return <LoadingState type="error" message={error} />;
  if (!data) return <LoadingState type="empty" />;

  const { valid, document: doc, signature } = data;

  return (
    <div className="w-full max-w-lg px-4 py-12">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Verification Result</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center gap-3 text-center">
            {valid && (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <StatusBadge status="signed" className="mb-2" />
                  <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                    Document verified successfully
                  </p>
                </div>
              </>
            )}
            {!valid && signature && (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                  <XCircle className="h-8 w-8 text-destructive" />
                </div>
                <div>
                  <StatusBadge status="rejected" className="mb-2" />
                  <p className="text-lg font-semibold text-destructive">Verification failed</p>
                </div>
              </>
            )}
            {!valid && !signature && (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                  <AlertCircle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <StatusBadge status="expired" className="mb-2" />
                  <p className="text-lg font-semibold text-amber-600 dark:text-amber-400">Document not found</p>
                </div>
              </>
            )}
          </div>

          {valid && doc && (
            <>
              <Separator />
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Document</p>
                    <p className="font-medium">{doc.title}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Signed by</p>
                    <p className="font-medium">{signature?.signerName ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Date signed</p>
                    <p className="font-medium">
                      {signature?.signedAt
                        ? new Date(signature.signedAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Certificate</p>
                    {signature?.verificationToken ? (
                      <Link
                        href={`/certificate/${signature.verificationToken}`}
                        className="font-medium text-primary underline-offset-2 hover:underline"
                      >
                        {signature.verificationToken.slice(0, 12)}...
                      </Link>
                    ) : (
                      <p className="font-medium">—</p>
                    )}
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Document hash</p>
                    <p className="break-all font-mono text-xs">{doc.sha256Hash}</p>
                  </div>
                </div>
                <Separator />
                <div className="flex flex-col items-center gap-2 text-center">
                  <p className="text-sm text-muted-foreground">QR Code</p>
                  <div className="flex h-28 w-28 items-center justify-center rounded-lg border bg-muted">
                    <QrCode className="h-10 w-10 text-muted-foreground" />
                  </div>
                </div>
                {signature?.verificationToken && (
                  <Link href={`/certificate/${signature.verificationToken}`}>
                    <Button variant="outline" className="w-full">
                      View Certificate
                    </Button>
                  </Link>
                )}
              </div>
            </>
          )}

          {!valid && (
            <div className="rounded-lg border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
              {error ?? "The document could not be verified. The link may be invalid or the document may have been removed."}
            </div>
          )}

          <div className="flex gap-3">
            <Link href="/verify" className="flex-1">
              <Button variant="outline" className="w-full gap-2">
                <ArrowLeft className="h-4 w-4" /> Try Again
              </Button>
            </Link>
            <Link href="/" className="flex-1">
              <Button variant="ghost" className="w-full">
                Go Home
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
