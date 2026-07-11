import Link from "next/link";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/shared/loading-state";

export default function UnauthorizedPage() {
  return (
    <div className="w-full max-w-md px-4 py-12">
      <LoadingState
        type="error"
        message="You don't have access to this page."
        action={
          <div className="flex gap-3">
            <Link href="/dashboard">
              <Button>Go to Dashboard</Button>
            </Link>
            <Link href="/">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Go Home
              </Button>
            </Link>
          </div>
        }
      />
    </div>
  );
}
