"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { FileSignature, Pen, Upload, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { LoadingState } from "@/components/shared/loading-state";

type SignatureType = "type" | "draw" | "upload";

interface SignatureData {
  documentId: string;
  documentTitle: string;
  status: string;
  documentHash: string;
  signer: string;
  signerEmail: string;
  timestamp: string;
  certificateId: string;
}

export default function SignPage() {
  const params = useParams();
  const router = useRouter();
  const verificationToken = params.verificationToken as string;

  const [sigData, setSigData] = useState<SignatureData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [designation, setDesignation] = useState("");
  const [signatureType, setSignatureType] = useState<SignatureType>("type");
  const [typedSignature, setTypedSignature] = useState("");
  const [signed, setSigned] = useState(false);
  const [signing, setSigning] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [uploadedSignature, setUploadedSignature] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/verify/signature/${encodeURIComponent(verificationToken)}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load document");
        return r.json();
      })
      .then((d: { data: SignatureData }) => {
        if (!d.data.valid) throw new Error("Invalid or expired verification token");
        setSigData(d.data);
        setLoading(false);
      })
      .catch((e) => {
        setFetchError(e.message);
        setLoading(false);
      });
  }, [verificationToken]);

  useEffect(() => {
    if (signatureType !== "draw" || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
  }, [signatureType]);

  function startDrawing(e: React.MouseEvent | React.TouchEvent) {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function stopDrawing() {
    setIsDrawing(false);
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function handleSignatureUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setUploadedSignature(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  async function handleSign() {
    if (!name.trim() || !email.trim()) return;

    let signaturePage: string | undefined;

    if (signatureType === "type") {
      if (!typedSignature.trim()) return;
      signaturePage = typedSignature.trim();
    } else if (signatureType === "draw") {
      const canvas = canvasRef.current;
      if (!canvas) return;
      signaturePage = canvas.toDataURL();
    } else if (signatureType === "upload") {
      if (!uploadedSignature) return;
      signaturePage = uploadedSignature;
    }

    if (!sigData) return;
    setSigning(true);
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(sigData.documentId)}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signaturePage,
          pageSelectorType: signatureType,
          signerName: name.trim(),
          signerEmail: email.trim(),
          designation: designation.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to sign document");
      setSigned(true);
    } catch {
      setSigning(false);
    }
  }

  if (loading) return <LoadingState type="loading" />;
  if (fetchError) return <LoadingState type="error" message={fetchError} />;
  if (!sigData) return <LoadingState type="empty" />;

  if (signed) {
    return (
      <div className="w-full max-w-lg px-4 py-12">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <CheckCircle className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <CardTitle className="text-2xl">Document Signed Successfully</CardTitle>
            <CardDescription>
              Your signature has been recorded. A certificate of signing has been generated.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Document</p>
                <p className="font-medium">{docInfo.title}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Signed as</p>
                <p className="font-medium">{name}</p>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex-col gap-3">
            <Link href="/verify" className="w-full">
              <Button variant="outline" className="w-full">
                Verify Document
              </Button>
            </Link>
            <Link href="/" className="w-full">
              <Button variant="ghost" className="w-full">
                Go Home
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl px-4 py-12">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileSignature className="h-5 w-5 text-primary" />
              <CardTitle className="text-xl">Sign Document</CardTitle>
            </div>
            <CardDescription>
              You have been requested to sign &ldquo;{docInfo.title}&rdquo;.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg border bg-muted/50 p-4 text-sm">
              <p className="font-medium">{docInfo.title}</p>
              <p className="mt-1 text-muted-foreground">
                Status: {docInfo.status}
              </p>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="text-sm font-medium">Your Information</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="designation">Designation (optional)</Label>
                  <Input
                    id="designation"
                    placeholder="Software Engineer"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="text-sm font-medium">Signature Type</h3>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setSignatureType("type")}
                  className={`flex flex-col items-center gap-2 rounded-lg border p-4 text-sm transition-colors ${
                    signatureType === "type"
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted"
                  }`}
                >
                  <Pen className="h-5 w-5" />
                  <span>Type</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSignatureType("draw")}
                  className={`flex flex-col items-center gap-2 rounded-lg border p-4 text-sm transition-colors ${
                    signatureType === "draw"
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted"
                  }`}
                >
                  <FileSignature className="h-5 w-5" />
                  <span>Draw</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSignatureType("upload")}
                  className={`flex flex-col items-center gap-2 rounded-lg border p-4 text-sm transition-colors ${
                    signatureType === "upload"
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted"
                  }`}
                >
                  <Upload className="h-5 w-5" />
                  <span>Upload</span>
                </button>
              </div>

              {signatureType === "type" && (
                <div className="space-y-2">
                  <Label htmlFor="signature">Type your full name *</Label>
                  <Input
                    id="signature"
                    placeholder="John Doe"
                    value={typedSignature}
                    onChange={(e) => setTypedSignature(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Your typed name will be used as your electronic signature.
                  </p>
                </div>
              )}

              {signatureType === "draw" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Draw your signature</Label>
                    <button
                      type="button"
                      onClick={clearCanvas}
                      className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                  <canvas
                    ref={canvasRef}
                    width={500}
                    height={150}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full rounded-lg border bg-white"
                    style={{ touchAction: "none" }}
                  />
                </div>
              )}

              {signatureType === "upload" && (
                <div className="space-y-2">
                  <Label htmlFor="signature-upload">Upload signature image</Label>
                  <Input
                    id="signature-upload"
                    type="file"
                    accept=".png,.jpg,.jpeg,.gif,.svg"
                    onChange={handleSignatureUpload}
                  />
                  {uploadedSignature && (
                    <img
                      src={uploadedSignature}
                      alt="Uploaded signature"
                      className="mt-2 max-h-24 rounded border object-contain"
                    />
                  )}
                  <p className="text-xs text-muted-foreground">
                    Upload an image of your signature (PNG, JPG, or SVG).
                  </p>
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                Review &amp; Sign
              </h3>
              <p className="text-sm text-muted-foreground">
                By signing this document, you agree to the following:
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-muted-foreground">&bull;</span>
                  <span>I confirm that I have read and understood the terms of this agreement.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-muted-foreground">&bull;</span>
                  <span>I authorize the organization to process the document as outlined.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-muted-foreground">&bull;</span>
                  <span>I acknowledge that this electronic signature is legally binding.</span>
                </li>
              </ul>
            </div>
          </CardContent>
          <CardFooter className="flex-col gap-3">
            <Button
              className="w-full"
              size="lg"
              disabled={
                signing ||
                !name.trim() ||
                !email.trim() ||
                (signatureType === "type" && !typedSignature.trim()) ||
                (signatureType === "upload" && !uploadedSignature)
              }
              onClick={handleSign}
            >
              {signing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing...
                </>
              ) : (
                <>
                  <FileSignature className="h-4 w-4" />
                  Sign Document
                </>
              )}
            </Button>
            <Link href="/" className="w-full">
              <Button variant="ghost" className="w-full">
                Cancel
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
