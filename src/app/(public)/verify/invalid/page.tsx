import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/shared/loading-state";

export default function InvalidVerificationPage() {
  return (
    <div className="w-full max-w-md px-4 py-12">
      <LoadingState
        type="error"
        message="The verification link is invalid or has expired."
        action={
          <Link href="/verify">
            <Button className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Verification
            </Button>
          </Link>
        }
      />
    </div>
  );
}
