import Link from "next/link";
import { Shield, FileCheck, QrCode, ScrollText, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    title: "Secure Signatures",
    description: "Legally binding electronic signatures with cryptographic verification and tamper detection.",
    icon: Shield,
  },
  {
    title: "Certificate Generation",
    description: "Automatically generate verifiable certificates for every signed document.",
    icon: FileCheck,
  },
  {
    title: "QR Verification",
    description: "Instant document authenticity checks via QR codes embedded in certificates.",
    icon: QrCode,
  },
  {
    title: "Audit Trail",
    description: "Complete chronological record of every action taken on your documents.",
    icon: ScrollText,
  },
];

const steps = [
  {
    number: 1,
    title: "Upload",
    description: "Upload your document securely. We support PDFs, Word files, and images with automatic processing.",
  },
  {
    number: 2,
    title: "Approve",
    description: "Assign approvers who review and sign electronically. Track the approval workflow in real time.",
  },
  {
    number: 3,
    title: "Verify",
    description: "Recipients verify authenticity via QR code, unique token, or certificate ID.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4 lg:px-10">
        <span className="text-xl font-bold tracking-tight">DocVerify</span>
        <div className="flex items-center gap-4">
          <Link href="/verify">
            <Button variant="outline" size="sm">
              Verify a Document
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button size="sm">Dashboard</Button>
          </Link>
        </div>
      </header>

      <section className="flex flex-col items-center justify-center px-6 py-24 text-center lg:px-10 lg:py-36">
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          Document Verification &amp; Electronic Approvals
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          A secure platform for uploading, approving, and verifying documents with cryptographic signatures,
          QR-based verification, and complete audit trails.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link href="/dashboard">
            <Button size="lg" className="gap-2">
              Get Started <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/verify">
            <Button variant="outline" size="lg">
              Verify a Document
            </Button>
          </Link>
        </div>
      </section>

      <section className="border-t bg-muted/50 px-6 py-20 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold tracking-tight">Platform Features</h2>
          <p className="mt-2 text-center text-muted-foreground">
            Everything you need for secure document management.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title}>
                  <CardHeader>
                    <Icon className="h-10 w-10 text-primary" />
                    <CardTitle className="mt-2">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-6 py-20 lg:px-10">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-3xl font-bold tracking-tight">How It Works</h2>
          <p className="mt-2 text-center text-muted-foreground">
            Three simple steps to secure document verification.
          </p>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {steps.map((step) => (
              <div key={step.number} className="flex flex-col items-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                  {step.number}
                </div>
                <h3 className="mt-4 text-xl font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t bg-muted/50 px-6 py-20 text-center lg:px-10">
        <h2 className="text-3xl font-bold tracking-tight">Ready to get started?</h2>
        <p className="mt-2 text-muted-foreground">
          Upload your first document and experience secure digital approvals.
        </p>
        <Link href="/dashboard">
          <Button size="lg" className="mt-8 gap-2">
            Go to Dashboard <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </section>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} DocVerify. All rights reserved.
      </footer>
    </div>
  );
}
