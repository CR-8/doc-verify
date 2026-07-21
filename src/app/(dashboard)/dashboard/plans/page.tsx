"use client";

import * as React from "react";
import { Check, Crown, Zap, Rocket, Infinity as InfinityIcon, Building2, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/auth/auth-context";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";

interface Plan {
  key: string;
  name: string;
  icon: React.ElementType;
  price: string;
  period: string;
  capacity: string;
  features: string[];
  highlight?: boolean;
  cta: string;
  custom?: boolean;
  purchasable?: boolean;
}

const PLANS: Plan[] = [
  {
    key: "free",
    name: "FREE",
    icon: Crown,
    price: "₹0",
    period: "forever",
    capacity: "0 – 10 uploads",
    features: ["Up to 10 document uploads", "QR verification", "E-signature approvals", "Community support"],
    cta: "Current Plan",
  },
  {
    key: "pro",
    name: "PRO",
    icon: Zap,
    price: "₹2,000",
    period: "per month",
    capacity: "10 – 25 uploads / month",
    features: ["Up to 25 uploads every month", "QR verification", "E-signature approvals", "Email support"],
    cta: "Choose PRO",
    purchasable: true,
  },
  {
    key: "super",
    name: "SUPER",
    icon: Rocket,
    price: "₹6,000",
    period: "per 3 months",
    capacity: "25 – 100 uploads / 3 months",
    features: ["Up to 100 uploads per quarter", "QR verification", "E-signature approvals", "Priority email support"],
    highlight: true,
    cta: "Choose SUPER",
    purchasable: true,
  },
  {
    key: "ultra",
    name: "ULTRA",
    icon: InfinityIcon,
    price: "₹30,000",
    period: "per year",
    capacity: "100 – Unlimited uploads / year",
    features: ["Unlimited uploads all year", "QR verification", "E-signature approvals", "Priority support", "Early access to new features"],
    cta: "Choose ULTRA",
    purchasable: true,
  },
  {
    key: "business",
    name: "BUSINESS",
    icon: Building2,
    price: "Custom",
    period: "tailored pricing",
    capacity: "Custom upload capacity",
    features: ["Custom upload limits", "Dedicated onboarding", "Custom integrations", "Dedicated support manager"],
    cta: "Contact Sales",
    custom: true,
  },
];

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function PlansPage() {
  const { user } = useAuth();
  const [currentPlan, setCurrentPlan] = React.useState("free");
  const [planExpiresAt, setPlanExpiresAt] = React.useState<string | null>(null);
  const [payingPlan, setPayingPlan] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await apiClient.get<any>(`/api/users/${user.uid}`);
        if (cancelled || !data) return;
        setCurrentPlan(data.plan ?? "free");
        const exp = data.planExpiresAt;
        if (exp) {
          const s = typeof exp === "object" ? (exp._seconds ?? exp.seconds) : null;
          setPlanExpiresAt(
            typeof s === "number" ? new Date(s * 1000).toLocaleDateString() : String(exp)
          );
        }
      } catch {
        // Non-fatal: keep showing "free".
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleSelect(plan: Plan) {
    if (plan.key === currentPlan) {
      toast({ title: `You are already on the ${plan.name} plan` });
      return;
    }
    if (plan.custom) {
      window.location.href =
        "mailto:sshreyansh8070@gmail.com?subject=DocVerify%20BUSINESS%20plan%20enquiry";
      return;
    }
    if (!plan.purchasable) return;

    setPayingPlan(plan.key);
    try {
      const { data: order } = await apiClient.post<any>("/api/payments/create-order", {
        plan: plan.key,
      });

      const loaded = await loadRazorpayScript();
      if (!loaded || !window.Razorpay) {
        throw new Error("Could not load the payment window. Check your connection and try again.");
      }

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "DocVerify",
        description: `${plan.name} plan — ${plan.capacity}`,
        order_id: order.orderId,
        prefill: { name: user?.displayName ?? "", email: user?.email ?? "" },
        theme: { color: "#4f46e5" },
        modal: { ondismiss: () => setPayingPlan(null) },
        handler: async (response: Record<string, string>) => {
          try {
            const { data: result } = await apiClient.post<any>("/api/payments/verify", response);
            setCurrentPlan(result?.plan ?? plan.key);
            if (result?.expiresAt) {
              setPlanExpiresAt(new Date(result.expiresAt).toLocaleDateString());
            }
            toast({
              title: `${plan.name} plan activated`,
              description: result?.expiresAt
                ? `Valid until ${new Date(result.expiresAt).toLocaleDateString()}`
                : undefined,
            });
          } catch (err) {
            toast({
              title: "Payment made but activation failed",
              description:
                (err instanceof Error ? err.message : "") +
                " Contact the administrator with your payment ID.",
              variant: "destructive",
            });
          } finally {
            setPayingPlan(null);
          }
        },
      });
      rzp.open();
    } catch (err) {
      setPayingPlan(null);
      toast({
        title: "Could not start payment",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscription Plans"
        description={
          planExpiresAt && currentPlan !== "free"
            ? `Current plan: ${currentPlan.toUpperCase()} (valid until ${planExpiresAt})`
            : "Choose the plan that fits your document upload needs"
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {PLANS.map((plan) => {
          const Icon = plan.icon;
          const isCurrent = plan.key === currentPlan;
          const isPaying = payingPlan === plan.key;
          return (
            <Card
              key={plan.key}
              className={cn(
                "relative flex flex-col",
                plan.highlight && "border-primary shadow-md",
                isCurrent && "border-emerald-500"
              )}
            >
              {plan.highlight && !isCurrent && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
                  Most Popular
                </span>
              )}
              {isCurrent && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 px-3 py-0.5 text-xs font-medium text-white">
                  Your Plan
                </span>
              )}
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Icon className="size-5 text-amber-500" />
                  <CardTitle className="text-base">{plan.name}</CardTitle>
                </div>
                <div className="pt-2">
                  <span className="text-2xl font-bold">{plan.price}</span>
                  <span className="ml-1 text-xs text-muted-foreground">{plan.period}</span>
                </div>
                <p className="text-xs font-medium text-muted-foreground">{plan.capacity}</p>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-4">
                <ul className="space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  size="sm"
                  variant={isCurrent ? "outline" : plan.highlight ? "default" : "secondary"}
                  disabled={isCurrent || isPaying}
                  onClick={() => handleSelect(plan)}
                >
                  {isPaying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isCurrent ? "Current Plan" : plan.cta}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Prices are in Indian Rupees (₹) and processed securely via Razorpay. Upload capacity counts
        documents uploaded within the plan period. For custom requirements, choose the BUSINESS plan
        to get in touch.
      </p>
    </div>
  );
}
