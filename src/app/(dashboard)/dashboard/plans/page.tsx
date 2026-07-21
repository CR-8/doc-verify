"use client";

import * as React from "react";
import { Check, Crown, Zap, Rocket, Infinity as InfinityIcon, Building2 } from "lucide-react";
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

const CURRENT_PLAN = "free";

export default function PlansPage() {
  function handleSelect(plan: Plan) {
    if (plan.key === CURRENT_PLAN) {
      toast({ title: "You are already on the FREE plan" });
      return;
    }
    if (plan.custom) {
      window.location.href =
        "mailto:sshreyansh8070@gmail.com?subject=DocVerify%20BUSINESS%20plan%20enquiry";
      return;
    }
    toast({
      title: `${plan.name} plan selected`,
      description: "Online payments are not set up yet — contact the administrator to activate this plan.",
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscription Plans"
        description="Choose the plan that fits your document upload needs"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {PLANS.map((plan) => {
          const Icon = plan.icon;
          const isCurrent = plan.key === CURRENT_PLAN;
          return (
            <Card
              key={plan.key}
              className={cn(
                "relative flex flex-col",
                plan.highlight && "border-primary shadow-md"
              )}
            >
              {plan.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
                  Most Popular
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
                  disabled={isCurrent}
                  onClick={() => handleSelect(plan)}
                >
                  {isCurrent ? "Current Plan" : plan.cta}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Prices are in Indian Rupees (₹). Upload capacity counts documents uploaded within the plan
        period. For custom requirements, choose the BUSINESS plan to get in touch.
      </p>
    </div>
  );
}
